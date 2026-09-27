-- Add a free-text `location` field to crm_contacts, captured at contact
-- creation time and editable from the contact detail page.

alter table crm_contacts add column if not exists location text;
