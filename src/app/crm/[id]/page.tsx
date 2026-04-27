// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Phone, Mail, Clock, Plus, Loader2, FileText, CheckCircle2 } from 'lucide-react'

const STAGES = [
  { key: 'lead',      label: 'Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'quoted',    label: 'Quoted' },
  { key: 'won',       label: 'Won' },
  { key: 'lost',      label: 'Lost' },
]

const STAGE_COLORS: Record<string, string> = {
  lead:      'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-50 text-blue-700',
  quoted:    'bg-purple-50 text-purple-700',
  won:       'bg-green-50 text-green-700',
  lost:      'bg-red-50 text-red-700',
}

const ACTIVITY_ICONS: Record<string, any> = {
  note:       FileText,
  call:       Phone,
  email:      Mail,
  follow_up:  Clock,
  quote_sent: FileText,
  won:        CheckCircle2,
  lost:       CheckCircle2,
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function CRMContactPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [contact, setContact] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [showFollowupForm, setShowFollowupForm] = useState(false)

  const [activityForm, setActivityForm] = useState({
    type: 'note',
    title: '',
    body: '',
  })

  const [followupDate, setFollowupDate] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
    setBusinessId(profile?.business_id)

    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('crm_contacts').select('*').eq('id', params.id).single(),
      supabase.from('crm_activities').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    ])

    setContact(c)
    setActivities(a || [])
    setLoading(false)
  }

  async function handleStageChange(stage: string) {
    await supabase.from('crm_contacts').update({ stage, last_activity_at: new Date().toISOString() }).eq('id', params.id)
    
    // Log stage change as activity
    await supabase.from('crm_activities').insert({
      business_id: businessId,
      contact_id: params.id,
      user_id: userId,
      type: stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : 'note',
      title: `Stage changed to ${stage}`,
    })

    await fetchData()
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!activityForm.body.trim() && !activityForm.title.trim()) return
    setSaving(true)

    await supabase.from('crm_activities').insert({
      business_id: businessId,
      contact_id: params.id,
      user_id: userId,
      type: activityForm.type,
      title: activityForm.title || null,
      body: activityForm.body || null,
    })

    await supabase.from('crm_contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', params.id)

    setActivityForm({ type: 'note', title: '', body: '' })
    setShowActivityForm(false)
    setSaving(false)
    await fetchData()
  }

  async function handleSetFollowup(e: React.FormEvent) {
    e.preventDefault()
    if (!followupDate) return
    setSaving(true)

    await supabase.from('crm_contacts').update({ next_followup_at: followupDate }).eq('id', params.id)

    await supabase.from('crm_activities').insert({
      business_id: businessId,
      contact_id: params.id,
      user_id: userId,
      type: 'follow_up',
      title: `Follow up scheduled for ${formatDateTime(followupDate)}`,
      scheduled_at: followupDate,
    })

    setFollowupDate('')
    setShowFollowupForm(false)
    setSaving(false)
    await fetchData()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
  if (!contact) return <div className="text-sm text-gray-400 py-8 text-center">Contact not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{contact.full_name}</h1>
            {contact.source && <p className="text-sm text-gray-500 capitalize">{contact.source}</p>}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STAGE_COLORS[contact.stage]}`}>
          {contact.stage}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">

          {/* Activities */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Activity</h2>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="flex gap-2">
                  {['note', 'call', 'email', 'follow_up'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActivityForm({ ...activityForm, type: t })}
                      className={`px-3 py-1 text-xs rounded-full font-medium capitalize transition-colors ${
                        activityForm.type === t
                          ? 'bg-brand-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={activityForm.title}
                  onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Title (optional)"
                />
                <textarea
                  rows={3}
                  value={activityForm.body}
                  onChange={e => setActivityForm({ ...activityForm, body: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Add a note, call summary, or email..."
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                  <button type="button" onClick={() => setShowActivityForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {activities.map(activity => {
                  const Icon = ACTIVITY_ICONS[activity.type] || FileText
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {activity.title && (
                          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        )}
                        {activity.body && (
                          <p className="text-sm text-gray-600 mt-0.5">{activity.body}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(activity.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Contact info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Contact info</h2>
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${contact.email}`} className="text-brand-600 hover:underline truncate">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${contact.phone}`} className="text-gray-700">{contact.phone}</a>
              </div>
            )}
            {contact.notes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-600">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Stage */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-3">Move stage</h2>
            {STAGES.map(stage => (
              <button
                key={stage.key}
                onClick={() => handleStageChange(stage.key)}
                disabled={contact.stage === stage.key}
                className={`w-full py-2 px-3 text-sm rounded-lg text-left transition-colors ${
                  contact.stage === stage.key
                    ? `${STAGE_COLORS[stage.key]} font-medium cursor-default`
                    : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {stage.label}
                {contact.stage === stage.key && ' ✓'}
              </button>
            ))}
          </div>

          {/* Follow up */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Follow up</h2>
              <button
                onClick={() => setShowFollowupForm(!showFollowupForm)}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                {contact.next_followup_at ? 'Change' : 'Set'}
              </button>
            </div>

            {contact.next_followup_at && (
              <div className={`flex items-center gap-2 text-sm ${
                new Date(contact.next_followup_at) < new Date() ? 'text-red-600' : 'text-amber-600'
              }`}>
                <Clock className="w-4 h-4" />
                {formatDateTime(contact.next_followup_at)}
              </div>
            )}

            {showFollowupForm && (
              <form onSubmit={handleSetFollowup} className="space-y-2">
                <input
                  type="datetime-local"
                  value={followupDate}
                  onChange={e => setFollowupDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={saving || !followupDate}
                  className="w-full py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Set follow up'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
