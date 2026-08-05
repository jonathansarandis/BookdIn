-- CRM leads upgrade: source + lost-reason tracking.
--
-- `source` and `lost_reason` already exist on crm_contacts (verified against
-- production — all 119 existing contacts have `source` set to 'website' or
-- 'admin', and `lost_reason` is present but null on every row since it was
-- never actually written to). These two lines are no-ops on this database;
-- included with `if not exists` so this migration is safe to run standalone
-- on any environment, including ones that don't already have them.
--
-- `lost_reason_notes` is the one genuinely new column — free-text detail
-- captured when someone picks "Other" in the lost-reason modal.

alter table crm_contacts add column if not exists source text;
alter table crm_contacts add column if not exists lost_reason text;
alter table crm_contacts add column if not exists lost_reason_notes text;
