export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
export type FindingStatus = 'open' | 'ignored'

export interface Dependency {
  name: string
  version: string
  ecosystem: 'npm' | 'PyPI'
  direct: boolean
  path: string
}

export interface Finding {
  id: string
  scanId: string
  advisoryId: string
  aliases: string[]
  title: string
  details: string
  package: string
  version: string
  ecosystem: 'npm' | 'PyPI'
  direct: boolean
  path: string
  severity: Severity
  score: number | null
  fixedVersions: string[]
  references: string[]
  project: string
  status: FindingStatus
  createdAt: string
  analysis?: string
}

export interface Scan {
  id: string
  project: string
  filename: string
  status: 'queued' | 'scanning' | 'completed' | 'failed'
  dependencyCount: number
  findingCount: number
  createdAt: string
  completedAt: string | null
  error: string | null
  warnings: string[]
  trigger?: 'manual' | 'scheduled'
  scheduleId?: string | null
}

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly'

export interface ScanSchedule {
  id: string
  name: string
  project: string
  frequency: ScheduleFrequency
  enabled: boolean
  nextRunAt: string
  lastRunAt: string | null
  lastScanId: string | null
  lastScanStatus: Scan['status'] | null
  lastError: string | null
  createdAt: string
}

export interface Workspace {
  scans: Scan[]
  findings: Finding[]
  schedules: ScanSchedule[]
}

export const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'unknown']
