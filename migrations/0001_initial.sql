CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'scanning', 'completed', 'failed')),
  dependency_count INTEGER NOT NULL DEFAULT 0,
  finding_count INTEGER NOT NULL DEFAULT 0,
  artifact_key TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  advisory_id TEXT NOT NULL,
  package TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ignored')),
  data TEXT NOT NULL,
  analysis TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX findings_scan_id ON findings(scan_id);
CREATE INDEX findings_status ON findings(status);
CREATE INDEX scans_created_at ON scans(created_at DESC);
CREATE UNIQUE INDEX findings_identity ON findings(scan_id, advisory_id, package, json_extract(data, '$.path'), json_extract(data, '$.version'));
