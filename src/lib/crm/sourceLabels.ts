// Display labels for the shared source taxonomy (paid_search/organic/referral/
// direct/returning/social/email/manual), plus the two legacy free-text values
// ('website', 'admin') that predate this taxonomy — used by /reports/leads,
// crm/[id], and crm/new so the same value always reads the same way everywhere.
export const SOURCE_LABELS: Record<string, string> = {
  paid_search: 'Google Ads',
  organic: 'Organic',
  referral: 'Referral',
  direct: 'Direct',
  returning: 'Returning',
  social: 'Social media',
  email: 'Email campaign',
  manual: 'Manual',
  website: 'Website (legacy)',
  admin: 'Admin (legacy)',
}

export function formatSourceLabel(source: string | null | undefined): string {
  if (!source) return ''
  return SOURCE_LABELS[source] || source
}
