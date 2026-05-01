// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Plus, X } from 'lucide-react'

interface CampaignRow {
  campaign: string
  source_type: string
  utm_source: string
  total_leads: number
  total_bookings: number
  conversion_rate_pct: number
  total_revenue_cents: number
  avg_job_value_cents: number
  ad_spend_cents: number
  profit_cents: number
  cost_per_booking: number
}

interface AdSpendEntry {
  campaign: string
  week_starting: string
  spend_cents: number
}

const CONTRACTOR_PCT_DEFAULT = 40 // 40% of revenue goes to subcontractors

export default function AttributionPage({ businessId }: { businessId: string }) {
  const [data, setData] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [contractorPct, setContractorPct] = useState(CONTRACTOR_PCT_DEFAULT)
  const [showSpendModal, setShowSpendModal] = useState(false)
  const [spendCampaign, setSpendCampaign] = useState('')
  const [spendAmount, setSpendAmount] = useState('')
  const [spendWeek, setSpendWeek] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  })
  const [adSpends, setAdSpends] = useState<AdSpendEntry[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    fetchAdSpends()
  }, [dateFrom, dateTo])

  async function fetchData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('lead_sources')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59')

    if (!error && rows) {
      // Aggregate by campaign client-side
      const map = new Map<string, CampaignRow>()
      for (const row of rows) {
        const key = row.utm_campaign || row.manual_campaign_label || row.source_type || 'Unknown'
        if (!map.has(key)) {
          map.set(key, {
            campaign: key,
            source_type: row.source_type,
            utm_source: row.utm_source || '—',
            total_leads: 0,
            total_bookings: 0,
            conversion_rate_pct: 0,
            total_revenue_cents: 0,
            avg_job_value_cents: 0,
            ad_spend_cents: 0,
            profit_cents: 0,
            cost_per_booking: 0,
          })
        }
        const c = map.get(key)!
        c.total_leads++
        if (row.lead_status === 'booked') {
          c.total_bookings++
          c.total_revenue_cents += row.booking_value_cents || 0
        }
      }
      // Calculate derived fields
      for (const [, c] of map) {
        c.conversion_rate_pct = c.total_leads > 0
          ? Math.round((c.total_bookings / c.total_leads) * 1000) / 10
          : 0
        c.avg_job_value_cents = c.total_bookings > 0
          ? Math.round(c.total_revenue_cents / c.total_bookings)
          : 0
      }
      setData(Array.from(map.values()).sort((a, b) => b.total_revenue_cents - a.total_revenue_cents))
    }
    setLoading(false)
  }

  async function fetchAdSpends() {
    const { data: spends } = await supabase
      .from('ad_spend_entries')
      .select('*')
      .eq('business_id', businessId)
    if (spends) setAdSpends(spends)
  }

  function getAdSpendForCampaign(campaign: string): number {
    return adSpends
      .filter(s => s.campaign === campaign)
      .reduce((sum, s) => sum + s.spend_cents, 0)
  }

  async function saveAdSpend() {
    if (!spendCampaign || !spendAmount) return
    const cents = Math.round(parseFloat(spendAmount) * 100)
    await supabase.from('ad_spend_entries').upsert({
      business_id: businessId,
      campaign: spendCampaign,
      week_starting: spendWeek,
      spend_cents: cents,
    }, { onConflict: 'business_id,campaign,week_starting' })
    await fetchAdSpends()
    setShowSpendModal(false)
    setSpendAmount('')
  }

  // Totals
  const totalLeads = data.reduce((s, r) => s + r.total_leads, 0)
  const totalBookings = data.reduce((s, r) => s + r.total_bookings, 0)
  const totalRevenue = data.reduce((s, r) => s + r.total_revenue_cents, 0)
  const overallCvr = totalLeads > 0 ? Math.round((totalBookings / totalLeads) * 1000) / 10 : 0

  const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/reports" style={{ color: '#6b7280', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827' }}>Attribution & Ad Performance</h1>
          <p style={{ fontSize: '0.83rem', color: '#6b7280', marginTop: '0.1rem' }}>Track which campaigns are driving bookings and revenue</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.82rem', color: '#6b7280' }}>From</label>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ ...inputStyle }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.82rem', color: '#6b7280' }}>To</label>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ ...inputStyle }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.82rem', color: '#6b7280' }}>Contractor %</label>
          <input
            type="number" value={contractorPct} min={0} max={100}
            onChange={e => setContractorPct(Number(e.target.value))}
            style={{ ...inputStyle, width: 70 }}
          />
        </div>
        <button
          onClick={() => setShowSpendModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: '#2563FF', color: '#fff', border: 'none',
            padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.83rem',
            fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Log ad spend
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: Users, label: 'Total leads', val: totalLeads.toString(), color: '#2563FF', bg: '#eff6ff' },
          { icon: Target, label: 'Bookings', val: totalBookings.toString(), color: '#059669', bg: '#f0fdf4' },
          { icon: TrendingUp, label: 'Conv. rate', val: `${overallCvr}%`, color: '#7c3aed', bg: '#f5f3ff' },
          { icon: DollarSign, label: 'Revenue', val: fmt(totalRevenue), color: '#d97706', bg: '#fffbeb' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <card.icon style={{ width: 16, height: 16, color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{card.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{card.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>By campaign</h2>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Contractor cost: {contractorPct}% of revenue</span>
        </div>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ marginBottom: '0.5rem' }}>No attribution data yet.</p>
            <p style={{ fontSize: '0.82rem' }}>Add UTM parameters to your booking form URLs to start tracking.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Campaign', 'Source', 'Leads', 'Bookings', 'Conv. rate', 'Revenue', 'Avg job', 'Ad spend', 'Gross profit', 'Net profit', 'Cost/booking'].map(h => (
                    <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const adSpend = getAdSpendForCampaign(row.campaign)
                  const contractorCost = Math.round(row.total_revenue_cents * (contractorPct / 100))
                  const grossProfit = row.total_revenue_cents - contractorCost
                  const netProfit = grossProfit - adSpend
                  const costPerBooking = row.total_bookings > 0 ? Math.round(adSpend / row.total_bookings) : 0

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '0.8rem 1rem', fontWeight: 600, color: '#111827' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: row.source_type === 'paid_search' ? '#2563FF' :
                              row.source_type === 'organic' ? '#059669' :
                              row.source_type === 'referral' ? '#7c3aed' :
                              row.source_type === 'direct' ? '#d97706' : '#6b7280',
                          }} />
                          {row.campaign}
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', color: '#6b7280' }}>{row.utm_source}</td>
                      <td style={{ padding: '0.8rem 1rem', color: '#111827' }}>{row.total_leads}</td>
                      <td style={{ padding: '0.8rem 1rem', color: '#111827', fontWeight: 600 }}>{row.total_bookings}</td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span style={{
                          color: row.conversion_rate_pct >= 30 ? '#059669' : row.conversion_rate_pct >= 15 ? '#d97706' : '#ef4444',
                          fontWeight: 600,
                        }}>{row.conversion_rate_pct}%</span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', color: '#111827', fontWeight: 600 }}>{fmt(row.total_revenue_cents)}</td>
                      <td style={{ padding: '0.8rem 1rem', color: '#6b7280' }}>{fmt(row.avg_job_value_cents)}</td>
                      <td style={{ padding: '0.8rem 1rem', color: '#6b7280' }}>
                        <button
                          onClick={() => { setSpendCampaign(row.campaign); setShowSpendModal(true) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: adSpend > 0 ? '#111827' : '#9ca3af', fontWeight: adSpend > 0 ? 600 : 400, fontSize: '0.85rem' }}
                        >
                          {adSpend > 0 ? fmt(adSpend) : '+ Add'}
                        </button>
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span style={{ color: grossProfit > 0 ? '#059669' : '#ef4444', fontWeight: 600 }}>
                          {fmt(grossProfit)}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span style={{ color: netProfit > 0 ? '#059669' : '#ef4444', fontWeight: 700 }}>
                          {adSpend > 0 ? fmt(netProfit) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', color: '#6b7280' }}>
                        {adSpend > 0 && row.total_bookings > 0 ? fmt(costPerBooking) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        {[
          { color: '#2563FF', label: 'Paid search' },
          { color: '#059669', label: 'Organic' },
          { color: '#7c3aed', label: 'Referral' },
          { color: '#d97706', label: 'Direct' },
          { color: '#6b7280', label: 'Other' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
          Net profit = Revenue − Contractor cost ({contractorPct}%) − Ad spend
        </span>
      </div>

      {/* Ad spend modal */}
      {showSpendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowSpendModal(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', maxWidth: 400, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontWeight: 600, color: '#111827' }}>Log ad spend</h3>
              <button onClick={() => setShowSpendModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Campaign</label>
                <input
                  value={spendCampaign}
                  onChange={e => setSpendCampaign(e.target.value)}
                  placeholder="e.g. Residential Melbourne"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Week starting (Monday)</label>
                <input type="date" value={spendWeek} onChange={e => setSpendWeek(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Spend amount ($)</label>
                <input
                  type="number" value={spendAmount}
                  onChange={e => setSpendAmount(e.target.value)}
                  placeholder="e.g. 450"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <button
                onClick={saveAdSpend}
                style={{ background: '#2563FF', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginTop: '0.4rem' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.7rem', borderRadius: 7, border: '1px solid #e5e7eb',
  fontSize: '0.85rem', color: '#111827', outline: 'none', background: '#fff',
  fontFamily: "'DM Sans', sans-serif",
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem',
}
