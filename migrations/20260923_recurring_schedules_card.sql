-- Recurring jobs currently only carry forward provider_id from the schedule —
-- the card is stored per-job (jobs.stripe_payment_method_id), so every future
-- auto-materialized occurrence starts with no card on file even when the
-- series has one, forcing staff to re-collect it every cycle (Reyan, 23 Sep
-- 2026: "we don't need to contact the customer to get their card every week,
-- every 2 weeks or every 4 weeks"). recurring_schedules already carries the
-- customer via customer_id, whose stripe_customer_id lives on customers — the
-- one thing missing is WHICH saved payment method to use, since a customer
-- can have more than one. Storing it here mirrors how provider_id already
-- works: set once a card is attached to any occurrence, read by
-- materializeRecurringJobs() when creating the next one.
alter table recurring_schedules
  add column if not exists stripe_payment_method_id text;
