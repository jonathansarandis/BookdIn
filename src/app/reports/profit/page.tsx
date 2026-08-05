'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateWeeklyProfit, getMonday, toDateString, type WeeklyProfitResult, type LocationProfit } from '@/lib/reports/weeklyProfit'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Loader2, ExternalLink } from 'lucide-react'

function fmtWeek(start: Date) {
  const end = new Date(start.getTime() + 6 * 86400000)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('en-AU', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endLabel = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

const COST_FIELDS: { key: keyof Pick<LocationProfit, 'adminPay' | 'adSpend' | 'subscriptionFees' | 'refunds' | 'perfMaxSpend' | 'otherCosts'>; dbField: string; label: string; carriesForward: boolean }[] = [
  { key: 'adminPay', dbField: 'admin_pay', label: 'Admin team pay', carriesForward: true },
  { key: 'adSpend', dbField: 'ad_spend', label: 'Advertising (Google Ads)', carriesForward: false },
  { key: 'subscriptionFees', dbField: 'subscription_fees', label: 'Subscription fees', carriesForward: true },
  { key: 'refunds', dbField: 'refunds', label: 'Refunds', carriesForward: true },
  { key: 'perfMaxSpend', dbField: 'perf_max_spend', label: 'Perf Max test campaign', carriesForward: true },
  { key: 'otherCosts', dbField: 'other_costs', label: 'Other costs', carriesForward: false },
]

export default function ProfitReportPage() {
  const supabase = createClient()
  const [businessId, setBusinessId] = useState('')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [current, setCurrent] = useState<WeeklyProfitResult | null>(null)
  const [previous, setPrevious] = useState<WeeklyProfitResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [googleAdsConfigured, setGoogleAdsConfigured] = useState<boolean | null>(null)
  const [googleAdsSpend, setGoogleAdsSpend] = useState<Record<string, number> | null>(null)
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id || '')
    }
    init()
  }, [])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000)
    const weekStartStr = toDateString(weekStart)
    const [curr, prev, googleAdsRes] = await Promise.all([
      calculateWeeklyProfit(supabase, businessId, weekStart),
      calculateWeeklyProfit(supabase, businessId, prevWeekStart),
      fetch(`/api/integrations/google-ads/weekly-spend?week_start=${weekStartStr}`)
        .then(async r => ({ ...(await r.json().catch(() => ({}))), ok: r.ok }))
        .catch(() => ({ configured: false, ok: false, error: 'Could not reach the Google Ads integration' })),
    ])
    setCurrent(curr)
    setPrevious(prev)
    setGoogleAdsConfigured(!!googleAdsRes.configured)
    setGoogleAdsSpend(googleAdsRes.spend || null)
    setGoogleAdsError(googleAdsRes.ok === false ? (googleAdsRes.error || 'Failed to load Google Ads spend') : null)
    setLoading(false)
  }, [businessId, weekStart])

  useEffect(() => { load() }, [load])

  function shiftWeek(days: number) {
    setWeekStart(w => new Date(w.getTime() + days * 86400000))
  }

  async function saveCost(locationId: string, dbField: string, dollarValue: string) {
    const cents = Math.round((parseFloat(dollarValue) || 0) * 100)
    setSavingKey(`${locationId}-${dbField}`)
    const weekStartStr = toDateString(weekStart)

    // Snapshot every currently-displayed cost value (including any carried-forward
    // suggestions from last week) so editing one field doesn't zero out the others —
    // this week's row, once created, becomes the explicit source of truth for all of them.
    const loc = current?.locations.find(l => l.locationId === locationId)
    const payload: Record<string, any> = { business_id: businessId, location_id: locationId, week_start: weekStartStr }
    for (const f of COST_FIELDS) payload[f.dbField] = loc ? loc[f.key] : 0
    payload[dbField] = cents

    await supabase.from('weekly_costs').upsert(payload, { onConflict: 'location_id,week_start' })
    await load()
    setSavingKey(null)
  }

  const profitChange = current && previous && previous.totalProfit !== 0
    ? Math.round(((current.totalProfit - previous.totalProfit) / Math.abs(previous.totalProfit)) * 100)
    : null

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Weekly Profit</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue and expenses by location</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-7)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 min-w-[180px] text-center">
            {fmtWeek(weekStart)}
          </div>
          <button onClick={() => shiftWeek(7)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            This week
          </button>
        </div>
      </div>

      {loading || !current ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : (
        <>
          {/* Total */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total weekly profit — all locations</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(current.totalProfit)}</p>
            </div>
            {profitChange !== null && (
              <div className={`flex items-center gap-1 text-sm font-medium ${profitChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {profitChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(profitChange)}% vs last week ({formatCurrency(previous?.totalProfit || 0)})
              </div>
            )}
          </div>

          {/* Per location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {current.locations.map(loc => {
              const prevLoc = previous?.locations.find(l => l.locationId === loc.locationId)
              const locChange = prevLoc && prevLoc.profit !== 0
                ? Math.round(((loc.profit - prevLoc.profit) / Math.abs(prevLoc.profit)) * 100)
                : null

              return (
                <div key={loc.locationId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{loc.locationName}</p>
                      <p className="text-xs text-gray-400">{loc.jobCount} completed job{loc.jobCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: loc.profit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(loc.profit)}</p>
                      {locChange !== null && (
                        <p className={`text-xs font-medium ${locChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {locChange >= 0 ? '+' : ''}{locChange}% vs last week
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Revenue</p>
                      <div className="flex justify-between text-sm py-0.5">
                        <span className="text-gray-500">Sales ex-GST</span>
                        <span className="font-medium text-gray-900">{formatCurrency(loc.revenueExGst)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-0.5">
                        <span className="text-gray-500">Sales inc-GST</span>
                        <span className="font-medium text-gray-900">{formatCurrency(loc.revenueIncGst)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expenses (auto-calculated)</p>
                      <div className="flex justify-between text-sm py-0.5">
                        <span className="text-gray-500">Subcontractor pay</span>
                        <span className="text-gray-700">{formatCurrency(loc.subcontractorPay)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-0.5">
                        <span className="text-gray-500">GST (10% of revenue)</span>
                        <span className="text-gray-700">{formatCurrency(loc.gst)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expenses (entered manually)</p>
                      {COST_FIELDS.map(f => {
                        const isCarried = f.carriesForward && loc.carriedForward

                        const locKey = loc.locationName.toLowerCase()
                        const googleAdsValueDollars = f.key === 'adSpend' ? googleAdsSpend?.[locKey] : undefined
                        const isFromGoogleAds = f.key === 'adSpend' && !loc.adSpend && googleAdsValueDollars != null
                        const showConnectPrompt = f.key === 'adSpend' && !loc.adSpend && googleAdsConfigured === false
                        const showGoogleAdsError = f.key === 'adSpend' && !loc.adSpend && googleAdsConfigured === true && !!googleAdsError

                        const displayValue = isFromGoogleAds
                          ? googleAdsValueDollars!.toFixed(2)
                          : (loc[f.key] ? (loc[f.key] / 100).toFixed(2) : '')

                        return (
                          <div key={f.key} className="flex items-center justify-between text-sm py-1">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              {f.label}
                              {isCarried && (
                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">from last week</span>
                              )}
                              {isFromGoogleAds && (
                                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">from Google Ads</span>
                              )}
                              {showConnectPrompt && (
                                <Link href="/integrations" className="text-[10px] font-medium text-brand-600 hover:underline flex items-center gap-0.5">
                                  Connect Google Ads <ExternalLink className="w-2.5 h-2.5" />
                                </Link>
                              )}
                              {showGoogleAdsError && (
                                <span
                                  className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full cursor-help"
                                  title={googleAdsError || 'Failed to load Google Ads spend'}
                                >
                                  Google Ads error
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number" min="0" step="0.01"
                                defaultValue={displayValue}
                                placeholder="0.00"
                                onBlur={e => saveCost(loc.locationId, f.dbField, e.target.value)}
                                className={`w-24 text-right text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCarried ? 'border-amber-200 bg-amber-50/40' : isFromGoogleAds ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200'}`}
                              />
                              {savingKey === `${loc.locationId}-${f.dbField}` && <Loader2 className="w-3 h-3 text-gray-300 animate-spin" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-900">State profit</span>
                      <span className="text-base font-bold" style={{ color: loc.profit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(loc.profit)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
