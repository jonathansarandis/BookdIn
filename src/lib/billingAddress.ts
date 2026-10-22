// Billing address is stored on invoices as one text line: "line1, City STATE 1234".
export interface BillingAddressParts { line1: string; city: string; state: string; postcode: string }

export const emptyBilling: BillingAddressParts = { line1: '', city: '', state: '', postcode: '' }

export function formatBillingAddress(a: BillingAddressParts): string {
  const locality = [a.city, a.state, a.postcode].map(x => (x || '').trim()).filter(Boolean).join(' ')
  return [a.line1.trim(), locality].filter(Boolean).join(', ')
}

// Best-effort split of a saved string back into fields for editing; anything it can't
// parse is kept whole in line1 so nothing is lost.
export function parseBillingAddress(text?: string | null): BillingAddressParts {
  const t = (text || '').replace(/\n+/g, ', ').trim()
  if (!t) return { ...emptyBilling }
  const m = t.match(/^(.*?),\s*([^,]+?)\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})$/i)
  if (m) return { line1: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] }
  return { line1: t, city: '', state: '', postcode: '' }
}
