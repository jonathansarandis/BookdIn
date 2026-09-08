-- Documents recurring_schedules.location_id, which already exists as a NOT NULL
-- column on the live database but was never captured in any tracked migration
-- (schema drift — added directly against the DB at some point, outside this
-- migrations/ directory). This is the actual root cause of recurring bookings
-- silently never repeating: every INSERT into recurring_schedules from every
-- code path (bookings/admin create + edit branches, voice/vapi, the
-- backfill-recurring-schedules repair route) omitted this column, so every one
-- of those inserts was failing the NOT NULL constraint. The failure was caught
-- by a non-critical try/catch and only ever console.error'd — the booking
-- itself still succeeded, so nothing looked broken until a customer noticed
-- they were never rebooked for their next occurrence.
--
-- This migration is a no-op against the live database (the column already
-- exists) — it exists purely so the schema is correctly documented going
-- forward and this doesn't happen again on a fresh environment.
alter table recurring_schedules
  add column if not exists location_id uuid references locations(id);
