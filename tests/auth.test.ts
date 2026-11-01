import { describe, expect, it } from 'vitest'
import { authenticated, isLocal, login } from '../worker/auth'
import type { Env } from '../worker/env'

const env = {
  ENVIRONMENT: 'production',
  APP_PASSWORD: 'private-workspace-password',
  SESSION_SECRET: 'a-secret-for-tests-that-is-at-least-32-characters',
  AUTH_LIMITER: { limit: async () => ({ success: true }) },
} as unknown as Env

describe('workspace access', () => {
  it('permits local development only on loopback and only in development mode', () => {
    expect(isLocal(new Request('http://127.0.0.1'), { ...env, ENVIRONMENT: 'development' })).toBe(
      true,
    )
    expect(
      isLocal(new Request('https://dope.example'), { ...env, ENVIRONMENT: 'development' }),
    ).toBe(false)
    expect(isLocal(new Request('http://127.0.0.1'), env)).toBe(false)
  })

  it('fails closed if production access secrets are missing', async () => {
    await expect(
      authenticated(new Request('https://dope.example/api/workspace'), {
        ENVIRONMENT: 'production',
      } as Env),
    ).rejects.toThrow('Set APP_PASSWORD')
  })

  it('issues a signed httpOnly session and rejects tampering', async () => {
    const response = await login(
      new Request('https://dope.example/api/session', {
        method: 'POST',
        body: JSON.stringify({ password: env.APP_PASSWORD }),
      }),
      env,
    )
    const cookie = response.headers.get('Set-Cookie')!
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict')
    expect(
      await authenticated(
        new Request('https://dope.example/api/workspace', {
          headers: { Cookie: cookie.split(';')[0] },
        }),
        env,
      ),
    ).toBe(true)
    expect(
      await authenticated(
        new Request('https://dope.example/api/workspace', {
          headers: { Cookie: cookie.split(';')[0].replace(/.$/, 'X') },
        }),
        env,
      ),
    ).toBe(false)
    await expect(
      login(
        new Request('https://dope.example/api/session', {
          method: 'POST',
          body: JSON.stringify({ password: 'wrong' }),
        }),
        env,
      ),
    ).rejects.toThrow('incorrect')
  })
})
