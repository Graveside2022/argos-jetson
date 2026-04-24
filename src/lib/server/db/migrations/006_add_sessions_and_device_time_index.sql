-- Sessions + session_id on signals for Flying-Squirrel-style RF visualization.
-- Kismet start (and an operator "New Session" action) roll a new session_id;
-- the /api/rf/aggregate layer filters heatmap/centroids/path per session.

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    label TEXT,
    source TEXT NOT NULL,       -- 'kismet-start' | 'manual' | 'legacy'
    metadata TEXT               -- JSON
);

-- Legacy bucket for all pre-migration signals.
INSERT OR IGNORE INTO sessions (id, started_at, source, label)
VALUES ('legacy', 0, 'legacy', 'Pre-session data');

-- Nullable on purpose: new rows get filled in at insert time; old rows
-- backfill to 'legacy'. run-migrations handles duplicate-column silently.
ALTER TABLE signals ADD COLUMN session_id TEXT REFERENCES sessions(id);

UPDATE signals SET session_id = 'legacy' WHERE session_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_signals_session ON signals(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_device_time ON signals(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
