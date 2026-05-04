'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  initialScheduledAt: string | null
  durationMinutes: number | null
}

function toDateInput(iso: string): string {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function toTimeInput(iso: string): string {
  const d = new Date(iso)
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':')
}

export default function ScheduleEditor({ jobId, initialScheduledAt, durationMinutes }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt)
  const [draftDate, setDraftDate] = useState(initialScheduledAt ? toDateInput(initialScheduledAt) : '')
  const [draftTime, setDraftTime] = useState(initialScheduledAt ? toTimeInput(initialScheduledAt) : '09:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayDate = scheduledAt
    ? new Date(scheduledAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const displayTime = scheduledAt
    ? new Date(scheduledAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  async function save() {
    if (!draftDate || !draftTime) return
    setSaving(true)
    setError(null)
    const newScheduledAt = new Date(`${draftDate}T${draftTime}:00`).toISOString()
    const supabase = createClient()
    const { error: err } = await supabase
      .from('jobs')
      .update({ scheduled_at: newScheduledAt })
      .eq('id', jobId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setScheduledAt(newScheduledAt)
    setDraftDate(toDateInput(newScheduledAt))
    setDraftTime(toTimeInput(newScheduledAt))
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  function cancel() {
    if (scheduledAt) {
      setDraftDate(toDateInput(scheduledAt))
      setDraftTime(toTimeInput(scheduledAt))
    }
    setEditing(false)
    setError(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Schedule</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit schedule"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={draftDate}
                onChange={e => setDraftDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={draftTime}
                onChange={e => setDraftTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !draftDate || !draftTime}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{displayDate}</span>
            </div>
          )}
          {displayTime && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{displayTime}</span>
            </div>
          )}
          {durationMinutes && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{durationMinutes} minutes</span>
            </div>
          )}
          {saved && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </p>
          )}
        </div>
      )}
    </div>
  )
}
