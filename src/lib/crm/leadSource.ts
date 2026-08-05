// Reuses the same taxonomy as lead_sources.source_type / ManualSourceSelector
// (paid_search | organic | referral | direct | social | email | manual) so the
// CRM's source field and the existing attribution dashboard stay consistent,
// rather than introducing a second parallel vocabulary. 'returning' is layered
// on top as a customer-relationship signal, not a traffic channel — it wins
// over whatever channel brought this particular booking in.
const SEARCH_ENGINE_HOSTS = ['google.', 'bing.', 'yahoo.', 'duckduckgo.']

export function deriveBookingLeadSource(params: {
  isExistingCustomer: boolean
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  referer?: string | null
  businessDomain?: string | null
}): string {
  if (params.isExistingCustomer) return 'returning'
  if (params.gclid || params.gbraid || params.wbraid) return 'paid_search'
  if (!params.referer) return 'direct'

  try {
    const host = new URL(params.referer).hostname.replace(/^www\./, '')
    if (params.businessDomain && host === params.businessDomain.replace(/^www\./, '')) return 'direct'
    if (SEARCH_ENGINE_HOSTS.some(s => host.includes(s))) return 'organic'
    return 'referral'
  } catch {
    return 'direct'
  }
}
