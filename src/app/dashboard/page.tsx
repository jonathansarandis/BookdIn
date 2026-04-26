// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
import { TrendingUp, Calendar, AlertCircle, Users, Clock, Zap } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('business_id').eq('id', user.id).single()

  const businessId = profile?.business_id
  if (!businessId) return <div className="p-8 text-gray-500">No business found. Please complete setup.</div>

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: todayJobs },
    { data: recentActivity },
    { data: pendingJobs },
    { count: customerCount },
  ] = await Promise.all([
    supabase.from('jobs')
      .select('*, customer:customers(full_name), service:services(name), provider:providers(display_name)')
      .eq('business_id', businessId)
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd)
      .order('scheduled_at'),
    supabase.from('activity_logs')
      .select('*').eq('business_id', businessId)
      .order('created_at', { ascending: false }).limit(8),
    supabase.from('jobs')
      .select('id').eq('business_id', businessId)
      .eq('status', 'pending'),
    supabase.from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId),
  ])

  const completedToday = todayJobs?.filter(j => j.status === 'completed').length || 0
  const upcomingToday  = todayJobs?.filter(j => !['completed','cancelled'].includes(j.status)).length || 0

  const ACTIVITY_COLORS: Record<string, string> = {
    booking_created:  'bg-green-400',
    payment_received: 'bg-blue-400',
    job_completed:    'bg-brand-500',
    job_assigned:     'bg-purple-400',
    payment_failed:   'bg-red-400',
    quote_accepted:   'bg-amber-400',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue this month', value: formatCurrency(842000), delta: '+14%', up: true, icon: TrendingUp },
          { label: "Jobs today", value: String(todayJobs?.length || 0), delta: `${completedToday} done · ${upcomingToday} upcoming`, icon: Calendar },
          { label: 'Unassigned jobs', value: String(pendingJobs?.length || 0), delta: 'Need attention', up: false, warn: true, icon: AlertCircle },
          { label: 'Customers', value: String(customerCount || 0), delta: '+3 this week', up: true, icon: Users },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className={cn('w-4 h-4', s.warn ? 'text-amber-500' : 'text-gray-300')} />
            </div>
            <p className={cn('text-2xl font-semibold tracking-tight', s.warn && 'text-amber-600')}>{s.value}</p>
            <p className={cn('text-xs mt-1', s.up ? 'text-green-600' : s.warn ? 'text-amber-600' : 'text-gray-400')}>{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's jobs */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Today&apos;s jobs</h2>
            <Link href="/calendar" className="text-xs text-brand-600 hover:underline font-medium">View calendar →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {todayJobs && todayJobs.length > 0 ? todayJobs.map((job: any) => (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="text-xs text-gray-400 font-mono w-14 flex-shrink-0">
                  {new Date(job.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.customer?.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{job.service?.name}</p>
                </div>
                {job.provider?.display_name ? (
                  <span className="text-xs text-gray-500 hidden sm:block">{job.provider.display_name}</span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium hidden sm:block">⚠ Unassigned</span>
                )}
                <span className={cn('status-pill', JOB_STATUS_COLORS[job.status])}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </Link>
            )) : (
              <div className="py-12 text-center text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No jobs scheduled for today</p>
                <Link href="/booking" className="text-xs text-brand-600 hover:underline mt-1 inline-block">+ Create a booking</Link>
              </div>
            )}
          </div>
        </div>

        {/* Live activity */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live activity
            </h2>
            <Zap className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((log: any) => (
              <div key={log.id} className="flex gap-3 px-5 py-3">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', ACTIVITY_COLORS[log.event_type] || 'bg-gray-300')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">{log.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                Activity will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
