'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateWeeklyProfit, getMonday, toDateString, type WeeklyProfitResult, type LocationProfit } from '@/lib/reports/weeklyProfit'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'

function fmtWeek(start: Date) {
  const end = new Date(start.getTime() + 6 * 86400000)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('en-AU', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endLabel = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

const COST_FIELDS: { key: keyof Pick<LocationProfit, 'adminPay' | 'adSpend' | 'subscriptionFees' | 'refunds' | 'perfMaxSpend' | 'otherCosts'>; dbField: string; label: string }[] = [
  { key: 'adminPay', dbField: 'admin_pay', label: 'Admin team pay' },
  { key: 'adSpend', dbField: 'ad_spend', label: 'Advertising (Google Ads)' },
  { key: 'subscriptionFees', dbField: 'subscription_fees', label: 'Subscription fees' },
  { key: 'refunds', dbField: 'refunds', label: 'Refunds' },
  { key: 'perfMaxSpend', dbField: 'perf_max_spend', label: 'Perf Max test campaign' },
  { key: 'otherCosts', dbField: 'other_costs', label: 'Other costs' },
]

export default function ProfitReportPage() {
  const supabase = createClient()
  const [businessId, setBusinessId] = useState('')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [current, setCurrent] = useState<WeeklyProfitResult | null>(null)
  const [previous, setPrevious] = useState<WeeklyProfitResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

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
    const [curr, prev] = await Promise.all([
      calculateWeeklyProfit(supabase, businessId, weekStart),
      calculateWeeklyProfit(supabase, businessId, prevWeekStart),
    ])
    setCurrent(curr)
    setPrevious(prev)
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
    await supabase.from('weekly_costs').upsert(
      { business_id: businessId, location_id: locationId, week_start: weekStartStr, [dbField]: cents },
      { onConflict: 'location_id,week_start' }
    )
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
                      {COST_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center justify-between text-sm py-1">
                          <span className="text-gray-500">{f.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">$</span>
                            <input
                              type="number" min="0" step="0.01"
                              defaultValue={loc[f.key] ? (loc[f.key] / 100).toFixed(2) : ''}
                              placeholder="0.00"
                              onBlur={e => saveCost(loc.locationId, f.dbField, e.target.value)}
                              className="w-24 text-right text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {savingKey === `${loc.locationId}-${f.dbField}` && <Loader2 className="w-3 h-3 text-gray-300 animate-spin" />}
                          </div>
                        </div>
                      ))}
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
