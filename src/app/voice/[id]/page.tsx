// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Phone, Clock, ExternalLink, PlayCircle } from 'lucide-react'

export default function VoiceCallDetailPage() {
  const params = useParams()
  const [call, setCall] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchCall() }, [params.id])

  async function fetchCall() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()

    const { data: callRow } = await supabase
      .from('voice_calls')
      .select('*')
      .eq('id', params.id)
      .eq('business_id', profile?.business_id)
      .single()
    setCall(callRow)

    if (callRow?.booking_id) {
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('id, scheduled_at, total_price, status, customers(full_name), services(name)')
        .eq('id', callRow.booking_id)
        .single()
      setJob(jobRow)
    }
    setLoading(false)
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
  if (!call) return <div className="text-center py-16 text-gray-400 text-sm">Call not found.</div>

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <Link href="/voice" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to calls
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" /> {call.phone_number_from || 'Unknown caller'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(call.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '—'}
          </div>
        </div>

        {call.recording_url && (
          <a
            href={call.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
          >
            <PlayCircle className="w-4 h-4" /> Listen to recording
          </a>
        )}
      </div>

      {job && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-green-800 mb-2">Booking created</h3>
          <p className="text-sm text-green-700">
            {job.services?.name} for {job.customers?.full_name} — {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
          </p>
          <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-sm text-green-800 font-medium mt-2 hover:underline">
            View booking <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Transcript</h3>
        {call.transcript ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
        ) : (
          <p className="text-sm text-gray-400">No transcript available for this call.</p>
        )}
      </div>
    </div>
  )
}
