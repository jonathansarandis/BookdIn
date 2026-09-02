-- Recurring booking reconciliation rewrite (src/lib/recurring/materialize.ts).
--
-- The old materializer walked a single forward-only cursor
-- (recurring_schedules.next_scheduled_at) that, once advanced past a date,
-- never revisited it — so a job that was later cancelled, rescheduled away,
-- or hard-deleted left a permanent gap that nothing ever backfilled. It also
-- deduped by customer+service+date without checking status, so a cancelled
-- job still "counted" as that week's occurrence forever.
--
-- The new logic re-derives the full set of expected occurrence dates from an
-- immutable anchor_date every run (not a mutable cursor), and reconciles
-- against whatever's actually on the calendar right now. anchor_date is the
-- schedule's true first occurrence and is never modified after creation.
alter table recurring_schedules add column if not exists anchor_date timestamptz;

update recurring_schedules rs
set anchor_date = coalesce(
  (select min(j.scheduled_at) from jobs j where j.recurring_schedule_id = rs.id and j.status != 'cancelled'),
  rs.next_scheduled_at,
  rs.created_at
)
where anchor_date is null;

alter table recurring_schedules alter column anchor_date set not null;
