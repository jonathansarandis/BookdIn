// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Loader2, CheckCircle2, Copy, X, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'

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

function PriceInput({ value, onChange, placeholder = '0.00' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-28">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}

function buildSvcMap(
  services: any[],
  locSvcs: any[],
): Record<string, { base_price: string; is_enabled: boolean }> {
  const map: Record<string, { base_price: string; is_enabled: boolean }> = {}
  for (const s of services) {
    const row = locSvcs.find((r: any) => r.service_id === s.id)
    map[s.id] = {
      base_price: row ? String((row.base_price / 100).toFixed(2)) : '0.00',
      is_enabled: row?.is_enabled ?? false,
    }
  }
  return map
}

// Empty string = no location override (will resolve to service_override or global default)
function buildExtMap(
  extras: any[],
  locExts: any[],
): Record<string, { price: string; is_enabled: boolean }> {
  const map: Record<string, { price: string; is_enabled: boolean }> = {}
  for (const ex of extras) {
    const row = locExts.find((r: any) => r.extra_id === ex.id)
    map[ex.id] = {
      price: row?.price != null ? String((row.price / 100).toFixed(2)) : '',
      is_enabled: row?.is_enabled ?? false,
    }
  }
  return map
}

function buildJuncMap(junctions: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {}
  for (const j of junctions) {
    if (!map[j.extra_id]) map[j.extra_id] = []
    map[j.extra_id].push(j)
  }
  return map
}

function buildLocSvcOrder(locSvcs: any[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of locSvcs) map[row.service_id] = row.sort_order
  return map
}

function sortByLocOrder(svcs: any[], locSvcOrder: Record<string, number>): any[] {
  return [...svcs].sort((a, b) => {
    const aOrder = locSvcOrder[a.id] ?? a.sort_order
    const bOrder = locSvcOrder[b.id] ?? b.sort_order
    return aOrder - bOrder
  })
}

function SortableServiceRow({ svc, locServices, setLocServices, openEditSvc }: {
  svc: any
  locServices: Record<string, { base_price: string; is_enabled: boolean }>
  setLocServices: (fn: (m: any) => any) => void
  openEditSvc: (svc: any) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: svc.id })
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? ('relative' as const) : undefined,
    zIndex: isDragging ? 1 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Toggle
        value={locServices[svc.id]?.is_enabled ?? false}
        onChange={v => setLocServices(m => ({ ...m, [svc.id]: { ...m[svc.id], is_enabled: v } }))}
      />
      <span className="flex-1 text-sm text-gray-900 min-w-0 truncate">{svc.name}</span>
      <PriceInput
        value={locServices[svc.id]?.base_price ?? '0.00'}
        onChange={v => setLocServices(m => ({ ...m, [svc.id]: { ...m[svc.id], base_price: v } }))}
      />
      <button
        onClick={() => openEditSvc(svc)}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
        title="Edit service"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function ServicesPage() {
  const supabase = createClient()

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Locations
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'services' | 'addons'>('services')

  // Global catalogs
  const [allServices, setAllServices] = useState<any[]>([])
  const [allExtras, setAllExtras] = useState<any[]>([])
  // service_extras junction: extra_id → [{service_id, price_override, sort_order}]
  const [extraJunctions, setExtraJunctions] = useState<Record<string, any[]>>({})

  // Per-location state
  const [locServices, setLocServices] = useState<Record<string, { base_price: string; is_enabled: boolean }>>({})
  const [locExtras, setLocExtras] = useState<Record<string, { price: string; is_enabled: boolean }>>({})
  const [locLoading, setLocLoading] = useState(false)

  // Save state
  const [svcSaving, setSvcSaving] = useState(false)
  const [svcSaved, setSvcSaved] = useState(false)
  const [extraSaving, setExtraSaving] = useState(false)
  const [extraSaved, setExtraSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setAllServices(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id)
      const newIdx = prev.findIndex(s => s.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  // Edit service modal
  const [editSvc, setEditSvc] = useState<any | null>(null)
  const [editSvcName, setEditSvcName] = useState('')
  const [editSvcDesc, setEditSvcDesc] = useState('')
  const [editSvcDuration, setEditSvcDuration] = useState('')
  const [editSvcSaving, setEditSvcSaving] = useState(false)

  // Edit extra modal (id=null means new add-on)
  const [editExtra, setEditExtra] = useState<any | null>(null)
  const [editExtraName, setEditExtraName] = useState('')
  const [editExtraDesc, setEditExtraDesc] = useState('')
  const [editExtraDuration, setEditExtraDuration] = useState('')
  const [editExtraDefaultPrice, setEditExtraDefaultPrice] = useState('')
  const [editExtraMappedSvcIds, setEditExtraMappedSvcIds] = useState<Set<string>>(new Set())
  const [editExtraSvcOverrides, setEditExtraSvcOverrides] = useState<Record<string, string>>({})
  const [editExtraDisclosureOpen, setEditExtraDisclosureOpen] = useState(false)
  const [editExtraIsQuoteOnly, setEditExtraIsQuoteOnly] = useState(false)
  const [editExtraIsPopular, setEditExtraIsPopular] = useState(false)
  const [editExtraSaving, setEditExtraSaving] = useState(false)

  // Delete-reassign modal (services)
  const [reassignTarget, setReassignTarget] = useState<{ id: string; name: string; jobCount: number } | null>(null)
  const [reassignToId, setReassignToId] = useState<string>('')
  const [reassigning, setReassigning] = useState(false)

  // Copy modal
  const [showCopy, setShowCopy] = useState(false)
  const [copyStep, setCopyStep] = useState<'config' | 'confirm'>('config')
  const [copySourceId, setCopySourceId] = useState<string>('')
  const [copyServices, setCopyServices] = useState(true)
  const [copyAddons, setCopyAddons] = useState(true)
  const [copyPrices, setCopyPrices] = useState(true)
  const [copyOverwrite, setCopyOverwrite] = useState(false)
  const [copySourceData, setCopySourceData] = useState<{ svcs: any[]; exts: any[] } | null>(null)
  const [copyCount, setCopyCount] = useState<{ services: number; addons: number; overlaps: number } | null>(null)
  const [copyApplying, setCopyApplying] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()

    const bizId = profile?.business_id
    setBusinessId(bizId)

    const [{ data: locs }, { data: svcs }, { data: exts }] = await Promise.all([
      supabase.from('locations').select('id, name').eq('business_id', bizId).order('name'),
      supabase.from('services')
        .select('id, name, description, duration_minutes, pricing_type, base_price, is_active, sort_order')
        .eq('business_id', bizId).order('sort_order'),
      supabase.from('extras')
        .select('id, name, description, default_price, default_duration_minutes, is_active, is_quote_only, sort_order')
        .eq('business_id', bizId).order('sort_order'),
    ])

    setLocations(locs || [])
    setAllServices(svcs || [])
    setAllExtras(exts || [])

    // Load junction map (service_extras: which extras map to which services)
    const svcIds = (svcs || []).map(s => s.id)
    const { data: junctions } = svcIds.length > 0
      ? await supabase.from('service_extras')
          .select('extra_id, service_id, price_override, sort_order')
          .in('service_id', svcIds)
      : { data: [] }
    setExtraJunctions(buildJuncMap(junctions || []))

    if (locs?.length) {
      const firstId = locs[0].id
      setSelectedLocationId(firstId)
      const [{ data: locSvcs }, { data: locExts }] = await Promise.all([
        supabase.from('location_services').select('service_id, base_price, is_enabled, sort_order').eq('location_id', firstId),
        supabase.from('location_extras').select('extra_id, price, is_enabled').eq('location_id', firstId),
      ])
      const locSvcOrder = buildLocSvcOrder(locSvcs || [])
      const sorted = sortByLocOrder(svcs || [], locSvcOrder)
      setAllServices(sorted)
      setLocServices(buildSvcMap(sorted, locSvcs || []))
      setLocExtras(buildExtMap(exts || [], locExts || []))
    }

    setLoading(false)
  }

  async function handleLocationChange(newLocId: string) {
    setSelectedLocationId(newLocId)
    setSvcSaved(false)
    setExtraSaved(false)
    setLocLoading(true)
    const [{ data: locSvcs }, { data: locExts }] = await Promise.all([
      supabase.from('location_services').select('service_id, base_price, is_enabled, sort_order').eq('location_id', newLocId),
      supabase.from('location_extras').select('extra_id, price, is_enabled').eq('location_id', newLocId),
    ])
    const locSvcOrder = buildLocSvcOrder(locSvcs || [])
    const sorted = sortByLocOrder(allServices, locSvcOrder)
    setAllServices(sorted)
    setLocServices(buildSvcMap(sorted, locSvcs || []))
    setLocExtras(buildExtMap(allExtras, locExts || []))
    setLocLoading(false)
  }

  async function reloadLocationData() {
    if (!selectedLocationId) return
    const [{ data: locSvcs }, { data: locExts }] = await Promise.all([
      supabase.from('location_services').select('service_id, base_price, is_enabled, sort_order').eq('location_id', selectedLocationId),
      supabase.from('location_extras').select('extra_id, price, is_enabled').eq('location_id', selectedLocationId),
    ])
    const locSvcOrder = buildLocSvcOrder(locSvcs || [])
    const sorted = sortByLocOrder(allServices, locSvcOrder)
    setAllServices(sorted)
    setLocServices(buildSvcMap(sorted, locSvcs || []))
    setLocExtras(buildExtMap(allExtras, locExts || []))
  }

  async function reloadExtrasData() {
    if (!businessId) return
    const svcIds = allServices.map(s => s.id)
    const [{ data: exts }, { data: junctions }] = await Promise.all([
      supabase.from('extras')
        .select('id, name, description, default_price, default_duration_minutes, is_active, is_quote_only, sort_order')
        .eq('business_id', businessId).order('sort_order'),
      svcIds.length > 0
        ? supabase.from('service_extras')
            .select('extra_id, service_id, price_override, sort_order')
            .in('service_id', svcIds)
        : Promise.resolve({ data: [] }),
    ])
    setAllExtras(exts || [])
    setExtraJunctions(buildJuncMap(junctions || []))
  }

  // ── Services tab ────────────────────────────────────────────

  async function handleSaveServices() {
    setSvcSaving(true)
    const rows = allServices.map((s, idx) => ({
      location_id: selectedLocationId,
      service_id: s.id,
      base_price: Math.round(parseFloat(locServices[s.id]?.base_price || '0') * 100),
      is_enabled: locServices[s.id]?.is_enabled ?? false,
      sort_order: idx,
    }))
    await supabase.from('location_services').upsert(rows, { onConflict: 'location_id,service_id' })
    setSvcSaving(false)
    setSvcSaved(true)
    setTimeout(() => setSvcSaved(false), 3000)
  }

  function openEditSvc(svc: any) {
    setEditSvc(svc)
    setEditSvcName(svc.name)
    setEditSvcDesc(svc.description || '')
    setEditSvcDuration(String(svc.duration_minutes))
  }

  async function handleSaveEditSvc() {
    if (!editSvc) return
    setEditSvcSaving(true)
    const duration = parseInt(editSvcDuration) || editSvc.duration_minutes
    await supabase
      .from('services')
      .update({ name: editSvcName, description: editSvcDesc || null, duration_minutes: duration })
      .eq('id', editSvc.id)
    setAllServices(prev =>
      prev.map(s => s.id === editSvc.id ? { ...s, name: editSvcName, description: editSvcDesc, duration_minutes: duration } : s)
    )
    setEditSvcSaving(false)
    setEditSvc(null)
  }

  async function handleDeleteSvc(id: string, name: string) {
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', id)

    if (!count || count === 0) {
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
      await supabase.from('services').delete().eq('id', id)
      setAllServices(prev => prev.filter(s => s.id !== id))
      setEditSvc(null)
      return
    }

    setEditSvc(null)
    setReassignTarget({ id, name, jobCount: count })
  }

  async function confirmReassignAndDelete() {
    if (!reassignTarget || !reassignToId) return
    if (reassignToId === reassignTarget.id) { alert('Pick a different service.'); return }
    setReassigning(true)
    try {
      const { error: updErr } = await supabase.from('jobs').update({ service_id: reassignToId }).eq('service_id', reassignTarget.id)
      if (updErr) throw new Error('Reassign failed: ' + updErr.message)
      const { error: delErr } = await supabase.from('services').delete().eq('id', reassignTarget.id)
      if (delErr) throw new Error('Delete failed: ' + delErr.message)
      setAllServices(prev => prev.filter(s => s.id !== reassignTarget.id))
      setReassignTarget(null)
      setReassignToId('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setReassigning(false)
    }
  }

  // ── Add-ons tab ─────────────────────────────────────────────

  async function handleSaveExtras() {
    setExtraSaving(true)
    const rows = allExtras.map(ex => {
      const priceStr = locExtras[ex.id]?.price
      return {
        location_id: selectedLocationId,
        extra_id: ex.id,
        price: priceStr && priceStr.trim() !== '' ? Math.round(parseFloat(priceStr) * 100) : null,
        is_enabled: locExtras[ex.id]?.is_enabled ?? false,
      }
    })
    await supabase.from('location_extras').upsert(rows, { onConflict: 'location_id,extra_id' })
    setExtraSaving(false)
    setExtraSaved(true)
    setTimeout(() => setExtraSaved(false), 3000)
  }

  function openNewExtra() {
    setEditExtra({ id: null })
    setEditExtraName('')
    setEditExtraDesc('')
    setEditExtraDuration('0')
    setEditExtraDefaultPrice('0.00')
    setEditExtraMappedSvcIds(new Set())
    setEditExtraSvcOverrides({})
    setEditExtraDisclosureOpen(false)
    setEditExtraIsQuoteOnly(false)
  }

  function openEditExtra(ex: any) {
    const junctions = extraJunctions[ex.id] || []
    setEditExtra(ex)
    setEditExtraName(ex.name)
    setEditExtraDesc(ex.description || '')
    setEditExtraDuration(String(ex.default_duration_minutes || 0))
    setEditExtraDefaultPrice(String((ex.default_price / 100).toFixed(2)))
    setEditExtraMappedSvcIds(new Set(junctions.map((j: any) => j.service_id)))
    const overrides: Record<string, string> = {}
    for (const j of junctions) {
      if (j.price_override !== null && j.price_override !== undefined) {
        overrides[j.service_id] = String((j.price_override / 100).toFixed(2))
      }
    }
    setEditExtraSvcOverrides(overrides)
    setEditExtraDisclosureOpen(false)
    setEditExtraIsQuoteOnly(ex.is_quote_only ?? false)
    setEditExtraIsPopular(ex.is_popular ?? false)
  }

  function getPriceOverrideValue(svcId: string): number | null {
    const str = editExtraSvcOverrides[svcId]
    if (!str || str.trim() === '') return null
    const val = parseFloat(str)
    return isNaN(val) ? null : Math.round(val * 100)
  }

  async function handleSaveEditExtra() {
    if (!editExtra) return
    setEditExtraSaving(true)
    try {
      const defaultPrice = Math.round(parseFloat(editExtraDefaultPrice || '0') * 100)
      const duration = parseInt(editExtraDuration) || 0

      let extraId = editExtra.id

      if (extraId) {
        await supabase.from('extras').update({
          name: editExtraName,
          description: editExtraDesc || null,
          default_duration_minutes: duration,
          default_price: defaultPrice,
          is_quote_only: editExtraIsQuoteOnly,
          is_popular: editExtraIsPopular,
        }).eq('id', extraId)
      } else {
        const { data: newEx, error } = await supabase.from('extras').insert({
          business_id: businessId,
          name: editExtraName,
          description: editExtraDesc || null,
          default_duration_minutes: duration,
          default_price: defaultPrice,
          is_active: true,
          is_quote_only: editExtraIsQuoteOnly,
          is_popular: editExtraIsPopular,
          sort_order: allExtras.length,
        }).select('id').single()
        if (error || !newEx) throw new Error(error?.message || 'Failed to create add-on')
        extraId = newEx.id
      }

      // Junction diff: remove unmapped services
      const currentJunctions = extraJunctions[extraId] || []
      const currentSvcIds = new Set(currentJunctions.map((j: any) => j.service_id))
      const toRemove = [...currentSvcIds].filter(id => !editExtraMappedSvcIds.has(id))

      if (toRemove.length > 0) {
        await supabase.from('service_extras').delete()
          .eq('extra_id', extraId).in('service_id', toRemove)
      }

      // Upsert all mapped services with their price_override
      if (editExtraMappedSvcIds.size > 0) {
        const rows = [...editExtraMappedSvcIds].map(svcId => ({
          extra_id: extraId,
          service_id: svcId,
          price_override: getPriceOverrideValue(svcId),
          sort_order: 0,
        }))
        await supabase.from('service_extras').upsert(rows, { onConflict: 'service_id,extra_id' })
      }

      await reloadExtrasData()
      // Reload location-specific data too (new extra may need a location_extras row)
      await reloadLocationData()
      setEditExtra(null)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setEditExtraSaving(false)
    }
  }

  async function handleDeleteExtra(exId: string, exName: string) {
    if (!confirm(`Delete "${exName}"? This removes it from all services and locations and cannot be undone.`)) return
    // Cascades to service_extras junction and location_extras
    await supabase.from('extras').delete().eq('id', exId)
    setAllExtras(prev => prev.filter(ex => ex.id !== exId))
    setExtraJunctions(prev => { const next = { ...prev }; delete next[exId]; return next })
    setEditExtra(null)
  }

  // ── Copy modal ──────────────────────────────────────────────

  function openCopyModal() {
    setShowCopy(true)
    setCopyStep('config')
    setCopySourceId('')
    setCopyServices(true)
    setCopyAddons(true)
    setCopyPrices(true)
    setCopyOverwrite(false)
    setCopySourceData(null)
    setCopyCount(null)
  }

  async function handleCopyNext() {
    if (!copySourceId || (!copyServices && !copyAddons)) return

    const [sourceSvcsRes, sourceExtsRes, targetSvcsRes, targetExtsRes] = await Promise.all([
      copyServices
        ? supabase.from('location_services').select('service_id, base_price').eq('location_id', copySourceId).eq('is_enabled', true)
        : Promise.resolve({ data: [] }),
      copyAddons
        ? supabase.from('location_extras').select('extra_id, price').eq('location_id', copySourceId).eq('is_enabled', true)
        : Promise.resolve({ data: [] }),
      supabase.from('location_services').select('service_id').eq('location_id', selectedLocationId),
      supabase.from('location_extras').select('extra_id').eq('location_id', selectedLocationId),
    ])

    const sourceSvcs = sourceSvcsRes.data || []
    const sourceExts = sourceExtsRes.data || []
    const targetSvcIds = new Set((targetSvcsRes.data || []).map((r: any) => r.service_id))
    const targetExtIds = new Set((targetExtsRes.data || []).map((r: any) => r.extra_id))

    const overlapSvcs = sourceSvcs.filter((r: any) => targetSvcIds.has(r.service_id)).length
    const overlapExts = sourceExts.filter((r: any) => targetExtIds.has(r.extra_id)).length

    setCopySourceData({ svcs: sourceSvcs, exts: sourceExts })
    setCopyCount({ services: sourceSvcs.length, addons: sourceExts.length, overlaps: overlapSvcs + overlapExts })
    setCopyStep('confirm')
  }

  async function handleCopyApply() {
    if (!copySourceData) return
    setCopyApplying(true)

    if (copyServices && copySourceData.svcs.length > 0) {
      const rows = copySourceData.svcs.map((r: any) => ({
        location_id: selectedLocationId,
        service_id: r.service_id,
        base_price: copyPrices ? r.base_price : 0,
        is_enabled: true,
      }))
      await supabase
        .from('location_services')
        .upsert(rows, { onConflict: 'location_id,service_id', ignoreDuplicates: !copyOverwrite })
    }

    if (copyAddons && copySourceData.exts.length > 0) {
      const rows = copySourceData.exts.map((r: any) => ({
        location_id: selectedLocationId,
        extra_id: r.extra_id,
        price: copyPrices ? r.price : null,
        is_enabled: true,
      }))
      await supabase
        .from('location_extras')
        .upsert(rows, { onConflict: 'location_id,extra_id', ignoreDuplicates: !copyOverwrite })
    }

    await reloadLocationData()
    setCopyApplying(false)
    setShowCopy(false)
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>

  const selectedLocation = locations.find(l => l.id === selectedLocationId)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Services & Add-ons</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage what you offer and set pricing per location</p>
        </div>
        {activeTab === 'services' ? (
          <Link
            href="/services/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add service
          </Link>
        ) : (
          <button
            onClick={openNewExtra}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New add-on
          </button>
        )}
      </div>

      {/* Location selector */}
      {locations.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">Editing:</span>
            <select
              value={selectedLocationId}
              onChange={e => handleLocationChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={openCopyModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy from another location
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {(['services', 'addons'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'services' ? 'Services' : 'Add-ons'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {locLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : activeTab === 'services' ? (

        /* ── Services sub-tab ── */
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-500">
            Name, description, and duration apply to all locations. Price and availability are set per location.
          </p>

          {allServices.length === 0 ? (
            <p className="text-sm text-gray-400">No services yet. Add your first service to get started.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {allServices.map(svc => (
                    <SortableServiceRow
                      key={svc.id}
                      svc={svc}
                      locServices={locServices}
                      setLocServices={setLocServices}
                      openEditSvc={openEditSvc}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveServices}
              disabled={svcSaving || !selectedLocationId}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {svcSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {svcSaving ? 'Saving…' : `Save services for ${selectedLocation?.name ?? 'location'}`}
            </button>
            {svcSaved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>

      ) : (

        /* ── Add-ons sub-tab ── */
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-500">
            One row per add-on globally. Toggle on/off per location and set a location price override (leave blank to use the service or global default).
          </p>

          {allExtras.length === 0 ? (
            <p className="text-sm text-gray-400">No add-ons yet. Click "New add-on" to create one.</p>
          ) : (
            <div className="space-y-1">
              {allExtras.map(ex => {
                const junctions = extraJunctions[ex.id] || []
                return (
                  <div key={ex.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="mt-0.5">
                      <Toggle
                        value={locExtras[ex.id]?.is_enabled ?? false}
                        onChange={v => setLocExtras(m => ({ ...m, [ex.id]: { ...m[ex.id], is_enabled: v } }))}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900">{ex.name}</span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs text-gray-400">
                          Default ${(ex.default_price / 100).toFixed(2)}
                        </span>
                        {junctions.map((j: any) => {
                          const svc = allServices.find(s => s.id === j.service_id)
                          return svc ? (
                            <span key={j.service_id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                              {svc.name}{j.price_override != null ? ` $${(j.price_override / 100).toFixed(2)}` : ''}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <PriceInput
                      value={locExtras[ex.id]?.price ?? ''}
                      placeholder="default"
                      onChange={v => setLocExtras(m => ({ ...m, [ex.id]: { ...m[ex.id], price: v } }))}
                    />
                    <button
                      onClick={() => openEditExtra(ex)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0 mt-0.5"
                      title="Edit add-on"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveExtras}
              disabled={extraSaving || !selectedLocationId}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {extraSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {extraSaving ? 'Saving…' : `Save add-ons for ${selectedLocation?.name ?? 'location'}`}
            </button>
            {extraSaved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Edit service modal */}
      {editSvc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Edit service</h2>
              <button onClick={() => setEditSvc(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500">Name, description, and duration apply to all locations. Price and availability are set per location.</p>
            <div>
              <label className={labelCls}>Name</label>
              <input type="text" value={editSvcName} onChange={e => setEditSvcName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={3} value={editSvcDesc} onChange={e => setEditSvcDesc(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Duration (minutes)</label>
              <input type="number" min="1" value={editSvcDuration} onChange={e => setEditSvcDuration(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleDeleteSvc(editSvc.id, editSvc.name)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditSvc(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditSvc}
                  disabled={editSvcSaving || !editSvcName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {editSvcSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editSvcSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / New add-on modal */}
      {editExtra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 my-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {editExtra.id ? 'Edit add-on' : 'New add-on'}
              </h2>
              <button onClick={() => setEditExtra(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <p className="text-xs text-gray-500">
              Global fields apply to all locations. Enable/price per location is set from the Add-ons tab list.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Name</label>
                <input type="text" value={editExtraName} onChange={e => setEditExtraName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Default price (global)</label>
                <div className={editExtraIsQuoteOnly ? 'opacity-50 pointer-events-none' : ''}>
                  <PriceInput value={editExtraDefaultPrice} onChange={setEditExtraDefaultPrice} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Default duration (min)</label>
                <input type="number" min="0" value={editExtraDuration} onChange={e => setEditExtraDuration(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2 flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-gray-700">Popular</span>
                  <p className="text-xs text-gray-400">Show in Popular add-ons section on booking form</p>
                </div>
                <div
                  onClick={() => setEditExtraIsPopular(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ml-4 ${editExtraIsPopular ? 'bg-brand-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editExtraIsPopular ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-gray-700">Quote on arrival</span>
                  <p className="text-xs text-gray-400">Price is agreed on site — shows as "Quote on arrival" on the booking form</p>
                </div>
                <div
                  onClick={() => setEditExtraIsQuoteOnly(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ml-4 ${editExtraIsQuoteOnly ? 'bg-brand-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editExtraIsQuoteOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} value={editExtraDesc} onChange={e => setEditExtraDesc(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Service mapping */}
            <div>
              <label className={labelCls}>Applies to services</label>
              {allServices.length === 0 ? (
                <p className="text-xs text-gray-400">No services found.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {allServices.map(svc => (
                    <label key={svc.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editExtraMappedSvcIds.has(svc.id)}
                        onChange={e => {
                          setEditExtraMappedSvcIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(svc.id)
                            else next.delete(svc.id)
                            return next
                          })
                        }}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700">{svc.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Per-service price override disclosure */}
            {editExtraMappedSvcIds.size > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEditExtraDisclosureOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>Set different price per service</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${editExtraDisclosureOpen ? 'rotate-180' : ''}`} />
                </button>
                {editExtraDisclosureOpen && (
                  <div className="border-t border-gray-200 p-3 space-y-2 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">Leave blank to use the global default price. Set a value to override for that service only.</p>
                    {[...editExtraMappedSvcIds].map(svcId => {
                      const svc = allServices.find(s => s.id === svcId)
                      if (!svc) return null
                      return (
                        <div key={svcId} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">{svc.name}</span>
                          <PriceInput
                            value={editExtraSvcOverrides[svcId] ?? ''}
                            placeholder="default"
                            onChange={v => setEditExtraSvcOverrides(prev => ({ ...prev, [svcId]: v }))}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {editExtra.id ? (
                <button
                  onClick={() => handleDeleteExtra(editExtra.id, editExtra.name)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button onClick={() => setEditExtra(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditExtra}
                  disabled={editExtraSaving || !editExtraName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {editExtraSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editExtraSaving ? 'Saving…' : editExtra.id ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign-then-delete modal */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Delete "{reassignTarget.name}"</h2>
            <p className="text-sm text-gray-600">
              This service has {reassignTarget.jobCount} existing booking{reassignTarget.jobCount === 1 ? '' : 's'}.
              To delete it, choose another service to reassign those bookings to.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reassign bookings to:</label>
              <select
                value={reassignToId}
                onChange={e => setReassignToId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                disabled={reassigning}
              >
                <option value="">Select a service…</option>
                {allServices.filter(s => s.id !== reassignTarget.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setReassignTarget(null); setReassignToId('') }}
                disabled={reassigning}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReassignAndDelete}
                disabled={!reassignToId || reassigning}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {reassigning ? 'Reassigning…' : 'Reassign & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy from location modal */}
      {showCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Copy from another location</h2>
              <button onClick={() => setShowCopy(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            {copyStep === 'config' ? (
              <>
                <div>
                  <label className={labelCls}>Copy from</label>
                  <select
                    value={copySourceId}
                    onChange={e => setCopySourceId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a location…</option>
                    {locations.filter(l => l.id !== selectedLocationId).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">What to copy</p>
                  {[
                    { key: 'services', label: 'Services (enabled + prices)', value: copyServices, set: setCopyServices },
                    { key: 'addons', label: 'Add-on settings (enabled + location prices)', value: copyAddons, set: setCopyAddons },
                    { key: 'prices', label: 'Include prices', value: copyPrices, set: setCopyPrices },
                  ].map(({ key, label, value, set }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={e => set(e.target.checked)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={copyOverwrite}
                      onChange={e => setCopyOverwrite(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">Overwrite existing</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setShowCopy(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={handleCopyNext}
                    disabled={!copySourceId || (!copyServices && !copyAddons)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm text-gray-700">
                  {copyServices && (
                    <p>
                      Copy <strong>{copyCount?.services ?? 0} service{copyCount?.services !== 1 ? 's' : ''}</strong> to <strong>{selectedLocation?.name}</strong>.
                    </p>
                  )}
                  {copyAddons && (
                    <p>
                      Copy add-on settings for <strong>{copyCount?.addons ?? 0} add-on{copyCount?.addons !== 1 ? 's' : ''}</strong> to <strong>{selectedLocation?.name}</strong>.
                    </p>
                  )}
                  {(copyCount?.overlaps ?? 0) > 0 && (
                    <p className="text-gray-500">
                      {copyCount?.overlaps} existing row{copyCount?.overlaps !== 1 ? 's' : ''} will be{' '}
                      {copyOverwrite ? 'overwritten' : 'skipped (Overwrite is off)'}.
                    </p>
                  )}
                  {!copyPrices && (
                    <p className="text-gray-500">Prices will not be copied.</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setCopyStep('config')}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCopyApply}
                    disabled={copyApplying}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {copyApplying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {copyApplying ? 'Applying…' : 'Apply'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
