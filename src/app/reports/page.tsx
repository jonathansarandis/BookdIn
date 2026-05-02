// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, Calendar, Users, TrendingUp, ArrowUp, ArrowDown, BarChart2 } from 'lucide-react'
import Link from 'next/link'

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState('')
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '12m'>('30d')

  const [stats, setStats] = useState({
    totalRevenue: 0,
    prevRevenue: 0,
    totalJobs: 0,
    prevJobs: 0,
    totalCustomers: 0,
    newCustomers: 0,
    avgJobValue: 0,
  })

  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [topServices, setTopServices] = useState<any[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([])

  const [attrLoading, setAttrLoading] = useState(true)
  const [attrLeads, setAttrLeads] = useState(0)
  const [attrBookings, setAttrBookings] = useState(0)
  const [attrTopCampaigns, setAttrTopCampaigns] = useState<{ label: string; revenue: number; count: number }[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (businessId) {
      fetchStats()
      fetchAttribution()
    }
  }, [businessId, period])

  async function fetchAttribution() {
    setAttrLoading(true)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: leads } = await supabase
      .from('lead_sources')
      .select('booking_id, manual_campaign_label, booking_value_cents, lead_status')
      .eq('business_id', businessId)
      .gte('created_at', monthStart)

    const rows = leads || []
    const totalLeads = rows.length
    const totalBookings = rows.filter(r => r.lead_status === 'booked' || r.booking_id).length

    const campaignMap: Record<string, { revenue: number; count: number }> = {}
    for (const r of rows) {
      if (!r.manual_campaign_label) continue
      if (!campaignMap[r.manual_campaign_label]) campaignMap[r.manual_campaign_label] = { revenue: 0, count: 0 }
      campaignMap[r.manual_campaign_label].revenue += r.booking_value_cents || 0
      campaignMap[r.manual_campaign_label].count++
    }
    const topCampaigns = Object.entries(campaignMap)
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)

    setAttrLeads(totalLeads)
    setAttrBookings(totalBookings)
    setAttrTopCampaigns(topCampaigns)
    setAttrLoading(false)
  }

  async function fetchStats() {
    setLoading(true)

    const now = new Date()
    let startDate: Date
    let prevStartDate: Date
    let prevEndDate: Date

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 86400000)
        prevStartDate = new Date(now.getTime() - 14 * 86400000)
        prevEndDate = startDate
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 86400000)
        prevStartDate = new Date(now.getTime() - 180 * 86400000)
        prevEndDate = startDate
        break
      case '12m':
        startDate = new Date(now.getTime() - 365 * 86400000)
        prevStartDate = new Date(now.getTime() - 730 * 86400000)
        prevEndDate = startDate
        break
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 86400000)
        prevStartDate = new Date(now.getTime() - 60 * 86400000)
        prevEndDate = startDate
    }

    // Current period jobs
    const { data: currentJobs } = await supabase
      .from('jobs')
      .select('id, total_price, payment_status, scheduled_at, service:services(name), customer:customers(full_name)')
      .eq('business_id', businessId)
      .gte('scheduled_at', startDate.toISOString())
      .order('scheduled_at', { ascending: false })

    // Previous period jobs
    const { data: prevJobs } = await supabase
      .from('jobs')
      .select('id, total_price')
      .eq('business_id', businessId)
      .gte('scheduled_at', prevStartDate.toISOString())
      .lt('scheduled_at', prevEndDate.toISOString())

    // Total customers
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)

    // New customers in period
    const { count: newCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())

    const currentRevenue = currentJobs?.reduce((sum, j) => sum + (j.total_price || 0), 0) || 0
    const prevRevenue = prevJobs?.reduce((sum, j) => sum + (j.total_price || 0), 0) || 0
    const avgJobValue = currentJobs?.length ? Math.round(currentRevenue / currentJobs.length) : 0

    // Top services
    const serviceCounts: Record<string, { name: string; count: number; revenue: number }> = {}
    for (const job of currentJobs || []) {
      const name = job.service?.name || 'Unknown'
      if (!serviceCounts[name]) serviceCounts[name] = { name, count: 0, revenue: 0 }
      serviceCounts[name].count++
      serviceCounts[name].revenue += job.total_price || 0
    }
    const topSvcs = Object.values(serviceCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // Monthly revenue (last 6 months)
    const monthly: Record<string, number> = {}
    const { data: allJobs } = await supabase
      .from('jobs')
      .select('total_price, scheduled_at')
      .eq('business_id', businessId)
      .gte('scheduled_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString())

    for (const job of allJobs || []) {
      const d = new Date(job.scheduled_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthly[key] = (monthly[key] || 0) + (job.total_price || 0)
    }

    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthlyData.push({
        month: MONTHS[d.getMonth()],
        revenue: monthly[key] || 0,
      })
    }

    setStats({
      totalRevenue: currentRevenue,
      prevRevenue,
      totalJobs: currentJobs?.length || 0,
      prevJobs: prevJobs?.length || 0,
      totalCustomers: totalCustomers || 0,
      newCustomers: newCustomers || 0,
      avgJobValue,
    })
    setRecentJobs((currentJobs || []).slice(0, 8))
    setTopServices(topSvcs)
    setMonthlyRevenue(monthlyData)
    setLoading(false)
  }

  function pctChange(current: number, prev: number) {
    if (prev === 0) return current > 0 ? 100 : 0
    return Math.round(((current - prev) / prev) * 100)
  }

  const revenueChange = pctChange(stats.totalRevenue, stats.prevRevenue)
  const jobsChange = pctChange(stats.totalJobs, stats.prevJobs)

  const maxMonthly = Math.max(...monthlyRevenue.map(m => m.revenue), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d', '12m'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === '12m' ? '12 months' : p === '90d' ? '90 days' : p === '30d' ? '30 days' : '7 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Attribution summary — this month */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Lead attribution — this month</h2>
          <Link href="/reports/attribution" className="text-xs text-brand-600 hover:underline">Full report →</Link>
        </div>
        {attrLoading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{attrLeads}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Leads</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{attrBookings}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Bookings</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-brand-600">
                  {attrLeads > 0 ? Math.round((attrBookings / attrLeads) * 100) : 0}%
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Conversion</p>
              </div>
            </div>
            {/* Top campaigns */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Top campaigns by revenue</p>
              {attrTopCampaigns.length === 0 ? (
                <p className="text-xs text-gray-400">No campaign data this month</p>
              ) : (
                <div className="space-y-2">
                  {attrTopCampaigns.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate max-w-[160px]">{c.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-gray-400">{c.count} lead{c.count !== 1 ? 's' : ''}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(c.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Revenue',
            value: formatCurrency(stats.totalRevenue),
            change: revenueChange,
            icon: DollarSign,
            color: 'text-green-600 bg-green-50',
          },
          {
            label: 'Bookings',
            value: stats.totalJobs,
            change: jobsChange,
            icon: Calendar,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Customers',
            value: stats.totalCustomers,
            sub: `+${stats.newCustomers} new`,
            icon: Users,
            color: 'text-purple-600 bg-purple-50',
          },
          {
            label: 'Avg job value',
            value: formatCurrency(stats.avgJobValue),
            icon: TrendingUp,
            color: 'text-amber-600 bg-amber-50',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            {stat.change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(stat.change)}% vs previous period
              </div>
            )}
            {stat.sub && <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly revenue chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Monthly revenue</h2>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {monthlyRevenue.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                    <div
                      className="w-full bg-brand-500 rounded-t-md transition-all"
                      style={{ height: `${Math.max((m.revenue / maxMonthly) * 96, m.revenue > 0 ? 4 : 0)}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top services */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Top services</h2>
          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : topServices.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((svc, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 truncate">{svc.name}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{formatCurrency(svc.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(svc.revenue / topServices[0].revenue) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{svc.count} job{svc.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attribution link */}
      <Link href="/reports/attribution" className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <BarChart2 className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Lead attribution</p>
            <p className="text-xs text-gray-500">See where your bookings are coming from</p>
          </div>
        </div>
        <span className="text-sm text-gray-400 group-hover:text-brand-600 transition-colors">View report →</span>
      </Link>

      {/* Recent bookings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Recent bookings</h2>
        </div>
        {loading ? (
          <div className="p-5 text-gray-400 text-sm">Loading...</div>
        ) : recentJobs.length === 0 ? (
          <div className="p-5 text-gray-400 text-sm">No bookings in this period</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Service</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Date</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentJobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900 font-medium">{job.customer?.full_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{job.service?.name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{job.scheduled_at ? formatDate(job.scheduled_at) : '—'}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(job.total_price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
