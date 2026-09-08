-- Documents jobs.location_id, which already exists as a NOT NULL column on the
-- live database but was never captured in any tracked migration (schema
-- drift — same pattern as recurring_schedules.location_id, fixed in
-- 20260908_document_recurring_schedules_location_id.sql). Already flagged
-- in-repo at src/app/api/jobs/[id]/follow-up-charge/route.ts:
--   "schema.sql is out of sync with prod for jobs.parent_job_id and jobs.location_id"
--
-- This is the second half of the recurring-bookings root cause: once
-- recurring_schedules rows could finally be created (previous migration),
-- materializeRecurringJobs' own `jobs` insert was STILL missing location_id,
-- so every future occurrence it tried to create failed the same NOT NULL
-- constraint, silently, one level deeper. Schedules existed; their jobs never
-- did. Fixed in src/lib/recurring/materialize.ts alongside this migration.
--
-- No-op against the live database (the column already exists) — exists purely
-- so the schema is correctly documented going forward.
alter table jobs
  add column if not exists location_id uuid references locations(id);
