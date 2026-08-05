// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users, TrendingUp, Clock, Target } from 'lucide-react'
import { LOST_REASONS } from '@/components/crm/LostReasonModal'
import { SOURCE_LABELS } from '@/lib/crm/sourceLabels'

const SOURCE_COLORS: Record<string, string> = {
  paid_search: '#2563FF',
  organic: '#059669',
  referral: '#7c3aed',
  direct: '#d97706',
  returning: '#0891b2',
}

const LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(LOST_REASONS.map(r => [r.value, r.label]))

function fmtDays(days: number) {
  if (days < 1) return `${Math.round(days * 24)}h`
  return `${days.toFixed(1)}d`
}

export default function LeadsDashboard({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<any[]>([])
  const [wonActivities, setWonActivities] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const supabase = createClient()

  useEffect(() => { fetchData() }, [businessId])

  async function fetchData() {
    setLoading(true)
    const [{ data: c }, { data: won }] = await Promise.all([
      supabase.from('crm_contacts').select('id, full_name, source, stage, lost_reason, created_at').eq('business_id', businessId),
      supabase.from('crm_activities').select('contact_id, created_at').eq('business_id', businessId).eq('type', 'won').order('created_at', { ascending: true }),
    ])
    setContacts(c || [])
    setWonActivities(won || [])
    setLoading(false)
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const monthAgo = new Date(now.getTime() - 30 * 86400000)
  const rangeFrom = new Date(`${dateFrom}T00:00:00`)
  const rangeTo = new Date(`${dateTo}T23:59:59`)

  const leadsThisWeek = contacts.filter(c => new Date(c.created_at) >= weekAgo).length
  const leadsThisMonth = contacts.filter(c => new Date(c.created_at) >= monthAgo).length

  const inRange = contacts.filter(c => {
    const created = new Date(c.created_at)
    return created >= rangeFrom && created <= rangeTo
  })
  const wonInRange = inRange.filter(c => c.stage === 'won')
  const lostInRange = inRange.filter(c => c.stage === 'lost')
  const conversionRate = inRange.length > 0 ? Math.round((wonInRange.length / inRange.length) * 1000) / 10 : 0

  // Average time from creation to the first "won" activity, for contacts won within range.
  const wonAtByContact = new Map<string, string>()
  for (const a of wonActivities) {
    if (!wonAtByContact.has(a.contact_id)) wonAtByContact.set(a.contact_id, a.created_at)
  }
  const winTimes = wonInRange
    .map(c => {
      const wonAt = wonAtByContact.get(c.id)
      if (!wonAt) return null
      return (new Date(wonAt).getTime() - new Date(c.created_at).getTime()) / 86400000
    })
    .filter((d): d is number => d != null && d >= 0)
  const avgTimeToWon = winTimes.length > 0 ? winTimes.reduce((s, d) => s + d, 0) / winTimes.length : null

  const bySource = new Map<string, number>()
  for (const c of inRange) {
    const key = c.source || 'unknown'
    bySource.set(key, (bySource.get(key) || 0) + 1)
  }
  const sourceRows = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])
  const maxSourceCount = Math.max(1, ...sourceRows.map(([, n]) => n))

  const byLostReason = new Map<string, number>()
  for (const c of lostInRange) {
    const key = c.lost_reason || 'not_recorded'
    byLostReason.set(key, (byLostReason.get(key) || 0) + 1)
  }
  const lostRows = Array.from(byLostReason.entries()).sort((a, b) => b[1] - a[1])
  const maxLostCount = Math.max(1, ...lostRows.map(([, n]) => n))

  const inputStyle = 'text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline conversion and lead source performance</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500">Conversion metrics for</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputStyle} />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputStyle} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: 'New leads (7d)', val: leadsThisWeek.toString(), color: '#2563FF', bg: '#eff6ff' },
              { icon: Users, label: 'New leads (30d)', val: leadsThisMonth.toString(), color: '#2563FF', bg: '#eff6ff' },
              { icon: TrendingUp, label: 'Conversion rate', val: `${conversionRate}%`, color: '#059669', bg: '#f0fdf4' },
              { icon: Clock, label: 'Avg. Lead → Won', val: avgTimeToWon != null ? fmtDays(avgTimeToWon) : '—', color: '#7c3aed', bg: '#f5f3ff' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: card.bg }}>
                  <card.icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="text-xl font-bold text-gray-900">{card.val}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Leads by source */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-400" /> Leads by source
              </h2>
              {sourceRows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No leads in this range</p>
              ) : (
                <div className="space-y-3">
                  {sourceRows.map(([source, count]) => (
                    <div key={source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">{SOURCE_LABELS[source] || source}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / maxSourceCount) * 100}%`, background: SOURCE_COLORS[source] || '#9ca3af' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lost reasons */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-400" /> Lost reasons
              </h2>
              {lostRows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No lost leads in this range</p>
              ) : (
                <div className="space-y-3">
                  {lostRows.map(([reason, count]) => (
                    <div key={reason}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">
                          {reason === 'not_recorded' ? 'Not recorded' : (LOST_REASON_LABELS[reason] || reason)}
                        </span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${(count / maxLostCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center pt-2">
            {inRange.length} lead{inRange.length === 1 ? '' : 's'} created {dateFrom} – {dateTo} · {wonInRange.length} won · {lostInRange.length} lost
          </p>
        </>
      )}
    </div>
  )
}
