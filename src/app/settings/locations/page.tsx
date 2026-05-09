// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { Loader2, MapPin, Plus, X } from 'lucide-react'

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

export default function LocationsListPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // New location form
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newTimezone, setNewTimezone] = useState('Australia/Melbourne')
  const [slugManual, setSlugManual] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

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

    if (biz?.id) {
      const { data: locs } = await supabase
        .from('locations')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at')
      setLocations(locs || [])
    }
    setLoading(false)
  }

  function handleNameChange(val: string) {
    setNewName(val)
    if (!slugManual) {
      const bizSlug = business?.booking_url_slug || ''
      const namePart = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      setNewSlug(bizSlug ? `${bizSlug}-${namePart}` : namePart)
    }
  }

  function openModal() {
    setNewName('')
    setNewSlug('')
    setNewTimezone('Australia/Melbourne')
    setSlugManual(false)
    setCreateError(null)
    setShowModal(true)
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) {
      setCreateError('Name and slug are required.')
      return
    }
    setCreating(true)
    setCreateError(null)

    const { data: loc, error } = await supabase
      .from('locations')
      .insert({
        business_id: business.id,
        name: newName.trim(),
        slug: newSlug.trim(),
        timezone: newTimezone,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      setCreateError(error.message.includes('unique') ? 'That slug is already taken — choose another.' : error.message)
      setCreating(false)
      return
    }

    // Seed location_services and location_extras for all existing services/extras
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('business_id', business.id)
      .eq('is_active', true)

    if (services?.length) {
      await supabase.from('location_services').insert(
        services.map((s: any) => ({
          location_id: loc.id,
          service_id: s.id,
          base_price: 0,
          is_enabled: false,
        }))
      )

      const { data: extras } = await supabase
        .from('service_extras')
        .select('id')
        .in('service_id', services.map((s: any) => s.id))

      if (extras?.length) {
        await supabase.from('location_extras').insert(
          extras.map((ex: any) => ({
            location_id: loc.id,
            extra_id: ex.id,
            price: 0,
            is_enabled: false,
          }))
        )
      }
    }

    router.push(`/settings/locations/${loc.id}`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Locations</h2>
                <p className="text-xs text-gray-500 mt-0.5">Each location has its own booking URL, timezone, and service pricing.</p>
              </div>
              <button
                onClick={openModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add location
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => router.push(`/settings/locations/${loc.id}`)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-brand-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{loc.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">/book/{loc.slug}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{loc.timezone}</p>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                ))}
                {locations.length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                    <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No locations yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add location modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Add location</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className={labelCls}>Location name</label>
              <input
                type="text"
                value={newName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Richmond, South Yarra"
                className={inputCls}
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>Booking URL slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={e => { setNewSlug(e.target.value); setSlugManual(true) }}
                placeholder="my-business-richmond"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">bookdin.co/book/{newSlug || '…'}</p>
            </div>

            <div>
              <label className={labelCls}>Timezone</label>
              <select value={newTimezone} onChange={e => setNewTimezone(e.target.value)} className={inputCls}>
                {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? 'Creating…' : 'Create location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
