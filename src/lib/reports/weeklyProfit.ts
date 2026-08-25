import type { SupabaseClient } from '@supabase/supabase-js'
import { getExGstAmount, getProviderPayout } from '@/lib/pricing'

/** Monday of the week containing `d`, at local midnight. */
export function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

/** YYYY-MM-DD for a Date, in local time (no timezone conversion — dates are already local-midnight). */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface LocationProfit {
  locationId: string
  locationName: string
  revenueExGst: number
  revenueIncGst: number
  subcontractorPay: number
  gst: number
  /** The live-calculated value before any manual override is applied —
   *  kept around so the UI can show it as a reference/placeholder even
   *  when a staff-entered override is in effect. */
  subcontractorPayCalculated: number
  gstCalculated: number
  /** True when subcontractorPay/gst above reflect a manually-entered
   *  override rather than the live calculation. */
  subcontractorPayOverridden: boolean
  gstOverridden: boolean
  adminPay: number
  adSpend: number
  subscriptionFees: number
  refunds: number
  perfMaxSpend: number
  otherCosts: number
  totalExpenses: number
  profit: number
  jobCount: number
  /** True for the 4 carried-forward fields when this week has no explicit
   *  entry yet and the value shown is copied from the most recent prior
   *  week — so the UI can flag it as a suggestion, not a confirmed figure. */
  carriedForward: boolean
}

export interface WeeklyProfitResult {
  weekStart: string
  weekEnd: string
  locations: LocationProfit[]
  totalProfit: number
  totalRevenueExGst: number
}

/**
 * Computes the full per-location profit breakdown for one week — the same
 * calculation /reports/profit displays, reused by the agent brief so both
 * surfaces always agree on the number. Revenue and subcontractor pay are
 * derived from completed jobs (completed_at within the week); the remaining
 * expense lines come from the manually-entered weekly_costs table.
 */
export async function calculateWeeklyProfit(
  supabase: SupabaseClient,
  businessId: string,
  weekStartDate: Date,
): Promise<WeeklyProfitResult> {
  const weekStart = getMonday(weekStartDate)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
  const weekStartStr = toDateString(weekStart)
  const weekEndStr = toDateString(weekEnd)

  const [{ data: business }, { data: locations }, { data: jobs }, { data: costs }] = await Promise.all([
    supabase.from('businesses').select('tax_rate, tax_mode').eq('id', businessId).single(),
    supabase.from('locations').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
    supabase.from('jobs')
      .select('id, location_id, provider_id, price, total_price, price_override, tax_amount, provider_fee_extra, pay_rate_override, provider:providers(payout_percent)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', weekStart.toISOString())
      .lt('completed_at', weekEnd.toISOString()),
    supabase.from('weekly_costs')
      .select('*')
      .eq('business_id', businessId)
      .eq('week_start', weekStartStr),
  ])

  const taxRate = business?.tax_rate ?? 10
  const taxMode = (business?.tax_mode ?? 'exclusive') as 'exclusive' | 'inclusive'
  const costsByLocation = new Map((costs || []).map((c: any) => [c.location_id, c]))

  // For locations with no weekly_costs row yet this week, carry forward
  // admin_pay/subscription_fees/refunds/perf_max_spend from their most
  // recent prior week — ad_spend and other_costs are never carried
  // forward (ad_spend is meant to come from Google Ads, other_costs is
  // genuinely one-off).
  const needsFallback = (locations || []).filter((loc: any) => !costsByLocation.has(loc.id)).map((l: any) => l.id)
  const fallbackByLocation = new Map<string, any>()
  if (needsFallback.length) {
    const { data: priorCosts } = await supabase
      .from('weekly_costs')
      .select('location_id, week_start, admin_pay, subscription_fees, refunds, perf_max_spend')
      .eq('business_id', businessId)
      .in('location_id', needsFallback)
      .lt('week_start', weekStartStr)
      .order('week_start', { ascending: false })
    for (const c of priorCosts || []) {
      if (!fallbackByLocation.has(c.location_id)) fallbackByLocation.set(c.location_id, c)
    }
  }

  const locationResults: LocationProfit[] = (locations || []).map((loc: any) => {
    const locJobs = (jobs || []).filter((j: any) => j.location_id === loc.id)

    let revenueExGst = 0, revenueIncGst = 0, subcontractorPayCalculated = 0
    for (const job of locJobs) {
      const exGst = getExGstAmount(job, taxRate)
      revenueExGst += exGst
      revenueIncGst += job.price_override ?? job.total_price ?? job.price ?? 0
      subcontractorPayCalculated += getProviderPayout(job, job.provider ?? {}, taxRate, taxMode)
    }

    const gstCalculated = Math.round(revenueExGst * taxRate / 100)
    const c = costsByLocation.get(loc.id) as any
    const fallback = fallbackByLocation.get(loc.id) as any
    const carriedForward = !c && !!fallback

    const subcontractorPayOverridden = c?.subcontractor_pay_override != null
    const gstOverridden = c?.gst_override != null
    const subcontractorPay = subcontractorPayOverridden ? c.subcontractor_pay_override : subcontractorPayCalculated
    const gst = gstOverridden ? c.gst_override : gstCalculated

    const adminPay = c?.admin_pay ?? fallback?.admin_pay ?? 0
    const adSpend = c?.ad_spend ?? 0
    const subscriptionFees = c?.subscription_fees ?? fallback?.subscription_fees ?? 0
    const refunds = c?.refunds ?? fallback?.refunds ?? 0
    const perfMaxSpend = c?.perf_max_spend ?? fallback?.perf_max_spend ?? 0
    const otherCosts = c?.other_costs ?? 0

    const totalExpenses = subcontractorPay + gst + adminPay + adSpend + subscriptionFees + refunds + perfMaxSpend + otherCosts
    const profit = revenueExGst - totalExpenses

    return {
      locationId: loc.id, locationName: loc.name,
      revenueExGst, revenueIncGst, subcontractorPay, gst,
      subcontractorPayCalculated, gstCalculated, subcontractorPayOverridden, gstOverridden,
      adminPay, adSpend, subscriptionFees, refunds, perfMaxSpend, otherCosts,
      totalExpenses, profit, jobCount: locJobs.length, carriedForward,
    }
  })

  return {
    weekStart: weekStartStr,
    weekEnd: toDateString(new Date(weekEnd.getTime() - 86400000)),
    locations: locationResults,
    totalProfit: locationResults.reduce((s, l) => s + l.profit, 0),
    totalRevenueExGst: locationResults.reduce((s, l) => s + l.revenueExGst, 0),
  }
}
