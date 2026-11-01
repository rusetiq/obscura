import type { Env } from './env'
import { authenticated, isLocal, login } from './auth'
import { HttpError } from './errors'
import { parseManifest } from './manifests'
import { readFinding, workspace, type FindingRow, type ScanRow } from './store'
import { remediate } from './remediation'
import { analyzeFinding, analysisModel } from './analysis'
import { boundedRequest, jsonBody } from './request'
import { createSchedule, dispatchDueSchedules, runSchedule, updateSchedule } from './schedules'

export { ScanWorkflow } from './workflow'

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin')
    if (origin && origin !== url.origin)
      throw new HttpError(403, 'Cross-origin requests are not allowed.')
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site')
      throw new HttpError(403, 'Cross-site requests are not allowed.')
    const length = Number(request.headers.get('Content-Length') ?? 0)
    if (length > 2_100_000) throw new HttpError(413, 'Files must be smaller than 2 MB.')
    request = await boundedRequest(request)
  }
  if (url.pathname === '/api/session' && request.method === 'POST') return login(request, env)
  if (url.pathname === '/api/session' && request.method === 'DELETE')
    return Response.json(
      { authenticated: false },
      {
        headers: {
          'Set-Cookie': 'obscura_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
        },
      },
    )
  const authorized = await authenticated(request, env)
  if (url.pathname === '/api/session' && request.method === 'GET')
    return Response.json({ authenticated: authorized, local: isLocal(request, env) })
  if (!authorized) throw new HttpError(401, 'Sign in to your workspace to continue.')
  if (url.pathname === '/api/workspace' && request.method === 'GET')
    return Response.json(await workspace(env))
  if (url.pathname === '/api/health' && request.method === 'GET') {
    const [db, r2] = await Promise.allSettled([
      env.DB.prepare('SELECT id FROM scans LIMIT 1').first(),
      env.ARTIFACTS.head('health'),
    ])
    return Response.json({
      database: db.status === 'fulfilled',
      storage: r2.status === 'fulfilled',
      ai: Boolean(env.GROQ_API_KEY),
      aiProvider: 'Groq',
      aiModel: env.GROQ_MODEL || analysisModel,
      local: isLocal(request, env),
    })
  }
  if (
    request.method === 'POST' &&
    !(await env.WORK_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'workspace' }))
      .success
  )
    throw new HttpError(429, 'Request limit reached. Try again in a minute.')
  if (url.pathname === '/api/scans' && request.method === 'POST') {
    const form = await request.formData()
    const file = form.get('manifest')
    const project = String(form.get('project') ?? '').trim()
    if (!(file instanceof File)) throw new HttpError(400, 'Choose a dependency manifest.')
    if (file.size > 2_000_000) throw new HttpError(413, 'Files must be smaller than 2 MB.')
    if (!/^[\w][\w .\/-]{0,79}$/.test(project))
      throw new HttpError(
        400,
        'Use a project name of 1–80 letters, numbers, spaces, slashes, or dashes.',
      )
    const content = await file.text()
    const { dependencies, warnings } = parseManifest(file.name, content)
    const id = crypto.randomUUID()
    const artifactKey = `scans/${id}`
    await Promise.all([
      env.ARTIFACTS.put(`${artifactKey}/manifest`, content, {
        httpMetadata: { contentType: 'text/plain' },
      }),
      env.ARTIFACTS.put(`${artifactKey}/dependencies.json`, JSON.stringify(dependencies), {
        httpMetadata: { contentType: 'application/json' },
      }),
    ])
    await env.DB.prepare(
      'INSERT INTO scans (id, project, filename, status, dependency_count, artifact_key, warnings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        id,
        project,
        file.name,
        'queued',
        dependencies.length,
        artifactKey,
        JSON.stringify(warnings),
        new Date().toISOString(),
      )
      .run()
    try {
      await env.SCAN_WORKFLOW.create({ id, params: { scanId: id } })
    } catch {
      await env.DB.prepare(
        "UPDATE scans SET status = 'failed', error = 'Could not start the scan workflow. Please retry.' WHERE id = ?",
      )
        .bind(id)
        .run()
      throw new HttpError(503, 'Could not start the scan. Please try again.')
    }
    return Response.json({ id, warnings }, { status: 202 })
  }
  if (url.pathname === '/api/schedules' && request.method === 'POST')
    return Response.json(
      await createSchedule(await jsonBody<Record<string, unknown>>(request), env),
      { status: 201 },
    )
  const scheduleMatch = url.pathname.match(/^\/api\/schedules\/([a-f0-9-]{36})(?:\/(run))?$/)
  if (scheduleMatch) {
    const id = scheduleMatch[1]
    if (scheduleMatch[2] === 'run' && request.method === 'POST')
      return Response.json(await runSchedule(id, env), { status: 202 })
    if (!scheduleMatch[2] && request.method === 'PATCH')
      return Response.json(
        await updateSchedule(id, await jsonBody<Record<string, unknown>>(request), env),
      )
    if (!scheduleMatch[2] && request.method === 'DELETE') {
      const result = await env.DB.prepare(
        'DELETE FROM scan_schedules WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?) RETURNING id',
      )
        .bind(id, new Date().toISOString())
        .first()
      if (!result)
        throw new HttpError(
          409,
          'schedule not found or currently starting a scan. try again shortly.',
        )
      return Response.json({ id })
    }
  }
  const match = url.pathname.match(/^\/api\/findings\/([a-f0-9-]{36})(?:\/(analysis|fix))?$/)
  if (match) {
    const row = await env.DB.prepare('SELECT * FROM findings WHERE id = ?')
      .bind(match[1])
      .first<FindingRow>()
    if (!row) throw new HttpError(404, 'Finding not found.')
    const finding = readFinding(row)
    if (!match[2] && request.method === 'PATCH') {
      const { status } = await jsonBody<{ status: string }>(request)
      if (!['open', 'ignored'].includes(status)) throw new HttpError(400, 'Choose open or ignored.')
      await env.DB.prepare('UPDATE findings SET status = ? WHERE id = ?')
        .bind(status, finding.id)
        .run()
      return Response.json({ ...finding, status })
    }
    if (match[2] === 'analysis' && request.method === 'POST') {
      if (finding.analysis) return Response.json({ analysis: finding.analysis })

      const analysis = await analyzeFinding(finding, env)
      await env.DB.prepare('UPDATE findings SET analysis = ? WHERE id = ?')
        .bind(analysis, finding.id)
        .run()
      return Response.json({ analysis })
    }
    if (match[2] === 'fix' && request.method === 'POST') {
      const scan = await env.DB.prepare('SELECT * FROM scans WHERE id = ?')
        .bind(finding.scanId)
        .first<ScanRow>()
      if (!scan) throw new HttpError(404, 'Scan not found.')
      return Response.json(await remediate(finding, scan, env))
    }
  }
  throw new HttpError(404, 'Endpoint not found.')
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await dispatchDueSchedules(env, controller.scheduledTime)
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response
    try {
      response = new URL(request.url).pathname.startsWith('/api/')
        ? await api(request, env)
        : await env.ASSETS.fetch(request)
    } catch (error) {
      if (error instanceof HttpError)
        response = Response.json({ error: error.message }, { status: error.status })
      else {
        console.error(error instanceof Error ? error.message : 'Unhandled request failure')
        response = Response.json(
          {
            error:
              'The request could not be completed. Check the service configuration and try again.',
          },
          { status: 500 },
        )
      }
    }
    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (new URL(request.url).pathname.startsWith('/api/')) headers.set('Cache-Control', 'no-store')
    if (env.ENVIRONMENT !== 'development') {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      )
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
} satisfies ExportedHandler<Env>
