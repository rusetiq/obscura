import type { Env } from './env'
import { HttpError } from './errors'
import { jsonBody } from './request'

const encoder = new TextEncoder()

export function isLocal(request: Request, env: Env) {
  return (
    env.ENVIRONMENT === 'development' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
}

async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export async function authenticated(request: Request, env: Env) {
  if (isLocal(request, env)) return true
  if (!env.APP_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new HttpError(
      503,
      'Set APP_PASSWORD and a SESSION_SECRET of at least 32 characters before opening this workspace.',
    )
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('obscura_session='))
    ?.slice(16)
  if (!token) return false
  const [expires, signature] = token.split('.')
  if (
    !signature ||
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 86400000
  )
    return false
  try {
    const bytes = Uint8Array.from(
      atob(signature.replaceAll('-', '+').replaceAll('_', '/')),
      (char) => char.charCodeAt(0),
    )
    if (encode(bytes) !== signature) return false
    return crypto.subtle.verify(
      'HMAC',
      await key(env.SESSION_SECRET),
      bytes,
      encoder.encode(expires),
    )
  } catch {
    return false
  }
}

export async function login(request: Request, env: Env) {
  if (!env.APP_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new HttpError(503, 'Workspace access has not been configured.')
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  if (!(await env.AUTH_LIMITER.limit({ key: ip })).success)
    throw new HttpError(429, 'Too many attempts. Try again in a minute.')
  const body = await jsonBody<{ password?: unknown }>(request)
  if (typeof body.password !== 'string' || body.password.length > 1024)
    throw new HttpError(400, 'Enter your workspace password.')
  const hmacKey = await key(env.SESSION_SECRET)
  const expected = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(env.APP_PASSWORD))
  if (!(await crypto.subtle.verify('HMAC', hmacKey, expected, encoder.encode(body.password))))
    throw new HttpError(401, 'That workspace password is incorrect.')
  const expires = String(Date.now() + 86400000)
  const signature = encode(
    new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(expires))),
  )
  return Response.json(
    { authenticated: true },
    {
      headers: {
        'Set-Cookie': `obscura_session=${expires}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      },
    },
  )
}
