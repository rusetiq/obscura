import type { ScanSchedule, ScheduleFrequency } from '../shared/types'
import type { Env } from './env'
import { HttpError } from './errors'
import type { ScanRow } from './store'

export const frequencyMilliseconds: Record<ScheduleFrequency, number> = {
  hourly: 3600000,
  daily: 86400000,
  weekly: 604800000,
}

export interface ScheduleRow {
  id: string
  name: string
  project: string
  frequency: ScheduleFrequency
  enabled: number
  next_run_at: string
  last_run_at: string | null
  last_scan_id: string | null
  last_error: string | null
  lease_until: string | null
  created_at: string
  last_scan_status?: ScanRow['status'] | null
  scan_error?: string | null
}

export function readSchedule(row: ScheduleRow): ScanSchedule {
  return {
    id: row.id,
    name: row.name,
    project: row.project,
    frequency: row.frequency,
    enabled: row.enabled === 1,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastScanId: row.last_scan_id,
    lastScanStatus: row.last_scan_status ?? null,
    lastError: row.last_error ?? row.scan_error ?? null,
    createdAt: row.created_at,
  }
}

export function nextOccurrence(dueAt: string, frequency: ScheduleFrequency, now: number) {
  const due = Date.parse(dueAt)
  const interval = frequencyMilliseconds[frequency]
  return new Date(
    due + Math.max(1, Math.floor((now - due) / interval) + 1) * interval,
  ).toISOString()
}

export function validateSchedule(body: Record<string, unknown>, now = Date.now()) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const project = typeof body.project === 'string' ? body.project.trim() : ''
  const frequency = body.frequency as ScheduleFrequency
  const firstRun = typeof body.nextRunAt === 'string' ? Date.parse(body.nextRunAt) : NaN
  if (!name || name.length > 80)
    throw new HttpError(400, 'enter a schedule name of 1–80 characters.')
  if (!project || project.length > 80)
    throw new HttpError(400, 'choose a project with an uploaded manifest.')
  if (!Object.hasOwn(frequencyMilliseconds, frequency))
    throw new HttpError(400, 'choose hourly, daily, or weekly.')
  if (!Number.isFinite(firstRun) || firstRun <= now || firstRun > now + 366 * 86400000)
    throw new HttpError(400, 'choose a first run in the future, within one year.')
  return { name, project, frequency, nextRunAt: new Date(firstRun).toISOString() }
}

export async function listSchedules(env: Env) {
  const rows = await env.DB.prepare(
    'SELECT s.*, last.status AS last_scan_status, last.error AS scan_error FROM scan_schedules s LEFT JOIN scans last ON last.id = s.last_scan_id ORDER BY s.created_at DESC',
  ).all<ScheduleRow>()
  return rows.results.map(readSchedule)
}

export async function createSchedule(body: Record<string, unknown>, env: Env) {
  const value = validateSchedule(body)
  const source = await env.DB.prepare('SELECT id FROM scans WHERE project = ? LIMIT 1')
    .bind(value.project)
    .first()
  if (!source) throw new HttpError(400, 'upload a manifest for this project first.')
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM scan_schedules').first<{
    count: number
  }>()
  if ((count?.count ?? 0) >= 100)
    throw new HttpError(422, 'this workspace supports up to 100 schedules.')
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO scan_schedules (id, name, project, frequency, next_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, value.name, value.project, value.frequency, value.nextRunAt, new Date().toISOString())
    .run()
  return { id }
}

export async function updateSchedule(id: string, body: Record<string, unknown>, env: Env) {
  const current = await env.DB.prepare('SELECT * FROM scan_schedules WHERE id = ?')
    .bind(id)
    .first<ScheduleRow>()
  if (!current) throw new HttpError(404, 'schedule not found.')
  if (current.lease_until && Date.parse(current.lease_until) > Date.now())
    throw new HttpError(409, 'this schedule is starting a scan. try again shortly.')
  if (Object.hasOwn(body, 'enabled')) {
    if (typeof body.enabled !== 'boolean' || Object.keys(body).length !== 1)
      throw new HttpError(400, 'provide only a boolean enabled value.')
    const next =
      body.enabled && Date.parse(current.next_run_at) <= Date.now()
        ? nextOccurrence(current.next_run_at, current.frequency, Date.now())
        : current.next_run_at
    const updated = await env.DB.prepare(
      'UPDATE scan_schedules SET enabled = ?, next_run_at = ? WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?) RETURNING id',
    )
      .bind(body.enabled ? 1 : 0, next, id, new Date().toISOString())
      .first()
    if (!updated) throw new HttpError(409, 'this schedule is starting a scan. try again shortly.')
  } else {
    const value = validateSchedule({ ...body, project: current.project })
    const updated = await env.DB.prepare(
      'UPDATE scan_schedules SET name = ?, frequency = ?, next_run_at = ? WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?) RETURNING id',
    )
      .bind(value.name, value.frequency, value.nextRunAt, id, new Date().toISOString())
      .first()
    if (!updated) throw new HttpError(409, 'this schedule is starting a scan. try again shortly.')
  }
  return { id }
}

export async function scheduledScanId(scheduleId: string, dueAt: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scheduleId}:${dueAt}`)),
  )
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function runSchedule(id: string, env: Env, now = Date.now(), dueAt?: string) {
  const instant = new Date(now).toISOString()
  const lease = new Date(now + 300000).toISOString()
  const acquired = await env.DB.prepare(
    'UPDATE scan_schedules SET lease_until = ? WHERE id = ? AND (lease_until IS NULL OR lease_until <= ?) AND (? IS NULL OR (enabled = 1 AND next_run_at = ?)) RETURNING *',
  )
    .bind(lease, id, instant, dueAt ?? null, dueAt ?? null)
    .first<ScheduleRow>()
  if (!acquired)
    throw new HttpError(409, 'this schedule has already been claimed, changed, or removed.')
  let scanId: string | undefined
  try {
    if (acquired.last_scan_id) {
      const last = await env.DB.prepare('SELECT status FROM scans WHERE id = ?')
        .bind(acquired.last_scan_id)
        .first<{ status: ScanRow['status'] }>()
      if (last && ['queued', 'scanning'].includes(last.status))
        throw new HttpError(409, 'the previous scan is still running.')
    }
    const source = await env.DB.prepare(
      'SELECT * FROM scans WHERE project = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    )
      .bind(acquired.project)
      .first<ScanRow>()
    if (!source) throw new HttpError(422, 'upload a dependency manifest for this project first.')
    const artifacts = await Promise.all([
      env.ARTIFACTS.head(`${source.artifact_key}/manifest`),
      env.ARTIFACTS.head(`${source.artifact_key}/dependencies.json`),
    ])
    if (artifacts.some((artifact) => !artifact))
      throw new HttpError(
        422,
        'the saved manifest is missing. upload it again before running this schedule.',
      )
    scanId = dueAt ? await scheduledScanId(id, dueAt) : crypto.randomUUID()
    await env.DB.prepare(
      "INSERT INTO scans (id, project, filename, status, dependency_count, artifact_key, warnings, created_at, trigger, schedule_id) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 'scheduled', ?) ON CONFLICT(id) DO UPDATE SET status = CASE WHEN scans.status IN ('queued', 'failed') THEN 'queued' ELSE scans.status END, error = NULL",
    )
      .bind(
        scanId,
        source.project,
        source.filename,
        source.dependency_count,
        source.artifact_key,
        source.warnings,
        instant,
        id,
      )
      .run()
    try {
      await env.SCAN_WORKFLOW.create({ id: scanId, params: { scanId } })
    } catch (error) {
      try {
        const existing = await (await env.SCAN_WORKFLOW.get(scanId)).status()
        if (existing.status === 'errored' || existing.status === 'terminated')
          await env.DB.prepare(
            "UPDATE scans SET status = 'failed', error = 'the scheduled workflow did not complete.' WHERE id = ? AND status = 'queued'",
          )
            .bind(scanId)
            .run()
      } catch {
        throw error
      }
    }
    const next = dueAt ? nextOccurrence(dueAt, acquired.frequency, now) : acquired.next_run_at
    await env.DB.prepare(
      'UPDATE scan_schedules SET next_run_at = ?, last_run_at = ?, last_scan_id = ?, last_error = NULL, lease_until = NULL WHERE id = ? AND lease_until = ?',
    )
      .bind(next, instant, scanId, id, lease)
      .run()
    return { id: scanId }
  } catch (error) {
    const message =
      error instanceof HttpError
        ? error.message
        : 'could not start the scheduled scan. it will retry on the next scheduler tick.'
    if (scanId)
      await env.DB.prepare(
        "UPDATE scans SET status = 'failed', error = ? WHERE id = ? AND status = 'queued'",
      )
        .bind(message, scanId)
        .run()
    await env.DB.prepare(
      'UPDATE scan_schedules SET last_error = ?, lease_until = NULL WHERE id = ? AND lease_until = ?',
    )
      .bind(message, id, lease)
      .run()
    throw error instanceof HttpError ? error : new HttpError(503, message)
  }
}

export async function dispatchDueSchedules(env: Env, now = Date.now()) {
  const due = await env.DB.prepare(
    'SELECT id, next_run_at FROM scan_schedules WHERE enabled = 1 AND next_run_at <= ? AND (lease_until IS NULL OR lease_until <= ?) ORDER BY next_run_at LIMIT 10',
  )
    .bind(new Date(now).toISOString(), new Date(now).toISOString())
    .all<{ id: string; next_run_at: string }>()
  for (const schedule of due.results) {
    try {
      await runSchedule(schedule.id, env, now, schedule.next_run_at)
    } catch (error) {
      console.error(
        'scheduled scan dispatch failed',
        schedule.id,
        error instanceof HttpError ? error.message : 'dispatch error',
      )
    }
  }
}
