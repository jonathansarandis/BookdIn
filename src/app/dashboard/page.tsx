// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
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
  if (!businessId) return <div className="p-8" style={{ color: 'rgba(200,212,240,0.5)' }}>No business found.</div>

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: todayJobs },
    { data: recentActivity },
    { data: pendingJobs },
    { count: customerCount },
    { data: monthJobs },
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
      .is('provider_id', null)
      .not('status', 'in', '("completed","cancelled")'),
    supabase.from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId),
    supabase.from('jobs')
      .select('total_price')
      .eq('business_id', businessId)
      .gte('scheduled_at', monthStart),
  ])

  const completedToday = todayJobs?.filter(j => j.status === 'completed').length || 0
  const upcomingToday  = todayJobs?.filter(j => !['completed','cancelled'].includes(j.status)).length || 0
  const monthRevenue   = monthJobs?.reduce((sum, j) => sum + (j.total_price || 0), 0) || 0

  const ACTIVITY_COLORS: Record<string, string> = {
    booking_created:  '#22c55e',
    payment_received: '#2563FF',
    job_completed:    '#4D8CFF',
    job_assigned:     '#a855f7',
    payment_failed:   '#ef4444',
    quote_accepted:   '#F59E0B',
  }

  const card = { background: '#111827', border: '1px solid rgba(37,99,255,0.15)', borderRadius: '12px' }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue this month', value: formatCurrency(monthRevenue), delta: 'This month', icon: TrendingUp, color: '#22c55e' },
          { label: 'Jobs today',         value: String(todayJobs?.length || 0), delta: `${completedToday} done · ${upcomingToday} upcoming`, icon: Calendar, color: '#4D8CFF' },
          { label: 'Unassigned jobs',    value: String(pendingJobs?.length || 0), delta: 'Need attention', icon: AlertCircle, color: '#F59E0B' },
          { label: 'Customers',          value: String(customerCount || 0), delta: 'Total', icon: Users, color: '#2563FF' },
        ].map((s) => (
          <div key={s.label} style={card} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(200,212,240,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</p>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon style={{ width: '14px', height: '14px', color: s.color }} />
              </div>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#F0F2FF', lineHeight: 1, fontFamily: "'NeueKabel', 'Arial Black', sans-serif" }}>{s.value}</p>
            <p style={{ fontSize: '12px', marginTop: '6px', color: 'rgba(200,212,240,0.4)' }}>{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Today's jobs */}
        <div className="lg:col-span-2" style={card}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(37,99,255,0.1)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#F0F2FF' }}>Today's bookings</h2>
            <Link href="/calendar" style={{ fontSize: '12px', color: '#4D8CFF', textDecoration: 'none', fontWeight: 500 }}>
              View calendar →
            </Link>
          </div>
          <div>
            {todayJobs && todayJobs.length > 0 ? todayJobs.map((job: any) => (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                style={{ borderBottom: '1px solid rgba(37,99,255,0.06)', textDecoration: 'none' }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(200,212,240,0.4)', fontFamily: 'monospace', width: '52px', flexShrink: 0 }}>
                  {new Date(job.scheduled_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.customer?.full_name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(200,212,240,0.4)', marginTop: '1px' }}>{job.service?.name}</p>
                </div>
                {job.provider?.display_name ? (
                  <span style={{ fontSize: '12px', color: 'rgba(200,212,240,0.5)' }}>{job.provider.display_name}</span>
                ) : (
                  <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 500 }}>⚠ Unassigned</span>
                )}
                <span className={cn('status-pill', JOB_STATUS_COLORS[job.status])} style={{ fontSize: '11px' }}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </Link>
            )) : (
              <div className="py-12 text-center">
                <Calendar style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: 'rgba(200,212,240,0.15)' }} />
                <p style={{ fontSize: '13px', color: 'rgba(200,212,240,0.3)' }}>No bookings today</p>
                <Link href="/booking" style={{ fontSize: '12px', color: '#4D8CFF', textDecoration: 'none', marginTop: '4px', display: 'inline-block' }}>
                  + Create a booking
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Live activity */}
        <div style={card}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(37,99,255,0.1)' }}>
            <h2 className="flex items-center gap-2" style={{ fontSize: '13px', fontWeight: 600, color: '#F0F2FF' }}>
              <span style={{ width: '7px', height: '7px', background: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live activity
            </h2>
            <Zap style={{ width: '14px', height: '14px', color: 'rgba(200,212,240,0.2)' }} />
          </div>
          <div>
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((log: any) => (
              <div key={log.id} className="flex gap-3 px-5 py-3" style={{ borderBottom: '1px solid rgba(37,99,255,0.06)' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: ACTIVITY_COLORS[log.event_type] || 'rgba(200,212,240,0.3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', color: 'rgba(200,212,240,0.7)', lineHeight: 1.5 }}>{log.description}</p>
                  <p style={{ fontSize: '10px', color: 'rgba(200,212,240,0.3)', marginTop: '2px' }}>
                    {new Date(log.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-10 text-center">
                <Clock style={{ width: '24px', height: '24px', margin: '0 auto 8px', color: 'rgba(200,212,240,0.15)' }} />
                <p style={{ fontSize: '13px', color: 'rgba(200,212,240,0.3)' }}>Activity will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
