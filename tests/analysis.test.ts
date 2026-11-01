import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeFinding, analysisModel } from '../worker/analysis'
import type { Finding } from '../shared/types'

const finding = {
  advisoryId: 'GHSA-test',
  package: 'example',
  version: '1.0.0',
  title: 'Example advisory',
  details: 'Advisory evidence',
  fixedVersions: ['1.1.0'],
  references: ['https://osv.dev/vulnerability/GHSA-test'],
} as Finding
const config = { GROQ_API_KEY: 'test-server-key' }
afterEach(() => vi.unstubAllGlobals())

describe('Groq analysis', () => {
  it('sends server credentials and advisory evidence to Groq and returns only the answer', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: 'Risk\nProvider-generated explanation.',
              reasoning: 'Not displayed',
            },
            finish_reason: 'stop',
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetcher)
    expect(await analyzeFinding(finding, config)).toBe('Risk\nProvider-generated explanation.')
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(options.headers.Authorization).toBe('Bearer test-server-key')
    const body = JSON.parse(options.body)
    expect(body.model).toBe(analysisModel)
    expect(body.reasoning_format).toBe('hidden')
    expect(JSON.parse(body.messages[1].content)).toMatchObject({
      details: 'Advisory evidence',
      fixes: ['1.1.0'],
    })
    expect(options.body).not.toContain(config.GROQ_API_KEY)
  })

  it('bounds the advisory evidence sent to the model', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'Analysis' } }] }))
    vi.stubGlobal('fetch', fetcher)
    await analyzeFinding({ ...finding, details: 'x'.repeat(15000) }, config)
    expect(
      JSON.parse(JSON.parse(fetcher.mock.calls[0][1].body).messages[1].content).details,
    ).toHaveLength(12000)
  })

  it('requires credentials without making a request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(analyzeFinding(finding, {})).rejects.toThrow('not configured')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('reports provider errors without returning synthetic analysis or leaking upstream details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    await expect(analyzeFinding(finding, config)).rejects.toThrow('could not complete')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { message: 'credential details' } }, { status: 401 }),
        ),
    )
    await expect(analyzeFinding(finding, config)).rejects.toThrow('credentials were rejected')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 429 })))
    await expect(analyzeFinding(finding, config)).rejects.toThrow('rate limiting')
  })

  it('rejects empty and truncated answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '' } }] })),
    )
    await expect(analyzeFinding(finding, config)).rejects.toThrow('returned no analysis')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: 'Partial' }, finish_reason: 'length' }],
        }),
      ),
    )
    await expect(analyzeFinding(finding, config)).rejects.toThrow('response limit')
  })
})
