import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { Dependency } from '../shared/types'
import type { Env } from './env'
import { scanDependencies, toFinding } from './osv'
import type { ScanRow } from './store'

export class ScanWorkflow extends WorkflowEntrypoint<Env, { scanId: string }> {
  async run(event: WorkflowEvent<{ scanId: string }>, step: WorkflowStep) {
    const { scanId } = event.payload
    try {
      const scan = await step.do('start', async () => {
        const row = await this.env.DB.prepare('SELECT * FROM scans WHERE id = ?')
          .bind(scanId)
          .first<ScanRow>()
        if (!row) throw new Error('Scan not found.')
        await this.env.DB.prepare("UPDATE scans SET status = 'scanning', error = NULL WHERE id = ?")
          .bind(scanId)
          .run()
        return row
      })
      const dependencyCount = scan.dependency_count
      for (let offset = 0; offset < dependencyCount; offset += 25) {
        await step.do(
          `dependencies-${offset}`,
          {
            retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' },
            timeout: '5 minutes',
          },
          async () => {
            const artifact = await this.env.ARTIFACTS.get(`${scan.artifact_key}/dependencies.json`)
            if (!artifact) throw new Error('Scan artifact is missing.')
            const dependencies = await artifact.json<Dependency[]>()
            await scanDependencies(dependencies.slice(offset, offset + 25), async (matches) => {
              if (!matches.length) return
              const findings = matches.map(({ dependency, advisory }) =>
                toFinding(dependency, advisory, scanId, scan.project),
              )
              for (let start = 0; start < findings.length; start += 50) {
                await this.env.DB.batch(
                  findings
                    .slice(start, start + 50)
                    .map((finding) =>
                      this.env.DB.prepare(
                        'INSERT OR IGNORE INTO findings (id, scan_id, advisory_id, package, severity, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      ).bind(
                        finding.id,
                        scanId,
                        finding.advisoryId,
                        finding.package,
                        finding.severity,
                        JSON.stringify(finding),
                        finding.createdAt,
                      ),
                    ),
                )
              }
            })
          },
        )
      }
      await step.do('complete', async () => {
        await this.env.DB.prepare(
          "UPDATE scans SET status = 'completed', completed_at = ?, finding_count = (SELECT COUNT(*) FROM findings WHERE scan_id = ?) WHERE id = ?",
        )
          .bind(new Date().toISOString(), scanId, scanId)
          .run()
      })
    } catch (error) {
      await step.do('record-failure', async () => {
        await this.env.DB.prepare(
          "UPDATE scans SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
        )
          .bind(
            error instanceof Error ? error.message.slice(0, 500) : 'Scan failed. Please try again.',
            new Date().toISOString(),
            scanId,
          )
          .run()
      })
      throw error
    }
  }
}
