import { describe, expect, it } from 'vitest'
import { boundedRequest, jsonBody } from '../worker/request'

describe('request boundaries', () => {
  it('limits the actual body bytes even when content length is missing', async () => {
    const request = new Request('https://dope.example/api/scans', {
      method: 'POST',
      body: '123456789',
    })
    await expect(boundedRequest(request, 5)).rejects.toThrow('smaller than 2 MB')
  })

  it('preserves valid request bodies and reports malformed JSON as client errors', async () => {
    const request = new Request('https://dope.example/api/session', {
      method: 'POST',
      body: '{"password":"test"}',
    })
    expect(await jsonBody(await boundedRequest(request))).toEqual({ password: 'test' })
    await expect(
      jsonBody(new Request('https://dope.example', { method: 'POST', body: '[' })),
    ).rejects.toThrow('valid JSON')
  })
})
