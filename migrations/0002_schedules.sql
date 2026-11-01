ALTER TABLE scans ADD COLUMN trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE scans ADD COLUMN schedule_id TEXT;

CREATE TABLE scan_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  next_run_at TEXT NOT NULL,
  last_run_at TEXT,
  last_scan_id TEXT REFERENCES scans(id),
  last_error TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX scan_schedules_due ON scan_schedules(enabled, next_run_at);
CREATE INDEX scans_schedule ON scans(schedule_id);
