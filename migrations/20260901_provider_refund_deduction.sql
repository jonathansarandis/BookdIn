-- Per-job, per-provider payout deduction — e.g. the customer got a $70 partial
-- refund after the job was completed, and that comes off the subcontractor's
-- pay rather than the business absorbing it alone. Cents, nullable (null/0 =
-- no deduction). Distinct from weekly_costs.refunds, which is a business-level
-- weekly total unrelated to any specific provider's payout.
alter table jobs add column if not exists provider_refund_deduction integer;
