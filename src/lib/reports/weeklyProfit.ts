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
  adminPay: number
  adSpend: number
  subscriptionFees: number
  refunds: number
  perfMaxSpend: number
  otherCosts: number
  totalExpenses: number
  profit: number
  jobCount: number
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

  const locationResults: LocationProfit[] = (locations || []).map((loc: any) => {
    const locJobs = (jobs || []).filter((j: any) => j.location_id === loc.id)

    let revenueExGst = 0, revenueIncGst = 0, subcontractorPay = 0
    for (const job of locJobs) {
      const exGst = getExGstAmount(job, taxRate)
      revenueExGst += exGst
      revenueIncGst += job.price_override ?? job.total_price ?? job.price ?? 0
      subcontractorPay += getProviderPayout(job, job.provider ?? {}, taxRate, taxMode)
    }

    const gst = Math.round(revenueExGst * taxRate / 100)
    const c = costsByLocation.get(loc.id) as any
    const adminPay = c?.admin_pay ?? 0
    const adSpend = c?.ad_spend ?? 0
    const subscriptionFees = c?.subscription_fees ?? 0
    const refunds = c?.refunds ?? 0
    const perfMaxSpend = c?.perf_max_spend ?? 0
    const otherCosts = c?.other_costs ?? 0

    const totalExpenses = subcontractorPay + gst + adminPay + adSpend + subscriptionFees + refunds + perfMaxSpend + otherCosts
    const profit = revenueExGst - totalExpenses

    return {
      locationId: loc.id, locationName: loc.name,
      revenueExGst, revenueIncGst, subcontractorPay, gst,
      adminPay, adSpend, subscriptionFees, refunds, perfMaxSpend, otherCosts,
      totalExpenses, profit, jobCount: locJobs.length,
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
