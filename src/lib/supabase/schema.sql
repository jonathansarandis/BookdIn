-- ============================================================
-- CLEANLY — Full Database Schema
-- Paste this into Supabase → SQL Editor → Run
-- ============================================================
--
-- TODO: schema.sql is currently out of sync with the live DB. The following
-- columns exist in production but are not recorded here:
--   jobs: total_price, payment_status, payment_method, paid_at, bedrooms, bathrooms
-- A reconciliation pass is needed before this file can be used as a reliable reference.

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── BUSINESSES ────────────────────────────────────────────
create table if not exists businesses (
  id                        uuid primary key default uuid_generate_v4(),
  created_at                timestamptz default now(),
  name                      text not null,
  slug                      text unique not null,
  logo_url                  text,
  brand_color               text default '#1A6B4A',
  industry                  text not null default 'residential_cleaning',
  timezone                  text not null default 'America/New_York',
  currency                  text not null default 'USD',
  owner_id                  uuid references auth.users(id) on delete cascade,
  stripe_account_id         text,
  stripe_onboarded          boolean default false,
  resend_domain             text,
  booking_url_slug          text unique,
  service_area_description  text,
  cancellation_policy       text,
  default_payment_method    text default 'charge_now',
  tax_rate                  numeric(5,4) default 0,
  tax_name                  text default 'Tax',
  show_tax                  boolean default true
);

-- ─── PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz default now(),
  email               text not null,
  full_name           text not null default '',
  phone               text,
  avatar_url          text,
  role                text not null default 'owner',
  business_id         uuid references businesses(id) on delete set null,
  onboarding_complete boolean default false
);

-- ─── CUSTOMERS ─────────────────────────────────────────────
create table if not exists customers (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  business_id         uuid not null references businesses(id) on delete cascade,
  email               text not null,
  full_name           text not null,
  phone               text,
  notes               text,
  tags                text[] default '{}',
  stripe_customer_id  text,
  referral_code       text unique,
  referred_by         uuid references customers(id),
  lifetime_value      integer default 0,
  total_bookings      integer default 0,
  last_booking_at     timestamptz,
  unique(business_id, email)
);

-- ─── ADDRESSES ─────────────────────────────────────────────
create table if not exists addresses (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  label       text,
  line1       text not null,
  line2       text,
  city        text not null,
  state       text not null,
  postcode    text not null,
  country     text not null default 'US',
  notes       text,
  is_default  boolean default false
);

-- ─── SERVICES ──────────────────────────────────────────────
create table if not exists services (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz default now(),
  business_id      uuid not null references businesses(id) on delete cascade,
  name             text not null,
  description      text,
  pricing_type     text not null default 'flat',
  base_price       integer not null default 0,  -- stored in cents
  duration_minutes integer not null default 120,
  min_price        integer,
  travel_fee       integer default 0,
  same_day_fee     integer default 0,
  weekend_fee      integer default 0,
  tax_included     boolean default false,
  is_active        boolean default true,
  sort_order       integer default 0
);

-- ─── SERVICE EXTRAS ────────────────────────────────────────
create table if not exists service_extras (
  id               uuid primary key default uuid_generate_v4(),
  service_id       uuid not null references services(id) on delete cascade,
  business_id      uuid not null references businesses(id) on delete cascade,
  name             text not null,
  description      text,
  price            integer not null default 0,
  duration_minutes integer default 0,
  is_active        boolean default true,
  sort_order       integer default 0
);

-- ─── FREQUENCY DISCOUNTS ───────────────────────────────────
create table if not exists frequency_discounts (
  id               uuid primary key default uuid_generate_v4(),
  service_id       uuid not null references services(id) on delete cascade,
  frequency        text not null,
  discount_percent numeric(5,2) not null default 0,
  unique(service_id, frequency)
);

-- ─── PROVIDERS ─────────────────────────────────────────────
create table if not exists providers (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  business_id   uuid not null references businesses(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete set null,
  display_name  text not null,
  email         text not null,
  phone         text,
  color         text default '#1A6B4A',
  is_active     boolean default true,
  accept_jobs   boolean default true,
  notes         text,
  location_id   uuid not null references locations(id)
);

-- ─── JOBS ──────────────────────────────────────────────────
create table if not exists jobs (
  id                      uuid primary key default uuid_generate_v4(),
  created_at              timestamptz default now(),
  business_id             uuid not null references businesses(id) on delete cascade,
  customer_id             uuid not null references customers(id),
  address_id              uuid not null references addresses(id),
  service_id              uuid not null references services(id),
  provider_id             uuid references providers(id),
  status                  text not null default 'pending',
  scheduled_at            timestamptz not null,
  duration_minutes        integer not null default 120,
  price                   integer not null default 0,
  tax_amount              integer default 0,
  notes                   text,
  customer_notes          text,
  booking_source          text default 'admin',
  frequency               text not null default 'one_time',
  recurring_schedule_id   uuid,
  stripe_payment_intent_id text,
  invoice_id              uuid,
  completed_at            timestamptz,
  bedrooms                integer,
  bathrooms               integer
);

-- ─── JOB EXTRAS ────────────────────────────────────────────
create table if not exists job_extras (
  id       uuid primary key default uuid_generate_v4(),
  job_id   uuid not null references jobs(id) on delete cascade,
  extra_id uuid references service_extras(id),
  name     text not null,
  price    integer not null default 0
);

-- ─── RECURRING SCHEDULES ───────────────────────────────────
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

-- add FK back to jobs
alter table jobs add constraint jobs_recurring_schedule_id_fkey
  foreign key (recurring_schedule_id) references recurring_schedules(id) on delete set null;

-- ─── INVOICES ──────────────────────────────────────────────
create table if not exists invoices (
  id                       uuid primary key default uuid_generate_v4(),
  created_at               timestamptz default now(),
  business_id              uuid not null references businesses(id) on delete cascade,
  customer_id              uuid not null references customers(id),
  job_id                   uuid references jobs(id),
  status                   text not null default 'draft',
  subtotal                 integer not null default 0,
  tax_amount               integer default 0,
  total                    integer not null default 0,
  due_date                 timestamptz,
  paid_at                  timestamptz,
  stripe_payment_intent_id text,
  notes                    text,
  sent_at                  timestamptz
);

alter table jobs add constraint jobs_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

-- ─── QUOTES ────────────────────────────────────────────────
create table if not exists quotes (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id),
  status      text not null default 'draft',
  subtotal    integer not null default 0,
  tax_amount  integer default 0,
  total       integer not null default 0,
  valid_until timestamptz,
  notes       text,
  sent_at     timestamptz,
  viewed_at   timestamptz,
  accepted_at timestamptz
);

-- ─── DISCOUNT CODES ────────────────────────────────────────
create table if not exists discount_codes (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  business_id     uuid not null references businesses(id) on delete cascade,
  code            text not null,
  type            text not null default 'percent',
  value           numeric(10,2) not null,
  min_order       integer,
  first_time_only boolean default false,
  max_uses        integer,
  uses_count      integer default 0,
  expires_at      timestamptz,
  service_id      uuid references services(id),
  is_active       boolean default true,
  unique(business_id, code)
);

-- ─── ACTIVITY LOGS ─────────────────────────────────────────
create table if not exists activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  business_id uuid not null references businesses(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  actor_name  text,
  event_type  text not null,
  description text not null,
  metadata    jsonb,
  entity_type text,
  entity_id   uuid
);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
alter table businesses        enable row level security;
alter table profiles          enable row level security;
alter table customers         enable row level security;
alter table addresses         enable row level security;
alter table services          enable row level security;
alter table service_extras    enable row level security;
alter table frequency_discounts enable row level security;
alter table providers         enable row level security;
alter table jobs              enable row level security;
alter table job_extras        enable row level security;
alter table recurring_schedules enable row level security;
alter table invoices          enable row level security;
alter table quotes            enable row level security;
alter table discount_codes    enable row level security;
alter table activity_logs     enable row level security;

-- Profiles: users can read/update their own profile
create policy "profiles_own" on profiles for all using (auth.uid() = id);

-- Businesses: owner can do everything; staff can read
create policy "businesses_owner" on businesses for all
  using (owner_id = auth.uid());

-- Helper function: get current user's business_id
create or replace function get_my_business_id()
returns uuid language sql stable
as $$ select business_id from profiles where id = auth.uid() limit 1 $$;

-- Generic business-scoped policies
create policy "customers_business" on customers for all
  using (business_id = get_my_business_id());
create policy "addresses_business" on addresses for all
  using (business_id = get_my_business_id());
create policy "services_business" on services for all
  using (business_id = get_my_business_id());
create policy "service_extras_business" on service_extras for all
  using (business_id = get_my_business_id());
create policy "frequency_discounts_business" on frequency_discounts for all
  using (service_id in (select id from services where business_id = get_my_business_id()));
create policy "providers_business" on providers for all
  using (business_id = get_my_business_id());
create policy "jobs_business" on jobs for all
  using (business_id = get_my_business_id());
create policy "job_extras_business" on job_extras for all
  using (job_id in (select id from jobs where business_id = get_my_business_id()));
create policy "recurring_business" on recurring_schedules for all
  using (business_id = get_my_business_id());
create policy "invoices_business" on invoices for all
  using (business_id = get_my_business_id());
create policy "quotes_business" on quotes for all
  using (business_id = get_my_business_id());
create policy "discounts_business" on discount_codes for all
  using (business_id = get_my_business_id());
create policy "activity_business" on activity_logs for all
  using (business_id = get_my_business_id());

-- ─── TRIGGER: create profile + business on signup ──────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  biz_id uuid;
  biz_slug text;
  biz_name text;
begin
  biz_name := coalesce(new.raw_user_meta_data->>'business_name', 'My Business');
  biz_slug := lower(regexp_replace(biz_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 6);

  insert into businesses (name, slug, booking_url_slug, owner_id, industry)
  values (
    biz_name,
    biz_slug,
    biz_slug,
    new.id,
    coalesce(new.raw_user_meta_data->>'industry', 'residential_cleaning')
  ) returning id into biz_id;

  insert into profiles (id, email, full_name, role, business_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'owner',
    biz_id
  );

  -- Seed default services for residential cleaning
  if (new.raw_user_meta_data->>'industry' = 'residential_cleaning' or new.raw_user_meta_data->>'industry' is null) then
    insert into services (business_id, name, description, pricing_type, base_price, duration_minutes, sort_order)
    values
      (biz_id, 'Standard Clean', 'Regular home cleaning service', 'room_based', 12000, 120, 0),
      (biz_id, 'Deep Clean', 'Thorough deep cleaning of entire home', 'room_based', 22000, 240, 1),
      (biz_id, 'Move-out Clean', 'End of lease / move-out clean', 'flat', 38000, 300, 2),
      (biz_id, 'Office Clean', 'Commercial / office cleaning', 'flat', 20000, 120, 3);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── INDEXES ───────────────────────────────────────────────
create index if not exists idx_jobs_business_scheduled on jobs(business_id, scheduled_at);
create index if not exists idx_jobs_status on jobs(business_id, status);
create index if not exists idx_jobs_customer on jobs(customer_id);
create index if not exists idx_customers_business on customers(business_id);
create index if not exists idx_activity_business on activity_logs(business_id, created_at desc);
create index if not exists idx_invoices_business on invoices(business_id, status);
