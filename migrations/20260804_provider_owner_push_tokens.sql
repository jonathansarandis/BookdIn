-- Push notification tokens for the mobile apps.
-- providers.push_token: cleaner/team-member devices (provider portal app)
-- profiles.push_token:  owner/staff devices (admin portal app) — profiles
--   already covers everyone who gets in-app `notifications` rows today
--   (see /api/bookings/public and /api/cron/capture-payments), so this
--   reuses that same audience for push instead of introducing a new table.

alter table providers add column if not exists push_token text;
alter table profiles  add column if not exists push_token text;
