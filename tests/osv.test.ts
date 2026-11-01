import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryDependency, scanDependencies, toFinding } from '../worker/osv'
import type { Dependency } from '../shared/types'

const dependency: Dependency = {
  name: 'example',
  version: '1.0.0',
  ecosystem: 'npm',
  direct: true,
  path: 'dependencies',
}
afterEach(() => vi.unstubAllGlobals())

describe('advisory evidence', () => {
  it('only associates fixed releases with the matching ecosystem and package', () => {
    const finding = toFinding(
      dependency,
      {
        id: 'GHSA-test',
        affected: [
          {
            package: { name: 'another', ecosystem: 'npm' },
            ranges: [{ events: [{ fixed: '9.0.0' }] }],
          },
          {
            package: { name: 'example', ecosystem: 'PyPI' },
            ranges: [{ events: [{ fixed: '8.0.0' }] }],
          },
          {
            package: { name: 'example', ecosystem: 'npm' },
            ranges: [{ events: [{ fixed: '1.0.2' }, { fixed: '1.0.1' }, { fixed: '0.9.9' }] }],
          },
        ],
      },
      'scan',
      'project',
    )
    expect(finding.fixedVersions).toEqual(['1.0.1', '1.0.2'])
    expect(finding.severity).toBe('unknown')
    expect(finding.score).toBeNull()
  })

  it('handles paginated advisory responses and excludes withdrawn advisories', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          vulns: [{ id: 'one' }, { id: 'withdrawn', withdrawn: '2025-01-01' }],
          next_page_token: 'page-2',
        }),
      )
      .mockResolvedValueOnce(Response.json({ vulns: [{ id: 'two' }] }))
    vi.stubGlobal('fetch', fetcher)
    expect((await queryDependency(dependency)).map((item) => item.id)).toEqual(['one', 'two'])
    expect(JSON.parse(fetcher.mock.calls[1][1].body).page_token).toBe('page-2')
  })

  it('does not report clean results when OSV fails or returns incomplete coverage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 })),
    )
    await expect(queryDependency(dependency)).rejects.toThrow('OSV returned 503')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ results: [] })))
    await expect(scanDependencies([dependency], async () => {})).rejects.toThrow('incomplete batch')
  })
})
