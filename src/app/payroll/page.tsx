'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getProviderPayout, getExGstAmount, calcTaxSplit } from '@/lib/pricing'
import { getMonday, toDateString } from '@/lib/reports/weeklyProfit'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Users, DollarSign, Eye, EyeOff, Pencil } from 'lucide-react'

interface Job {
  id: string
  customer: { full_name: string } | null
  price: number | null
  total_price: number | null
  price_override: number | null
  tax_amount: number | null
  provider_fee_extra: number | null
  pay_rate_override: number | null
  cash_paid: number
  provider_paid_at: string | null
  provider_id: string
  completed_at: string
}

interface Provider {
  id: string
  display_name: string
  color: string | null
  payout_percent: number | null
}

function fmtWeek(start: Date) {
  const end = new Date(start.getTime() + 6 * 86400000)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('en-AU', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endLabel = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export default function PayrollPage() {
  const supabase = createClient()
  const [businessId, setBusinessId] = useState('')
  const [taxRate, setTaxRate] = useState(10)
  const [taxMode, setTaxMode] = useState<'exclusive' | 'inclusive'>('exclusive')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [providers, setProviders] = useState<Provider[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [editingPriceJobId, setEditingPriceJobId] = useState<string | null>(null)
  // Hides the Price ex-GST / GST / Price inc-GST columns — for when this
  // table is about to be screenshotted or shared with a contractor, who
  // should only see their own payout, not the underlying job price.
  const [pricesHidden, setPricesHidden] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id || '')
      const { data: business } = await supabase.from('businesses').select('tax_rate, tax_mode').eq('id', profile?.business_id).single()
      setTaxRate(business?.tax_rate ?? 10)
      setTaxMode(business?.tax_mode ?? 'exclusive')
    }
    init()
  }, [])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)

    const [{ data: provData }, { data: jobData }] = await Promise.all([
      supabase.from('providers').select('id, display_name, color, payout_percent').eq('business_id', businessId).order('display_name'),
      supabase.from('jobs')
        .select('id, customer:customers(full_name), price, total_price, price_override, tax_amount, provider_fee_extra, pay_rate_override, cash_paid, provider_paid_at, provider_id, completed_at')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .not('provider_id', 'is', null)
        .gte('completed_at', weekStart.toISOString())
        .lt('completed_at', weekEnd.toISOString())
        .order('completed_at'),
    ])
    setProviders(provData || [])
    setJobs((jobData as any) || [])
    setLoading(false)
  }, [businessId, weekStart])

  useEffect(() => { load() }, [load])

  function shiftWeek(days: number) {
    setWeekStart(w => new Date(w.getTime() + days * 86400000))
  }

  async function updateJobField(jobId: string, field: 'cash_paid' | 'pay_rate_override' | 'provider_fee_extra', value: number | null) {
    setSavingJobId(jobId)
    const { error } = await supabase.from('jobs').update({ [field]: value }).eq('id', jobId)
    if (!error) setJobs(prev => prev.map(j => j.id === jobId ? { ...j, [field]: value } : j))
    setSavingJobId(null)
  }

  // GST is derived elsewhere as total_price - tax_amount, so "editing GST" for a
  // job means writing tax_amount directly — e.g. setting it to 0 for a cash job
  // where no GST was actually charged.
  async function updateJobTaxAmount(jobId: string, taxAmountCents: number) {
    setSavingJobId(jobId)
    const { error } = await supabase.from('jobs').update({ tax_amount: taxAmountCents }).eq('id', jobId)
    if (!error) setJobs(prev => prev.map(j => j.id === jobId ? { ...j, tax_amount: taxAmountCents } : j))
    setSavingJobId(null)
  }

  // Price ex-GST is derived (getExGstAmount), not a stored column, so "editing"
  // it means writing back whichever field actually drives that derivation for
  // this job — mirrors getExGstAmount's own branching:
  //   - price_override set (manually-priced job): re-derive price_override so
  //     that dividing back out by taxRate reproduces the entered ex-GST figure.
  //   - otherwise: write total_price directly, holding tax_amount fixed — same
  //     approach as updateJobTaxAmount above but solving for the other side.
  // This is for jobs whose price changed after booking (customer request,
  // late-arrival discount, etc.) that never got reflected here.
  async function updateJobPriceExGst(job: Job, newExGstCents: number) {
    setSavingJobId(job.id)
    if (job.price_override != null) {
      const { total } = calcTaxSplit(newExGstCents, 'exclusive', taxRate)
      const { error } = await supabase.from('jobs').update({ price_override: total }).eq('id', job.id)
      if (!error) setJobs(prev => prev.map(j => j.id === job.id ? { ...j, price_override: total } : j))
    } else {
      const newTotalPrice = newExGstCents + (job.tax_amount ?? 0)
      const { error } = await supabase.from('jobs').update({ total_price: newTotalPrice }).eq('id', job.id)
      if (!error) setJobs(prev => prev.map(j => j.id === job.id ? { ...j, total_price: newTotalPrice } : j))
    }
    setSavingJobId(null)
  }

  async function markProviderPaid(providerId: string, jobIds: string[]) {
    setMarkingPaid(providerId)
    const now = new Date().toISOString()
    const { error } = await supabase.from('jobs').update({ provider_paid_at: now }).in('id', jobIds)
    if (!error) setJobs(prev => prev.map(j => jobIds.includes(j.id) ? { ...j, provider_paid_at: now } : j))
    setMarkingPaid(null)
  }

  const providersWithJobs = providers
    .map(provider => ({ provider, jobs: jobs.filter(j => j.provider_id === provider.id) }))
    .filter(g => g.jobs.length > 0)

  const grandTotalPayout = providersWithJobs.reduce((sum, g) =>
    sum + g.jobs.reduce((s, j) => s + getProviderPayout(j, g.provider, taxRate, taxMode), 0), 0)
  const grandTotalCash = jobs.reduce((s, j) => s + (j.cash_paid || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-0.5">Subcontractor pay by week</p>
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
          <button
            onClick={() => setPricesHidden(v => !v)}
            title="Hide price/GST/rate columns before sharing this with a contractor"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border ${
              pricesHidden
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {pricesHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {pricesHidden ? 'Prices hidden' : 'Hide prices'}
          </button>
        </div>
      </div>

      {/* Grand totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1"><DollarSign className="w-3.5 h-3.5" /><span className="text-xs">Total payout owed</span></div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(grandTotalPayout)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1"><DollarSign className="w-3.5 h-3.5" /><span className="text-xs">Cash already paid</span></div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(grandTotalCash)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1"><Users className="w-3.5 h-3.5" /><span className="text-xs">Net payable</span></div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(grandTotalPayout - grandTotalCash)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : providersWithJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No completed jobs this week</p>
        </div>
      ) : (
        <div className="space-y-5">
          {providersWithJobs.map(({ provider, jobs: providerJobs }) => {
            const rows = providerJobs.map(job => {
              const exGst = getExGstAmount(job, taxRate)
              const incGst = job.price_override ?? job.total_price ?? job.price ?? 0
              const gst = incGst - exGst
              const payout = getProviderPayout(job, provider, taxRate, taxMode)
              return { job, exGst, incGst, gst, payout }
            })
            const totalPayout = rows.reduce((s, r) => s + r.payout, 0)
            const totalCash = rows.reduce((s, r) => s + (r.job.cash_paid || 0), 0)
            const netPayable = totalPayout - totalCash
            const allPaid = providerJobs.every(j => j.provider_paid_at)

            return (
              <div key={provider.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: provider.color || '#2563FF' }}>
                      {provider.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{provider.display_name}</p>
                      <p className="text-xs text-gray-400">{providerJobs.length} job{providerJobs.length === 1 ? '' : 's'} · {provider.payout_percent ?? 0}% default rate</p>
                    </div>
                  </div>
                  {allPaid ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                    </span>
                  ) : (
                    <button
                      onClick={() => markProviderPaid(provider.id, providerJobs.map(j => j.id))}
                      disabled={markingPaid === provider.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                      style={{ background: '#0A0F1E' }}
                    >
                      {markingPaid === provider.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Mark as paid
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Customer</th>
                        {!pricesHidden && (
                          <>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Price ex-GST</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">GST</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Price inc-GST</th>
                            {/* Rate is hidden along with prices — a subcontractor who sees both
                                Rate and Payout can back out the full job price and their margin,
                                which is exactly what "Hide prices" is meant to keep from them. */}
                            <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Rate</th>
                          </>
                        )}
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Extras</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Payout</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Cash paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map(({ job, exGst, incGst, gst, payout }) => (
                        <tr key={job.id}>
                          <td className="px-4 py-2.5 text-gray-900">{job.customer?.full_name || '—'}</td>
                          {!pricesHidden && (
                            <>
                              <td className="px-3 py-2.5 text-right text-gray-600">
                                {editingPriceJobId === job.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-gray-400">$</span>
                                    <input
                                      type="number" min="0" step="0.01"
                                      autoFocus
                                      defaultValue={(exGst / 100).toFixed(2)}
                                      title="Ex-GST price for this job — edit if it was adjusted after booking (discount, customer request, etc.)"
                                      onBlur={e => {
                                        const v = parseFloat(e.target.value)
                                        if (Number.isFinite(v) && v >= 0) updateJobPriceExGst(job, Math.round(v * 100))
                                        setEditingPriceJobId(null)
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') e.currentTarget.blur()
                                        if (e.key === 'Escape') setEditingPriceJobId(null)
                                      }}
                                      className="w-20 text-right text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 justify-end">
                                    {formatCurrency(exGst)}
                                    <button
                                      onClick={() => setEditingPriceJobId(job.id)}
                                      title="Edit price ex-GST"
                                      className="p-0.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-xs text-gray-400">$</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    defaultValue={(gst / 100).toFixed(2)}
                                    title="Edit GST for this job — set to 0 if this was a cash job with no GST charged"
                                    onBlur={e => {
                                      const v = parseFloat(e.target.value)
                                      updateJobTaxAmount(job.id, Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : 0)
                                    }}
                                    className="w-16 text-right text-xs border border-gray-200 rounded-md px-1.5 py-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  {gst > 0 && (
                                    <button
                                      onClick={() => updateJobTaxAmount(job.id, 0)}
                                      title="Cash job — no GST charged"
                                      className="text-[10px] text-gray-400 hover:text-blue-600 underline whitespace-nowrap"
                                    >
                                      cash
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-gray-600">{formatCurrency(incGst)}</td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number" min="0" max="100" step="1"
                                  defaultValue={job.pay_rate_override ?? ''}
                                  placeholder={String(provider.payout_percent ?? 0)}
                                  onBlur={e => {
                                    const v = e.target.value.trim()
                                    updateJobField(job.id, 'pay_rate_override', v === '' ? null : Number(v))
                                  }}
                                  className="w-16 text-right text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-400 ml-0.5">%</span>
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-gray-400">+$</span>
                              <input
                                type="number" min="0" step="0.01"
                                defaultValue={job.provider_fee_extra ? (job.provider_fee_extra / 100).toFixed(2) : ''}
                                placeholder="0.00"
                                title="Extra flat pay for this job — parking, fuel, add-ons, etc. Added on top of the rate-based payout."
                                onBlur={e => {
                                  const v = e.target.value.trim()
                                  if (v === '') { updateJobField(job.id, 'provider_fee_extra', null); return }
                                  const n = parseFloat(v)
                                  updateJobField(job.id, 'provider_fee_extra', Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null)
                                }}
                                className="w-16 text-right text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(payout)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number" min="0" step="0.01"
                                defaultValue={job.cash_paid ? (job.cash_paid / 100).toFixed(2) : ''}
                                placeholder="0.00"
                                onBlur={e => {
                                  const v = parseFloat(e.target.value)
                                  updateJobField(job.id, 'cash_paid', Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0)
                                }}
                                className="w-20 text-right text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {savingJobId === job.id && <Loader2 className="w-3 h-3 text-gray-300 animate-spin" />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={pricesHidden ? 2 : 6} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total payout owed</td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalPayout)}</td>
                        <td className="px-3 py-3 text-right text-xs text-gray-500">{formatCurrency(totalCash)} cash</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td colSpan={pricesHidden ? 2 : 6} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">Net payable (payout − cash paid)</td>
                        <td colSpan={2} className="px-3 py-2.5 text-right text-sm font-bold" style={{ color: '#2563FF' }}>{formatCurrency(netPayable)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
