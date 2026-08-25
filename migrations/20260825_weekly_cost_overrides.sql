-- Manual overrides for the two "auto-calculated" expense lines on the weekly
-- profit report (Subcontractor pay, GST). Both are computed live from
-- completed jobs each time the report loads, but staff need to correct them
-- per week/location because the calculation doesn't capture job-level
-- customisations (add-ons, parking/fuel fees, one-off negotiated cleaner
-- rates) and some customers pay cash with no GST charged. NULL means "use
-- the calculated value" — same semantics as the existing manually-entered
-- cost fields on this table.
alter table weekly_costs
  add column if not exists subcontractor_pay_override integer,
  add column if not exists gst_override integer;
