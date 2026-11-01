import { describe, expect, it } from 'vitest'
import { parseManifest } from '../worker/manifests'

describe('manifest coverage', () => {
  it('does not pretend version ranges are resolved versions', () => {
    const result = parseManifest(
      'package.json',
      JSON.stringify({ dependencies: { react: '^19.0.0', lodash: '4.17.20' } }),
    )
    expect(result.dependencies.map((item) => item.name)).toEqual(['lodash'])
    expect(result.warnings.join(' ')).toContain('react: skipped unresolved version')
  })

  it('resolves scoped and nested dependencies without losing their paths', () => {
    const result = parseManifest(
      'package-lock.json',
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { dependencies: { '@scope/package': '^1.0.0' } },
          'node_modules/@scope/package': { version: '1.0.2' },
          'node_modules/@scope/package/node_modules/nested': { version: '2.0.1' },
        },
      }),
    )
    expect(result.dependencies).toMatchObject([
      { name: '@scope/package', direct: true, path: 'node_modules/@scope/package' },
      { name: 'nested', direct: false, path: 'node_modules/@scope/package/node_modules/nested' },
    ])
  })

  it('does not scan unpinned or conditional Python requirements', () => {
    const result = parseManifest(
      'requirements.txt',
      'django==4.2.1\nrequests>=2.0\nflask==2.0.0; python_version < "3.10"\n# pinned dependencies\njinja2==3.1.2 # app renderer',
    )
    expect(result.dependencies.map((item) => item.name)).toEqual(['django', 'jinja2'])
    expect(result.warnings).toHaveLength(2)
  })

  it('rejects unsupported and malformed inputs', () => {
    expect(() => parseManifest('package.json', '{')).toThrow('not valid JSON')
    expect(() => parseManifest('package.json', '[]')).toThrow('JSON object')
    expect(() => parseManifest('package-lock.json', '{"lockfileVersion":1}')).toThrow(
      'lockfileVersion 2 or 3',
    )
    expect(() => parseManifest('package.json', '{"dependencies":{"react":"latest"}}')).toThrow(
      'No exact dependency',
    )
  })
})
