// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Phone, PhoneIncoming, Clock, CheckCircle2, ArrowRightCircle, XCircle } from 'lucide-react'

// Rolling 7-day window rather than "since Monday" — a calendar-week cutoff means the
// stats card reads 0 for most of Monday/Tuesday every week regardless of actual call
// volume, which reads as "broken" rather than "just reset." Rolling window stays
// meaningful every day.
function last7Days() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function statusBadge(call: any) {
  if (call.booking_id) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Booked</span>
  }
  if (call.status === 'message_taken') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><ArrowRightCircle className="w-3 h-3" /> Message taken</span>
  }
  if (call.status === 'transferred') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><ArrowRightCircle className="w-3 h-3" /> Transferred</span>
  }
  if (call.status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Not booked</span>
  }
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{call.status || 'In progress'}</span>
}

export default function VoiceDashboardPage() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchCalls() }, [])

  async function fetchCalls() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
    const { data } = await supabase
      .from('voice_calls')
      .select('*')
      .eq('business_id', profile?.business_id)
      .order('created_at', { ascending: false })
      .limit(200)
    setCalls(data || [])
    setLoading(false)
  }

  const windowStart = last7Days()
  const callsThisWeek = calls.filter(c => new Date(c.created_at) >= windowStart)
  const bookingsThisWeek = callsThisWeek.filter(c => c.booking_id)
  const conversionRate = callsThisWeek.length > 0 ? Math.round((bookingsThisWeek.length / callsThisWeek.length) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Voice agent</h1>
        <p className="text-sm text-gray-500 mt-0.5">Calls answered and booked automatically by your AI agent.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2"><PhoneIncoming className="w-4 h-4" /><span className="text-xs font-medium">Calls (last 7 days)</span></div>
          <p className="text-2xl font-bold text-gray-900">{callsThisWeek.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2"><CheckCircle2 className="w-4 h-4" /><span className="text-xs font-medium">Bookings from voice</span></div>
          <p className="text-2xl font-bold text-gray-900">{bookingsThisWeek.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2"><Phone className="w-4 h-4" /><span className="text-xs font-medium">Conversion rate</span></div>
          <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No calls yet.</p>
            <p className="text-xs text-gray-400 mt-1">Enable the voice agent in Settings to start taking calls.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Date/time</th>
                <th className="px-5 py-3 font-medium">Caller</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr
                  key={call.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/voice/${call.id}`}
                >
                  <td className="px-5 py-3 text-gray-900">
                    {new Date(call.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{call.phone_number_from || 'Unknown'}</td>
                  <td className="px-5 py-3 text-gray-500 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDuration(call.duration_seconds)}</td>
                  <td className="px-5 py-3">{statusBadge(call)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
