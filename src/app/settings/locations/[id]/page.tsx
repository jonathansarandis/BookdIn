// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { Loader2, CheckCircle2, ChevronLeft, Trash2 } from 'lucide-react'

const TIMEZONES = [
  { label: 'Melbourne / Sydney (AEST)', value: 'Australia/Melbourne' },
  { label: 'Brisbane (AEST no DST)', value: 'Australia/Brisbane' },
  { label: 'Adelaide (ACST)', value: 'Australia/Adelaide' },
  { label: 'Perth (AWST)', value: 'Australia/Perth' },
  { label: 'Darwin (ACST no DST)', value: 'Australia/Darwin' },
  { label: 'Hobart (AEST)', value: 'Australia/Hobart' },
  { label: 'Auckland (NZST)', value: 'Pacific/Auckland' },
  { label: 'London (GMT)', value: 'Europe/London' },
  { label: 'New York (EST)', value: 'America/New_York' },
  { label: 'Los Angeles (PST)', value: 'America/Los_Angeles' },
]

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${value ? 'bg-brand-500' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export default function LocationEditPage() {
  const router = useRouter()
  const params = useParams()
  const locationId = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [canDelete, setCanDelete] = useState(false)

  // Location fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState('Australia/Melbourne')
  const [thankYouUrl, setThankYouUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [locationId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', user.id)
      .single()

    const biz = Array.isArray(prof?.businesses) ? prof.businesses[0] : prof?.businesses
    setProfile(prof)
    setBusiness(biz)

    const [{ data: loc }, { data: locs }] = await Promise.all([
      supabase.from('locations').select('*').eq('id', locationId).single(),
      supabase.from('locations').select('id').eq('business_id', biz.id),
    ])

    if (!loc) { router.push('/settings/locations'); return }

    setName(loc.name || '')
    setSlug(loc.slug || '')
    setTimezone(loc.timezone || 'Australia/Melbourne')
    setThankYouUrl(loc.thank_you_url || '')
    setIsActive(loc.is_active ?? true)
    setCanDelete((locs?.length || 0) > 1)

    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('locations')
      .update({ name, slug, timezone, thank_you_url: thankYouUrl || null, is_active: isActive })
      .eq('id', locationId)
    setSaving(false)
    if (error) {
      setSaveError(error.message.includes('unique') ? 'That slug is already taken.' : error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)
    await supabase.from('locations').delete().eq('id', locationId)
    router.push('/settings/locations')
  }

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar profile={profile} business={business} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar profile={profile} business={business} />
          <main className="flex-1 overflow-y-auto p-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

            <div>
              <button
                onClick={() => router.push('/settings/locations')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Locations
              </button>
              <h2 className="text-lg font-semibold text-gray-900">{name || 'Edit location'}</h2>
            </div>

            {/* Basic info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Location details</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Active</span>
                  <Toggle value={isActive} onChange={setIsActive} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Location name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Booking URL slug</label>
                <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">bookdin.co/book/{slug || '…'}</p>
              </div>

              <div>
                <label className={labelCls}>Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                  {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Thank-you URL (optional)</label>
                <input
                  type="url"
                  value={thankYouUrl}
                  onChange={e => setThankYouUrl(e.target.value)}
                  placeholder="https://yourwebsite.com/thank-you"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Customers redirect here after booking. Receives <code className="font-mono">?booking_id=X&amount=Y&service=Z</code> params for conversion tracking.
                </p>
              </div>

              {saveError && <p className="text-xs text-red-600">{saveError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving…' : 'Save location'}
                </button>
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
            </div>

            {/* Delete */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Delete location</h3>
              {canDelete ? (
                <>
                  <p className="text-xs text-gray-500 mb-4">This will permanently remove this location and its pricing data.</p>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete location
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-red-700 font-medium">Are you sure? This cannot be undone.</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {deleting ? 'Deleting…' : 'Yes, delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500">Cannot delete the last location. Add another location first.</p>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
