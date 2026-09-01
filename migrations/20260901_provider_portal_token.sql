-- Persistent, no-password provider portal login (replaces the Supabase Auth
-- invite/magic-link + password flow, which was expiring on subcontractors
-- every couple of days and forcing them to recreate their password on every
-- re-sent link — see /provider/portal/[token]/route.ts).
--
-- One random token per provider, no expiry. Requires pgcrypto's
-- gen_random_bytes(), which is enabled by default on Supabase projects.
alter table providers add column if not exists portal_token text unique;

update providers set portal_token = encode(gen_random_bytes(32), 'hex') where portal_token is null;
