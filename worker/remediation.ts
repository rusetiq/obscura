import type { Finding } from '../shared/types'
import type { Env } from './env'
import { HttpError } from './errors'
import { queryDependency } from './osv'
import type { ScanRow } from './store'
import { gt, sort, valid } from 'semver'

export async function remediate(finding: Finding, scan: ScanRow, env: Env) {
  if (!finding.direct || scan.filename === 'package-lock.json')
    throw new HttpError(
      422,
      'Update the owning package manifest and regenerate your lockfile. Transitive lockfile entries cannot be safely patched in isolation.',
    )
  if (finding.ecosystem !== 'npm')
    throw new HttpError(
      422,
      'Use the advisory’s fixed version to update requirements.txt, reinstall, and rescan. Automated Python manifest fixes are not yet supported.',
    )
  if (!finding.fixedVersions.length)
    throw new HttpError(422, 'The advisory does not list a fixed release for this dependency.')
  const dependency = {
    name: finding.package,
    version: finding.version,
    ecosystem: finding.ecosystem,
    direct: true,
    path: finding.path,
  }
  const currentAdvisories = await queryDependency(dependency)
  const candidates = sort(
    [
      ...new Set([
        ...finding.fixedVersions,
        ...currentAdvisories.flatMap(
          (advisory) =>
            advisory.affected
              ?.filter(
                (affected) =>
                  affected.package.name === finding.package &&
                  affected.package.ecosystem === finding.ecosystem,
              )
              .flatMap(
                (affected) =>
                  affected.ranges?.flatMap((range) =>
                    range.events.flatMap((event) => (event.fixed ? [event.fixed] : [])),
                  ) ?? [],
              ) ?? [],
        ),
      ]),
    ].filter((version) => valid(version) && gt(version, finding.version)),
  )
  let target: string | undefined
  for (const candidate of candidates.slice(-12)) {
    const advisories = await queryDependency({
      name: finding.package,
      version: candidate,
      ecosystem: finding.ecosystem,
      direct: true,
      path: finding.path,
    })
    if (!advisories.length) {
      target = candidate
      break
    }
  }
  if (!target)
    throw new HttpError(
      422,
      'All listed upgrade candidates still have known OSV advisories. Review the package’s current releases before upgrading.',
    )
  const object = await env.ARTIFACTS.get(`${scan.artifact_key}/manifest`)
  if (!object) throw new HttpError(404, 'Original manifest is missing.')
  const manifest = await object.json<Record<string, unknown>>()
  let changed = false
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const dependencies = manifest[section] as Record<string, string> | undefined
    if (dependencies && Object.hasOwn(dependencies, finding.package)) {
      dependencies[finding.package] = target
      changed = true
    }
  }
  if (!changed)
    throw new HttpError(422, 'This dependency was not found in a patchable manifest section.')
  const content = `${JSON.stringify(manifest, null, 2)}\n`
  await env.ARTIFACTS.put(`${scan.artifact_key}/fixes/${finding.id}.json`, content, {
    httpMetadata: { contentType: 'application/json' },
  })
  return {
    filename: 'package.json',
    content,
    from: finding.version,
    to: target,
    package: finding.package,
    instructions:
      'Replace package.json, run npm install to regenerate the lockfile, run your test suite, and upload the new lockfile to verify the fix. This proposal has no known OSV advisories at generation time; compatibility has not been tested.',
  }
}
