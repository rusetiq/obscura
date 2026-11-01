import { afterEach, describe, expect, it, vi } from 'vitest'
import { remediate } from '../worker/remediation'
import type { Finding } from '../shared/types'
import type { Env } from '../worker/env'
import type { ScanRow } from '../worker/store'

const finding = {
  id: 'finding',
  package: 'example',
  version: '1.0.0',
  ecosystem: 'npm',
  direct: true,
  path: 'dependencies',
  fixedVersions: ['1.0.1'],
} as Finding
const scan = { filename: 'package.json', artifact_key: 'scans/test' } as ScanRow
afterEach(() => vi.unstubAllGlobals())

describe('remediation evidence', () => {
  it('looks beyond an older advisory fix when newer advisories still affect that release', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          vulns: [
            {
              id: 'newer',
              affected: [
                {
                  package: { name: 'example', ecosystem: 'npm' },
                  ranges: [{ events: [{ fixed: '1.2.0' }] }],
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ vulns: [{ id: 'newer' }] }))
      .mockResolvedValueOnce(Response.json({}))
    vi.stubGlobal('fetch', fetcher)
    const put = vi.fn()
    const env = {
      ARTIFACTS: {
        get: async () => ({
          json: async () => ({ dependencies: { example: '1.0.0', unaffected: '2.0.0' } }),
        }),
        put,
      },
    } as unknown as Env
    const fix = await remediate(finding, scan, env)
    expect(fix.to).toBe('1.2.0')
    expect(JSON.parse(fix.content).dependencies).toEqual({ example: '1.2.0', unaffected: '2.0.0' })
    expect(put).toHaveBeenCalledOnce()
  })

  it('refuses to offer an upgrade when every candidate still has advisories', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ vulns: [{ id: 'still-affected' }] })),
    )
    await expect(remediate(finding, scan, {} as Env)).rejects.toThrow(
      'still have known OSV advisories',
    )
  })

  it('does not rewrite lockfiles or transitive entries without regenerating integrity information', async () => {
    await expect(
      remediate(finding, { ...scan, filename: 'package-lock.json' }, {} as Env),
    ).rejects.toThrow('owning package manifest')
    await expect(remediate({ ...finding, direct: false }, scan, {} as Env)).rejects.toThrow(
      'owning package manifest',
    )
  })
})
