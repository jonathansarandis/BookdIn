// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, MapPin, CheckCircle2, LogOut, User } from 'lucide-react'

const STATUS_STYLES: Record<string, any> = {
  pending:     { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
  confirmed:   { bg: '#eff6ff', color: '#2563FF', label: 'Confirmed' },
  in_progress: { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
  completed:   { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
  cancelled:   { bg: '#f9fafb', color: '#6b7280', label: 'Cancelled' },
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function ProviderDashboard() {
  const [provider, setProvider] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'completed'>('today')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/provider/login'); return }

    // Find provider record linked to this user
    const { data: providerData } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!providerData) {
      // Not a provider — redirect to main app
      router.push('/dashboard')
      return
    }

    setProvider(providerData)

    // Get all upcoming jobs for this provider
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*, customer:customers(full_name, phone, email), service:services(name), address:addresses(line1, city, state, postcode)')
      .eq('provider_id', providerData.id)
      .not('status', 'in', '("cancelled")')
      .order('scheduled_at', { ascending: true })

    setJobs(jobsData || [])
    setLoading(false)
  }

  async function updateStatus(jobId: string, status: string) {
    await supabase.from('jobs').update({ status }).eq('id', jobId)
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/provider/login')
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const todayJobs = jobs.filter(j => j.scheduled_at >= todayStart && j.scheduled_at < todayEnd && j.status !== 'completed')
  const upcomingJobs = jobs.filter(j => j.scheduled_at >= todayEnd && j.status !== 'completed')
  const completedJobs = jobs.filter(j => j.status === 'completed').slice(0, 20)

  const displayJobs = activeTab === 'today' ? todayJobs : activeTab === 'upcoming' ? upcomingJobs : completedJobs

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
        <div style={{ color: 'rgba(200,212,240,0.5)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3F4F6' }}>
      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(37,99,255,0.15)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '20px', color: '#F0F2FF' }}>
              Bookd<span style={{ color: '#2563FF' }}>In</span>
            </div>
            <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '12px' }}>Provider Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: provider?.color || '#2563FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                {provider?.display_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p style={{ color: '#F0F2FF', fontSize: '13px', fontWeight: 500 }}>{provider?.display_name}</p>
              </div>
            </div>
            <button onClick={handleSignOut} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '8px', padding: '6px 12px', color: 'rgba(200,212,240,0.6)', fontSize: '12px', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Today', value: todayJobs.length, color: '#2563FF' },
            { label: 'Upcoming', value: upcomingJobs.length, color: '#7c3aed' },
            { label: 'Completed', value: completedJobs.length, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['today', 'upcoming', 'completed'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-md text-xs font-medium capitalize transition-all"
              style={{ background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Jobs list */}
        {displayJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No {activeTab} jobs</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'today' ? "You're all clear for today" : activeTab === 'upcoming' ? 'No upcoming jobs scheduled' : 'No completed jobs yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayJobs.map(job => {
              const statusStyle = STATUS_STYLES[job.status] || STATUS_STYLES.pending
              return (
                <div key={job.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Job header */}
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{job.customer?.full_name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{job.service?.name}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {statusStyle.label}
                      </span>
                    </div>
                  </div>

                  {/* Job details */}
                  <div className="px-5 py-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{formatDate(job.scheduled_at)}</span>
                      <span className="text-gray-400">at</span>
                      <span className="font-medium">{formatTime(job.scheduled_at)}</span>
                    </div>
                    {job.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(`${job.address.line1}, ${job.address.city} ${job.address.state}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {job.address.line1}, {job.address.city} {job.address.state} {job.address.postcode}
                        </a>
                      </div>
                    )}
                    {job.customer?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <a href={`tel:${job.customer.phone}`} className="text-blue-600 hover:underline">
                          {job.customer.phone}
                        </a>
                      </div>
                    )}
                    {job.duration_minutes && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{job.duration_minutes} minutes</span>
                      </div>
                    )}
                    {(job.notes || job.customer_notes) && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-medium text-amber-700 mb-1">Notes</p>
                        <p className="text-sm text-amber-800">{job.notes || job.customer_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {job.status !== 'completed' && job.status !== 'cancelled' && (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                      {job.status === 'pending' || job.status === 'confirmed' ? (
                        <button
                          onClick={() => updateStatus(job.id, 'in_progress')}
                          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                          style={{ background: '#7c3aed' }}
                        >
                          Start job
                        </button>
                      ) : null}
                      {job.status === 'in_progress' ? (
                        <button
                          onClick={() => updateStatus(job.id, 'completed')}
                          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                          style={{ background: '#16a34a' }}
                        >
                          Mark complete
                        </button>
                      ) : null}
                      {job.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(job.id, 'confirmed')}
                          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                          style={{ background: '#eff6ff', color: '#2563FF' }}
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
