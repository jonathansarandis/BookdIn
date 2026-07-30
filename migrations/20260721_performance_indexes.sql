-- Migration: performance indexes on hot query paths (Reyan #1)
--
-- All CREATE INDEX IF NOT EXISTS — idempotent and safe to run even if some
-- already exist in prod (they simply no-op). Targets the columns the app
-- filters/sorts on most: the jobs list, calendar, dashboard, provider portal,
-- and the customer import dedup lookup.
--
-- NOTE: this addresses DB-side query cost. The larger perceived-slowness lever
-- is that most pages render client-side and fetch in useEffect (waterfalls);
-- that's a separate, bigger refactor — flagged, not done here.

-- jobs: the biggest, most-queried table
CREATE INDEX IF NOT EXISTS jobs_business_id_idx        ON jobs(business_id);
CREATE INDEX IF NOT EXISTS jobs_business_scheduled_idx ON jobs(business_id, scheduled_at);
CREATE INDEX IF NOT EXISTS jobs_provider_id_idx        ON jobs(provider_id);        -- provider portal
CREATE INDEX IF NOT EXISTS jobs_customer_id_idx        ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx             ON jobs(status);

-- customers: list + import dedup (.eq(business_id).eq(email))
CREATE INDEX IF NOT EXISTS customers_business_id_idx    ON customers(business_id);
CREATE INDEX IF NOT EXISTS customers_business_email_idx ON customers(business_id, email);

-- addresses: joined by customer on booking/import paths
CREATE INDEX IF NOT EXISTS addresses_customer_id_idx ON addresses(customer_id);

-- activity_logs: dashboard reads latest N per business
CREATE INDEX IF NOT EXISTS activity_logs_business_created_idx ON activity_logs(business_id, created_at DESC);

-- job_extras: fetched per job
CREATE INDEX IF NOT EXISTS job_extras_job_id_idx ON job_extras(job_id);

-- providers: provider-portal auth resolves by user_id
CREATE INDEX IF NOT EXISTS providers_user_id_idx     ON providers(user_id);
CREATE INDEX IF NOT EXISTS providers_business_id_idx ON providers(business_id);

-- service_extras: fetched per service on editor/booking
CREATE INDEX IF NOT EXISTS service_extras_service_id_idx ON service_extras(service_id);
