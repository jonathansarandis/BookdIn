/**
 * Shared pricing utility for BookdIn.
 *
 * Used by the admin booking form (/booking), public booking page (/book/[slug]),
 * and the service editor on the booking detail page. All three surfaces must
 * produce identical numbers for the same inputs — that invariant is enforced by
 * routing everything through calcJobPrice().
 *
 * NOTE on RoomPricingRow.type vs room_type:
 *   The actual DB column is named `type` (not `room_type`). Supabase query
 *   results arrive as { type: 'bedroom', count: 2, price: 3000 }. We use `type`
 *   here so rows can be passed directly from .from('room_pricing').select('*')
 *   without field remapping.
 */

export type PricingType = 'fixed' | 'room_based' | 'hourly' | 'sqft_based' | 'custom'

export type RoomPricingRow = {
  id: string
  service_id: string
  type: string   // 'bedroom' | 'bathroom' in practice; kept as string for forward-compat
  count: number
  price: number  // cents
}

export type PriceInput = {
  service: {
    id: string
    base_price: number      // cents
    pricing_type: PricingType
    duration_minutes: number | null
  }
  bedrooms?: number | null
  bathrooms?: number | null
  selectedExtras: Array<{ price: number; is_quote_only?: boolean; quantity?: number }>  // cents each
  roomPricing: RoomPricingRow[]             // all room_pricing rows for this service
}

export type PriceBreakdown = {
  base: number         // service base_price contribution, cents
  rooms: number        // bedroom + bathroom adders, cents
  extras: number       // sum of selected extras, cents
  total: number        // base + rooms + extras, cents
  durationMinutes: number
}

/**
 * Look up the price adder for a specific room type + count from a set of
 * room_pricing rows. Returns 0 when no matching row is configured — consistent
 * with the public booking form's getRoomPrice() fallback.
 */
export function lookupRoomPrice(
  rows: RoomPricingRow[],
  roomType: string,
  count: number,
): number {
  const match = rows.find(r => r.type === roomType && r.count === count)
  return match?.price ?? 0
}

/**
 * Calculate the total price for a job given the service, room counts, selected
 * extras, and the service's room_pricing configuration.
 *
 * All arithmetic is integer cents — no floating point.
 */
export function calcJobPrice(input: PriceInput): PriceBreakdown {
  const { service, bedrooms, bathrooms, selectedExtras, roomPricing } = input

  const base = service.base_price

  // room_based: add per-bedroom and per-bathroom adders from the room_pricing table.
  // fixed / hourly / sqft_based / custom: rooms = 0.
  // Both existing booking forms fall through to base_price for non-room_based types;
  // we maintain that behaviour here.
  let rooms = 0
  if (service.pricing_type === 'room_based') {
    const bedroomAdder  = bedrooms  != null ? lookupRoomPrice(roomPricing, 'bedroom',  bedrooms)  : 0
    const bathroomAdder = bathrooms != null ? lookupRoomPrice(roomPricing, 'bathroom', bathrooms) : 0
    rooms = bedroomAdder + bathroomAdder
  }

  const extras = selectedExtras.filter(ex => !ex.is_quote_only).reduce((sum, ex) => sum + ex.price * (ex.quantity ?? 1), 0)

  const total = base + rooms + extras

  // Duration comes from the service row only.
  // Extras have their own duration_minutes column but neither existing booking form
  // adds it to the job duration — we keep that behaviour consistent.
  const durationMinutes = service.duration_minutes ?? 0

  return { base, rooms, extras, total, durationMinutes }
}

/**
 * @example Flat pricing — no room adders, no extras
 * calcJobPrice({
 *   service: { id: 'svc1', base_price: 15000, pricing_type: 'fixed', duration_minutes: 120 },
 *   bedrooms: null, bathrooms: null,
 *   selectedExtras: [],
 *   roomPricing: [],
 * })
 * // → { base: 15000, rooms: 0, extras: 0, total: 15000, durationMinutes: 120 }
 *
 * @example Room-based pricing — 3 beds, 2 baths, two extras
 * calcJobPrice({
 *   service: { id: 'svc2', base_price: 12000, pricing_type: 'room_based', duration_minutes: 120 },
 *   bedrooms: 3, bathrooms: 2,
 *   selectedExtras: [{ price: 2500 }, { price: 1500 }],
 *   roomPricing: [
 *     { id: 'r1', service_id: 'svc2', type: 'bedroom',  count: 3, price: 5500 },
 *     { id: 'r2', service_id: 'svc2', type: 'bathroom', count: 2, price: 2500 },
 *   ],
 * })
 * // base=12000 + rooms=(5500+2500)=8000 + extras=(2500+1500)=4000
 * // → { base: 12000, rooms: 8000, extras: 4000, total: 24000, durationMinutes: 120 }
 *
 * @example Room-based, count not in room_pricing (lookupRoomPrice returns 0)
 * calcJobPrice({
 *   service: { id: 'svc2', base_price: 12000, pricing_type: 'room_based', duration_minutes: 120 },
 *   bedrooms: 6, bathrooms: 1,
 *   selectedExtras: [],
 *   roomPricing: [
 *     { id: 'r1', service_id: 'svc2', type: 'bedroom',  count: 3, price: 5500 },
 *   ],
 * })
 * // No row for bedroom count=6 or bathroom count=1 → both adders = 0
 * // → { base: 12000, rooms: 0, extras: 0, total: 12000, durationMinutes: 120 }
 *
 * @example Hourly / sqft_based / custom — treated identically to flat (rooms = 0)
 * calcJobPrice({
 *   service: { id: 'svc3', base_price: 8000, pricing_type: 'hourly', duration_minutes: 60 },
 *   bedrooms: null, bathrooms: null,
 *   selectedExtras: [{ price: 500 }],
 *   roomPricing: [],
 * })
 * // → { base: 8000, rooms: 0, extras: 500, total: 8500, durationMinutes: 60 }
 *
 * @example Flat pricing with extras
 * calcJobPrice({
 *   service: { id: 'svc1', base_price: 15000, pricing_type: 'fixed', duration_minutes: 120 },
 *   bedrooms: null, bathrooms: null,
 *   selectedExtras: [{ price: 3500 }],
 *   roomPricing: [],
 * })
 * // → { base: 15000, rooms: 0, extras: 3500, total: 18500, durationMinutes: 120 }
 */

// ─── Charge-amount resolution ─────────────────────────────────────────────────

/**
 * Returns the amount to charge in cents for a job.
 * price_override (manually set by an operator) wins over the system-derived total_price.
 */
export function getChargeableAmount(job: {
  price_override?: number | null
  total_price?: number | null
  price?: number | null
}): number {
  return job.price_override ?? job.total_price ?? job.price ?? 0
}

// ─── Provider payout ─────────────────────────────────────────────────────────

/**
 * Compute the provider's payout in cents for a single job.
 *
 * payout = floor(preGstBase × payout_percent/100) + provider_fee_extra
 *
 * preGstBase uses the override-aware gross (getChargeableAmount), re-deriving the
 * pre-tax amount from the override when one exists — because tax_amount was computed
 * from the original total and is stale in that case.
 *
 * taxRate is a percentage integer (e.g. 10 for 10% GST).
 * taxMode must match the business setting — 'exclusive' is the common AU case.
 */
export function getProviderPayout(
  job: {
    price_override?: number | null
    total_price?: number | null
    price?: number | null
    tax_amount?: number | null
    provider_fee_extra?: number | null
  },
  provider: { payout_percent?: number | null },
  taxRate: number,
  taxMode: 'exclusive' | 'inclusive',
): number {
  const chargeable = getChargeableAmount(job)

  let preGstBase: number
  if (job.price_override != null) {
    preGstBase = taxRate > 0
      ? Math.round(chargeable * 100 / (100 + taxRate))
      : chargeable
  } else {
    preGstBase = (job.total_price ?? job.price ?? 0) - (job.tax_amount ?? 0)
  }

  const pct = provider.payout_percent ?? 0
  return Math.round(preGstBase * pct / 100) + (job.provider_fee_extra ?? 0)
}

// ─── Post-calcJobPrice helpers ────────────────────────────────────────────────

/**
 * Apply a frequency discount to a subtotal.
 * discountPct is an integer percentage (e.g. 10 for 10%).
 * Returns the discounted subtotal in cents.
 */
export function applyFrequencyDiscount(subtotalCents: number, discountPct: number): number {
  if (discountPct <= 0) return subtotalCents
  return subtotalCents - Math.round(subtotalCents * discountPct / 100)
}

export type TaxSplit = {
  subtotal: number  // cents — pre-tax subtotal
  tax: number       // cents — tax amount
  total: number     // cents — amount customer pays
}

/**
 * Split a price into subtotal, tax, and total given tax mode and rate.
 *
 * exclusive: tax is added on top of rawPrice. total = rawPrice + tax.
 * inclusive: tax is extracted from within rawPrice. total = rawPrice.
 *
 * Matches the arithmetic in both booking forms exactly.
 */
export function calcTaxSplit(
  rawPrice: number,
  taxMode: 'exclusive' | 'inclusive',
  taxRatePct: number,
): TaxSplit {
  if (taxRatePct <= 0) {
    return { subtotal: rawPrice, tax: 0, total: rawPrice }
  }
  if (taxMode === 'exclusive') {
    const tax = Math.round(rawPrice * taxRatePct / 100)
    return { subtotal: rawPrice, tax, total: rawPrice + tax }
  }
  const tax = Math.round(rawPrice * taxRatePct / (100 + taxRatePct))
  return { subtotal: rawPrice - tax, tax, total: rawPrice }
}
