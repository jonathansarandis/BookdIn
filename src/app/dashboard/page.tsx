// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Calendar, CreditCard, UserCog, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return <div className="p-8 text-gray-500">No business found.</div>

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString()

  const [
    { data: todayJobs },
    { data: bookedToday },
    { data: awaitingPayment },
    { data: pendingProvider },
    { data: recentActivity },
    { data: monthJobs },
    { data: lastMonthJobs },
    { data: thirtyDayJobs },
    { data: prevThirtyJobs },
    { count: customerCount },
    { data: businessData },
  ] = await Promise.all([
    supabase.from('jobs').select('*, customer:customers(full_name), service:services(name), provider:providers(display_name, color), address:addresses(line1, city, state)')
      .eq('business_id', businessId).gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd).order('scheduled_at'),
    supabase.from('jobs').select('id').eq('business_id', businessId).gte('created_at', todayStart),
    supabase.from('jobs').select('id').eq('business_id', businessId).eq('payment_status', 'unpaid').not('status', 'in', '("cancelled")'),
    supabase.from('jobs').select('id').eq('business_id', businessId).is('provider_id', null).not('status', 'in', '("completed","cancelled")'),
    supabase.from('activity_logs').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(8),
    supabase.from('jobs').select('total_price').eq('business_id', businessId).gte('scheduled_at', monthStart),
    supabase.from('jobs').select('total_price').eq('business_id', businessId).gte('scheduled_at', lastMonthStart).lt('scheduled_at', lastMonthEnd),
    supabase.from('jobs').select('total_price, created_at').eq('business_id', businessId).gte('created_at', thirtyDaysAgo).order('created_at'),
    supabase.from('jobs').select('total_price').eq('business_id', businessId).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    supabase.from('businesses').select('name').eq('id', businessId).single(),
  ])

  const monthRevenue = monthJobs?.reduce((s, j) => s + (j.total_price || 0), 0) || 0
  const lastMonthRevenue = lastMonthJobs?.reduce((s, j) => s + (j.total_price || 0), 0) || 0
  const thirtyRevenue = thirtyDayJobs?.reduce((s, j) => s + (j.total_price || 0), 0) || 0
  const prevThirtyRevenue = prevThirtyJobs?.reduce((s, j) => s + (j.total_price || 0), 0) || 0

  function pct(curr: number, prev: number) {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const revenueChange = pct(monthRevenue, lastMonthRevenue)
  const bookingChange = pct(thirtyDayJobs?.length || 0, prevThirtyJobs?.length || 0)
  const avgBookingValue = thirtyDayJobs?.length ? Math.round(thirtyRevenue / thirtyDayJobs.length) : 0

  // 30-day chart
  const dailyRevenue: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  for (const job of thirtyDayJobs || []) {
    const key = new Date(job.created_at).toISOString().slice(0, 10)
    if (key in dailyRevenue) dailyRevenue[key] += (job.total_price || 0)
  }
  const chartValues = Object.values(dailyRevenue)
  const maxChart = Math.max(...chartValues, 1)

  const ACTIVITY_COLORS: Record<string, string> = {
    booking_created: 'bg-green-400',
    payment_received: 'bg-blue-400',
    job_completed: 'bg-brand-500',
    job_assigned: 'bg-purple-400',
    payment_failed: 'bg-red-400',
    quote_accepted: 'bg-amber-400',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{getGreeting()}, {businessData?.name || 'there'}</p>
        </div>
        <Link href="/booking" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#0A0F1E', textDecoration: 'none' }}>
          + Create Booking
        </Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Booked Today', value: bookedToday?.length || 0, icon: Calendar, color: '#2563FF', bg: '#eff6ff' },
          { label: 'Scheduled Today', value: todayJobs?.length || 0, icon: Calendar, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Awaiting Payment', value: awaitingPayment?.length || 0, icon: CreditCard, color: '#d97706', bg: '#fffbeb' },
          { label: 'Pending Provider', value: pendingProvider?.length || 0, icon: UserCog, color: '#dc2626', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">{s.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Summary + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Bookings Summary</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Last 30 Days</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">{thirtyDayJobs?.length || 0} Bookings Created</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(thirtyRevenue)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${bookingChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {bookingChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(bookingChange)}% vs prev period
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">This Month</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(monthRevenue)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revenueChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {revenueChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(revenueChange)}% vs last month
              </div>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-14">
            {chartValues.map((v, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max((v / maxChart) * 56, v > 0 ? 3 : 0)}px`, background: v > 0 ? '#2563FF' : '#f3f4f6', opacity: 0.6 + (i / chartValues.length) * 0.4 }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">30 days ago</span>
            <span className="text-[10px] text-gray-400">Today</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Metrics</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Last 30 Days</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Gross Sales', value: formatCurrency(thirtyRevenue), change: revenueChange },
              { label: 'Total Customers', value: String(customerCount || 0), change: null },
              { label: 'Avg Booking Value', value: formatCurrency(avgBookingValue), change: null },
              { label: 'Bookings Created', value: String(thirtyDayJobs?.length || 0), change: bookingChange },
            ].map(m => (
              <div key={m.label} className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <p className="text-xl font-bold text-gray-900">{m.value}</p>
                {m.change !== null && (
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${m.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(m.change)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + Today's Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              Activity
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Live
              </span>
            </h2>
            <Zap className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((log: any) => (
              <div key={log.id} className="flex gap-3 px-5 py-3">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', ACTIVITY_COLORS[log.event_type] || 'bg-gray-300')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{log.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-gray-400 text-sm">Activity will appear here</div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <Link href="/jobs" className="text-xs font-medium text-blue-600 hover:underline" style={{ textDecoration: 'none' }}>View All →</Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Today's Bookings</h2>
            <Link href="/jobs?filter=today" className="text-xs font-medium text-blue-600" style={{ textDecoration: 'none' }}>View All →</Link>
          </div>
          {todayJobs && todayJobs.length > 0 ? (
            <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: '400px' }}>
              {todayJobs.map((job: any) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block px-5 py-4 hover:bg-gray-50 transition-colors" style={{ textDecoration: 'none' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{job.customer?.full_name}</p>
                        <p className="text-xs text-blue-500">Booking details</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">${((job.total_price || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="ml-3 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Time:</span>
                      <span className="text-gray-700 font-medium">{new Date(job.scheduled_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                    {job.address && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-gray-700 font-medium text-right ml-4 truncate max-w-[180px]">{job.address.line1}, {job.address.city}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-gray-400">Provider:</span>
                      {job.provider ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: job.provider.color || '#2563FF' }}>
                            {job.provider.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-gray-700 font-medium">{job.provider.display_name}</span>
                        </div>
                      ) : <span className="text-amber-600 font-medium">Unassigned</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bookings today</p>
              <Link href="/booking" className="text-xs text-blue-600 mt-1 inline-block" style={{ textDecoration: 'none' }}>+ Create a booking</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
