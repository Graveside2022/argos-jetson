-- Migration 008: Mission Strip metadata (spec-024 PR5).
-- Adds operator / target / link_budget so the OVERVIEW MissionStrip
-- can render and PATCH editable engagement metadata. All nullable so
-- pre-existing rows from migration 20260412 stay valid; no backfill.
--
-- One ALTER per column is required by SQLite — `ALTER TABLE ADD COLUMN`
-- only adds one column at a time. run-migrations.ts wraps the whole
-- file in a transaction, and isDuplicateColumnError() lets a partial
-- replay silently skip already-applied columns.

ALTER TABLE missions ADD COLUMN operator TEXT;
ALTER TABLE missions ADD COLUMN target TEXT;
ALTER TABLE missions ADD COLUMN link_budget REAL;
