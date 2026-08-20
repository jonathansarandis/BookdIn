-- The recurring_schedules table (and jobs.recurring_schedule_id) only ever existed in
-- src/lib/supabase/schema.sql — the reference/baseline schema file — with no standalone
-- migration that actually ran it against the live database. That's almost certainly why
-- "recurring is still not working" even after the booking-route fix: the code now tries
-- to insert into recurring_schedules, but the table itself was never created live.
--
-- Everything below is written to be safe to run whether or not any piece of this already
-- exists (idempotent), so it's safe to just run the whole file.

create table if not exists recurring_schedules (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  business_id         uuid not null references businesses(id) on delete cascade,
  customer_id         uuid not null references customers(id),
  service_id          uuid not null references services(id),
  address_id          uuid not null references addresses(id),
  provider_id         uuid references providers(id),
  frequency           text not null,
  next_scheduled_at   timestamptz not null,
  is_active           boolean default true,
  paused_until        timestamptz,
  price               integer not null default 0,
  auto_charge         boolean default true,
  notes               text
);

alter table jobs add column if not exists recurring_schedule_id uuid;

do $$
begin
  alter table jobs add constraint jobs_recurring_schedule_id_fkey
    foreign key (recurring_schedule_id) references recurring_schedules(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table recurring_schedules enable row level security;

drop policy if exists "recurring_business" on recurring_schedules;
create policy "recurring_business" on recurring_schedules for all
  using (business_id = get_my_business_id());

-- Sanity check — run this after the above and confirm it returns a row with no error
-- (count will be 0 on a fresh table, that's fine, it just proves the table exists now).
select count(*) from recurring_schedules;
