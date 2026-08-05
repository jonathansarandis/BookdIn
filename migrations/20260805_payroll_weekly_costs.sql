-- Payroll / weekly profit reporting, replacing the contractor pay spreadsheet.
--
-- providers.payout_percent already exists (0-100 percent of pre-GST job price)
-- and is already wired through src/lib/pricing.ts's getProviderPayout() — no
-- new "pay_rate" field needed there.
--
-- jobs.provider_fee_extra already exists (a flat cents add-on) — distinct from
-- pay_rate_override below, which replaces the *percentage* for one job.

alter table jobs add column if not exists pay_rate_override numeric;
alter table jobs add column if not exists cash_paid integer not null default 0; -- cents, paid directly to the cleaner outside the system
alter table jobs add column if not exists provider_paid_at timestamptz;         -- when this job's payout was marked paid (distinct from customer-side paid_at)

-- One row per location per ISO week (Monday start). Revenue and subcontractor
-- pay are computed live from jobs; these are the manually-entered expense
-- lines the spreadsheet also tracks by hand.
create table if not exists weekly_costs (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  location_id        uuid not null references locations(id) on delete cascade,
  week_start         date not null, -- Monday
  ad_spend           integer not null default 0, -- cents
  admin_pay          integer not null default 0, -- cents
  subscription_fees  integer not null default 0, -- cents
  perf_max_spend     integer not null default 0, -- cents
  refunds            integer not null default 0, -- cents
  other_costs        integer not null default 0, -- cents
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (location_id, week_start)
);

alter table weekly_costs enable row level security;
create policy "weekly_costs_business" on weekly_costs for all
  using (business_id = get_my_business_id());
