import { describe, expect, it, vi } from 'vitest'
import {
  nextOccurrence,
  readSchedule,
  runSchedule,
  scheduledScanId,
  validateSchedule,
  type ScheduleRow,
} from '../worker/schedules'
import type { Env } from '../worker/env'

const now = Date.parse('2026-10-31T12:00:00.000Z')

describe('recurring scans', () => {
  it('validates future schedules and rejects unsupported frequencies and prototype keys', () => {
    expect(
      validateSchedule(
        {
          name: ' daily check ',
          project: 'api',
          frequency: 'daily',
          nextRunAt: '2026-10-31T17:00:00+04:00',
        },
        now,
      ),
    ).toMatchObject({ name: 'daily check', nextRunAt: '2026-10-31T13:00:00.000Z' })
    expect(() =>
      validateSchedule(
        { name: 'check', project: 'api', frequency: 'toString', nextRunAt: '2026-11-01T00:00:00Z' },
        now,
      ),
    ).toThrow('hourly, daily, or weekly')
    expect(() =>
      validateSchedule(
        { name: 'check', project: 'api', frequency: 'daily', nextRunAt: '2026-10-30T00:00:00Z' },
        now,
      ),
    ).toThrow('future')
  })

  it('skips missed intervals while preserving the recurrence anchor', () => {
    expect(nextOccurrence('2026-10-31T08:30:00.000Z', 'hourly', now)).toBe(
      '2026-10-31T12:30:00.000Z',
    )
    expect(nextOccurrence('2026-10-28T09:00:00.000Z', 'daily', now)).toBe(
      '2026-11-01T09:00:00.000Z',
    )
    expect(nextOccurrence('2026-10-01T09:00:00.000Z', 'weekly', now)).toBe(
      '2026-11-05T09:00:00.000Z',
    )
  })

  it('uses the same workflow identity when the same occurrence is retried', async () => {
    const first = await scheduledScanId('schedule', '2026-10-31T12:00:00.000Z')
    expect(first).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/)
    expect(await scheduledScanId('schedule', '2026-10-31T12:00:00.000Z')).toBe(first)
    expect(await scheduledScanId('schedule', '2026-11-01T12:00:00.000Z')).not.toBe(first)
  })

  it('does not dispatch when another scheduler has already claimed the occurrence', async () => {
    const create = vi.fn()
    const env = {
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) },
      SCAN_WORKFLOW: { create },
    } as unknown as Env
    await expect(runSchedule('schedule', env, now, '2026-10-31T12:00:00.000Z')).rejects.toThrow(
      'already been claimed',
    )
    expect(create).not.toHaveBeenCalled()
  })

  it('exposes workflow failures in schedule history', () => {
    const row = {
      enabled: 0,
      last_error: null,
      scan_error: 'osv unavailable',
      last_scan_status: 'failed',
    } as ScheduleRow
    expect(readSchedule(row)).toMatchObject({
      enabled: false,
      lastError: 'osv unavailable',
      lastScanStatus: 'failed',
    })
  })
})
