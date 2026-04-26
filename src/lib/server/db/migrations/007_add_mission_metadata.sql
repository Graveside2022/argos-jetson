-- PR-4 Flying-Squirrel mission metadata additions.
-- Every field is nullable so existing session rows (including 'legacy')
-- keep working. No backfill.

ALTER TABLE sessions ADD COLUMN operator_id TEXT;
ALTER TABLE sessions ADD COLUMN asset_id TEXT;
ALTER TABLE sessions ADD COLUMN area_name TEXT;
ALTER TABLE sessions ADD COLUMN notes TEXT;

-- Duplicate ended_at? The 006 migration already added it as `ended_at`.
-- If a schema drift ever reintroduces this, guard at the ORM layer.
