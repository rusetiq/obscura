import { gt, valid, sort } from 'semver'
import type { Dependency, Finding, Severity } from '../shared/types'

export interface Advisory {
  id: string
  aliases?: string[]
  summary?: string
  details?: string
  withdrawn?: string
  database_specific?: { severity?: string; cvss?: { score?: number } }
  severity?: { type: string; score: string }[]
  affected?: {
    package: { name: string; ecosystem: string }
    database_specific?: { severity?: string }
    ecosystem_specific?: { severity?: string }
    ranges?: { events: { fixed?: string }[] }[]
  }[]
  references?: { url: string }[]
}

async function osv<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.osv.dev/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'obscura' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok) throw new Error(`OSV returned ${response.status}. Try the scan again shortly.`)
  return response.json()
}

export async function queryDependency(dependency: Dependency) {
  const advisories: Advisory[] = []
  let token: string | undefined
  do {
    const page = await osv<{ vulns?: Advisory[]; next_page_token?: string }>('query', {
      package: { name: dependency.name, ecosystem: dependency.ecosystem },
      version: dependency.version,
      ...(token ? { page_token: token } : {}),
    })
    advisories.push(...(page.vulns ?? []).filter((advisory) => !advisory.withdrawn))
    token = page.next_page_token
  } while (token)
  return advisories
}

export async function scanDependencies(
  dependencies: Dependency[],
  onFindings: (findings: { dependency: Dependency; advisory: Advisory }[]) => Promise<void>,
) {
  for (let offset = 0; offset < dependencies.length; offset += 50) {
    const batch = dependencies.slice(offset, offset + 50)
    const result = await osv<{ results: { vulns?: { id: string }[]; next_page_token?: string }[] }>(
      'querybatch',
      {
        queries: batch.map((dependency) => ({
          package: { name: dependency.name, ecosystem: dependency.ecosystem },
          version: dependency.version,
        })),
      },
    )
    if (result.results.length !== batch.length)
      throw new Error('OSV returned an incomplete batch. Please retry the scan.')
    for (let start = 0; start < batch.length; start += 5) {
      const groups = await Promise.all(
        batch.slice(start, start + 5).map(async (dependency, i) => {
          const match = result.results[start + i]
          if (!match.vulns?.length && !match.next_page_token) return []
          const advisories = await queryDependency(dependency)
          return advisories.map((advisory) => ({ dependency, advisory }))
        }),
      )
      await onFindings(groups.flat())
    }
  }
}

export function toFinding(
  dependency: Dependency,
  advisory: Advisory,
  scanId: string,
  project: string,
): Finding {
  const affected =
    advisory.affected?.filter(
      (item) =>
        item.package.name === dependency.name && item.package.ecosystem === dependency.ecosystem,
    ) ?? []
  const rawSeverity = (
    advisory.database_specific?.severity ??
    affected[0]?.database_specific?.severity ??
    affected[0]?.ecosystem_specific?.severity ??
    ''
  ).toLowerCase()
  const severity: Severity =
    rawSeverity === 'moderate'
      ? 'medium'
      : ['critical', 'high', 'medium', 'low'].includes(rawSeverity)
        ? (rawSeverity as Severity)
        : 'unknown'
  const fixes = [
    ...new Set(
      affected.flatMap(
        (item) =>
          item.ranges?.flatMap((range) =>
            range.events.flatMap((event) => (event.fixed ? [event.fixed] : [])),
          ) ?? [],
      ),
    ),
  ]
  const fixedVersions =
    dependency.ecosystem === 'npm'
      ? sort(fixes.filter((version) => valid(version) && gt(version, dependency.version)))
      : fixes
  return {
    id: crypto.randomUUID(),
    scanId,
    advisoryId: advisory.id,
    aliases: advisory.aliases ?? [],
    title: advisory.summary ?? advisory.id,
    details: advisory.details ?? 'Read the linked OSV advisory for details.',
    package: dependency.name,
    version: dependency.version,
    ecosystem: dependency.ecosystem,
    direct: dependency.direct,
    path: dependency.path,
    severity,
    score: advisory.database_specific?.cvss?.score ?? null,
    fixedVersions,
    references: (advisory.references ?? [])
      .map((item) => item.url)
      .filter((url) => url.startsWith('https://')),
    project,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}
