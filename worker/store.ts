import type { Finding, Scan } from '../shared/types'
import type { Env } from './env'
import { listSchedules } from './schedules'

export interface ScanRow {
  id: string
  project: string
  filename: string
  status: Scan['status']
  dependency_count: number
  finding_count: number
  artifact_key: string
  warnings: string
  error: string | null
  created_at: string
  completed_at: string | null
  trigger?: 'manual' | 'scheduled'
  schedule_id?: string | null
}

export interface FindingRow {
  id: string
  scan_id: string
  data: string
  status: Finding['status']
  analysis: string | null
}

export function readScan(row: ScanRow): Scan {
  return {
    id: row.id,
    project: row.project,
    filename: row.filename,
    status: row.status,
    dependencyCount: row.dependency_count,
    findingCount: row.finding_count,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    error: row.error,
    warnings: JSON.parse(row.warnings),
    trigger: row.trigger ?? 'manual',
    scheduleId: row.schedule_id ?? null,
  }
}

export function readFinding(row: FindingRow): Finding {
  return { ...JSON.parse(row.data), status: row.status, analysis: row.analysis ?? undefined }
}

export async function workspace(env: Env) {
  const [scans, findings, schedules] = await Promise.all([
    env.DB.prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT 100').all<ScanRow>(),
    env.DB.prepare(
      `SELECT f.* FROM findings f JOIN scans s ON f.scan_id = s.id WHERE s.status = 'completed' AND s.id = (SELECT latest.id FROM scans latest WHERE latest.project = s.project AND latest.status = 'completed' ORDER BY latest.created_at DESC LIMIT 1) ORDER BY f.created_at DESC`,
    ).all<FindingRow>(),
    listSchedules(env),
  ])
  return {
    scans: scans.results.map(readScan),
    findings: findings.results.map(readFinding),
    schedules,
  }
}
