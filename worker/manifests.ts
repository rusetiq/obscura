import { valid } from 'semver'
import type { Dependency } from '../shared/types'
import { HttpError } from './errors'

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Expected a JSON object in the manifest.')
  return value as RecordValue
}

export function parseManifest(
  filename: string,
  content: string,
): { dependencies: Dependency[]; warnings: string[] } {
  const dependencies: Dependency[] = []
  const warnings: string[] = []
  const add = (
    name: string,
    version: unknown,
    direct: boolean,
    path: string,
    ecosystem: Dependency['ecosystem'] = 'npm',
  ) => {
    if (typeof version !== 'string' || !name || name.length > 214 || version.length > 100) return
    const exact =
      ecosystem === 'npm' ? valid(version) : /^\d[\w.+!-]*$/.test(version) ? version : null
    if (!exact) {
      warnings.push(
        `${name}: skipped unresolved version "${version}". Upload a lockfile for exact coverage.`,
      )
      return
    }
    dependencies.push({ name, version: exact, ecosystem, direct, path })
  }
  if (filename === 'requirements.txt') {
    for (const line of content.split(/\r?\n/)) {
      const stripped = line.replace(/\s+#.*$/, '').trim()
      if (!stripped || stripped.startsWith('#')) continue
      const match = stripped.match(/^([\w.-]+)(?:\[[\w,.-]+\])?==([\w.+!-]+)$/)
      if (match) add(match[1], match[2], true, 'requirements.txt', 'PyPI')
      else warnings.push(`Skipped unpinned or conditional requirement: ${stripped.slice(0, 100)}`)
    }
  } else {
    let manifest: RecordValue
    try {
      manifest = record(JSON.parse(content))
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(400, 'This file is not valid JSON.')
    }
    if (filename === 'package-lock.json') {
      if (!manifest.packages || typeof manifest.packages !== 'object')
        throw new HttpError(400, 'Use a package-lock.json with lockfileVersion 2 or 3.')
      const packages = record(manifest.packages)
      const root = packages[''] ? record(packages['']) : {}
      const directNames = new Set(
        Object.keys({
          ...(root.dependencies as object),
          ...(root.devDependencies as object),
          ...(root.optionalDependencies as object),
        }),
      )
      for (const [path, entry] of Object.entries(packages)) {
        if (!path.includes('node_modules/')) continue
        const pkg = record(entry)
        const name = typeof pkg.name === 'string' ? pkg.name : path.split('node_modules/').at(-1)!
        add(name, pkg.version, directNames.has(name) && path === `node_modules/${name}`, path)
      }
    } else if (filename === 'package.json') {
      for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (!manifest[section]) continue
        for (const [name, version] of Object.entries(record(manifest[section])))
          add(name, version, true, section)
      }
      warnings.unshift(
        'package.json covers pinned direct dependencies only. Upload package-lock.json to include resolved transitive dependencies.',
      )
    } else throw new HttpError(400, 'Upload package.json, package-lock.json, or requirements.txt.')
  }
  if (!dependencies.length)
    throw new HttpError(
      400,
      'No exact dependency versions found. Upload a resolved lockfile or pin dependency versions first.',
    )
  if (dependencies.length > 1000)
    throw new HttpError(400, 'This workspace supports up to 1,000 resolved dependencies per scan.')
  return { dependencies, warnings }
}
