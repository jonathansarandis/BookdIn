'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  initialNotes: string | null
}

export default function NotesEditor({ jobId, initialNotes }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('jobs')
      .update({ notes: draft.trim() || null })
      .eq('id', jobId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setNotes(draft.trim())
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  function cancel() {
    setDraft(notes)
    setEditing(false)
    setError(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Notes</h2>
        {!editing && (
          <button
            onClick={() => { setDraft(notes); setEditing(true) }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit notes"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            placeholder="Add notes, access instructions, anything relevant..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
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
        <div>
          {notes ? (
            <p className="text-sm text-gray-600">{notes}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes yet</p>
          )}
          {saved && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </p>
          )}
        </div>
      )}
    </div>
  )
}
