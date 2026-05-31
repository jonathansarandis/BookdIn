// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ServicePickerField from './builtins/ServicePickerField'
import RoomCountsField from './builtins/RoomCountsField'
import ExtrasPickerField from './builtins/ExtrasPickerField'
import FrequencyPickerField from './builtins/FrequencyPickerField'
import DateTimePickerField from './builtins/DateTimePickerField'
import AddressField from './builtins/AddressField'
import ContactInfoField from './builtins/ContactInfoField'
import TncCheckboxField from './builtins/TncCheckboxField'
import CustomFieldInput from './CustomFieldInput'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'

export interface BookingFormRendererProps {
  businessId: string
  locationId: string
  mode: 'live' | 'preview'
  previewData?: {
    form: { title: string | null; subtitle: string | null }
    steps: Array<{
      id: string
      sort_order: number
      next_button_label: string
      is_submit_step: boolean
      submit_button_label: string | null
    }>
    placements: Array<{
      id: string
      step_id: string
      builtin_field_key: string | null
      custom_field_id: string | null
      sort_order: number
    }>
    customFields: Array<{
      id: string
      label: string
      field_type: string
      options: any
      required: boolean
    }>
  }
  onSubmitSuccess?: (jobId: string) => void
  thankYouUrl?: string | null
  prefetchedBusiness?: {
    id: string
    name: string
    logo_url: string | null
    brand_color: string | null
    timezone: string | null
    tax_rate: number | null
    tax_name: string | null
    show_tax: boolean | null
    tax_mode: string | null
    tnc_url: string | null
  } | null
  prefetchedLocation?: {
    id: string
    timezone: string | null
  } | null
}

export default function BookingFormRenderer({
  businessId,
  locationId,
  mode,
  previewData,
  onSubmitSuccess,
  thankYouUrl,
  prefetchedBusiness,
  prefetchedLocation,
}: BookingFormRendererProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    form: any
    steps: any[]
    placements: any[]
    customFields: any[]
    services: any[]
    business: any
    frequencyDiscounts: any[]
    locationId: string
    junctions: any[]
    locExtraMap: Record<string, number | null>
  } | null>(null)

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [roomPricing, setRoomPricing] = useState<any[]>([])
  const [values, setValues] = useState<Record<string, any>>({
    service_id: null,
    room_counts: { bedrooms: null, bathrooms: null },
    extras: [],
    frequency: 'one_time',
    date_time: { scheduled_date: '', scheduled_time: 'flexible', is_flexible: true },
    address: { line1: '', city: '', state: '', postcode: '' },
    contact_info: { full_name: '', email: '', phone: '', customer_notes: '' },
    tnc_accepted: false,
    custom: {},
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [businessId, locationId, mode])

  useEffect(() => {
    if (!values.service_id) return
    supabase
      .from('room_pricing')
      .select('*')
      .eq('service_id', values.service_id)
      .then(({ data }) => setRoomPricing(data || []))
  }, [values.service_id])

  async function handleSubmit() {
    if (mode === 'preview') return
    if (submitting || !formData) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const svc = formData.services.find((s: any) => s.id === values.service_id)
      if (!svc) throw new Error('No service selected')

      // Re-derive extras for this service from raw junctions so price uses the correct
      // (service_id, extra_id) combination, not a cached merged value.
      const selectedExtraObjects = (formData.junctions || [])
        .filter((j: any) => j.service_id === svc.id && values.extras.includes(j.extras?.id))
        .map((j: any) => ({
          price: (formData.locExtraMap || {})[j.extras.id] ?? j.price_override ?? j.extras.default_price,
          is_quote_only: j.extras?.is_quote_only ?? false,
        }))

      const breakdown = calcJobPrice({
        service: { id: svc.id, base_price: svc.base_price, pricing_type: svc.pricing_type, duration_minutes: svc.duration_minutes },
        bedrooms: svc.pricing_type === 'room_based' ? values.room_counts.bedrooms : null,
        bathrooms: svc.pricing_type === 'room_based' ? values.room_counts.bathrooms : null,
        selectedExtras: selectedExtraObjects.map((ex: any) => ({ price: ex.price, is_quote_only: ex.is_quote_only })),
        roomPricing: roomPricing,
      })

      const discountPct = formData.frequencyDiscounts.find(
        (d: any) => d.frequency === values.frequency && d.is_enabled
      )?.discount_percent ?? 0
      const discounted = applyFrequencyDiscount(breakdown.total, discountPct)
      const effectiveTaxRate = formData.business.show_tax && formData.business.tax_rate > 0 ? formData.business.tax_rate : 0
      const taxSplit = calcTaxSplit(discounted, formData.business.tax_mode ?? 'exclusive', effectiveTaxRate)

      // Read attribution: fresh URL params first (most reliable in iframe contexts where
      // the parent rewrites our src after mount), cookie as fallback.
      let attribution = { gclid: null as string | null, gbraid: null as string | null, wbraid: null as string | null }
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const urlGclid  = urlParams.get('gclid')
        const urlGbraid = urlParams.get('gbraid')
        const urlWbraid = urlParams.get('wbraid')

        let cookieAttribution: { gclid: string | null; gbraid: string | null; wbraid: string | null } = { gclid: null, gbraid: null, wbraid: null }
        const match = document.cookie.match(/(^| )bookdin_attribution=([^;]+)/)
        if (match) {
          const parsed = JSON.parse(decodeURIComponent(match[2]))
          cookieAttribution = {
            gclid: parsed.gclid || null,
            gbraid: parsed.gbraid || null,
            wbraid: parsed.wbraid || null,
          }
        }

        attribution = {
          gclid:  urlGclid  || cookieAttribution.gclid  || null,
          gbraid: urlGbraid || cookieAttribution.gbraid || null,
          wbraid: urlWbraid || cookieAttribution.wbraid || null,
        }
      } catch { /* best-effort attribution capture */ }

      const payload = {
        business_id: businessId,
        location_id: locationId,
        service_id: values.service_id,
        frequency: values.frequency,
        scheduled_date: values.date_time.scheduled_date,
        scheduled_time: values.date_time.is_flexible ? 'flexible' : values.date_time.scheduled_time,
        total_price: taxSplit.total,
        tax_amount: taxSplit.tax,
        extras: values.extras,
        customer: {
          full_name: values.contact_info.full_name,
          email: values.contact_info.email,
          phone: values.contact_info.phone,
        },
        address: {
          line1: values.address.line1,
          city: values.address.city,
          state: values.address.state,
          postcode: values.address.postcode,
        },
        customer_notes: values.contact_info.customer_notes || null,
        bedrooms: svc.pricing_type === 'room_based' ? values.room_counts.bedrooms : null,
        bathrooms: svc.pricing_type === 'room_based' ? values.room_counts.bathrooms : null,
        custom_field_values: values.custom,
        tnc_accepted_at: values.tnc_accepted ? new Date().toISOString() : null,
        tnc_url_at_acceptance: values.tnc_accepted ? formData.business.tnc_url : null,
        attribution,
      }

      const res = await fetch('/api/bookings/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking could not be submitted')

      if (thankYouUrl) {
        // Break out of iframe if embedded (e.g. Elementor popup on cleanfreaks.au)
        try {
          if (window.top && window.top !== window.self) {
            window.top.location.href = thankYouUrl
          } else {
            window.location.href = thankYouUrl
          }
        } catch {
          // Cross-origin top access denied — fall back to navigating self
          window.location.href = thankYouUrl
        }
        return
      }
      setSubmittedJobId(data.job_id)
      onSubmitSuccess?.(data.job_id)
    } catch (e: any) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      // 1. Business + location — use prefetched data when available (public anon path),
      //    otherwise fetch directly (form builder preview, authenticated contexts)
      let business: any
      let location: any

      if (prefetchedBusiness && prefetchedLocation) {
        business = prefetchedBusiness
        location = prefetchedLocation
      } else {
        const { data: biz, error: bizErr } = await supabase
          .from('businesses')
          .select('id, name, logo_url, brand_color, timezone, tax_rate, tax_name, show_tax, tax_mode, tnc_url')
          .eq('id', businessId)
          .single()
        if (bizErr || !biz) throw new Error(bizErr?.message || 'Business not found')
        business = biz

        const { data: loc } = await supabase
          .from('locations')
          .select('id, timezone')
          .eq('id', locationId)
          .single()
        location = loc
      }

      const timezone = business.timezone || location?.timezone || null

      // 3. Fetch services via location_services.
      //    Price resolution (three layers):
      //      1. location_extras.price        (per-location override, null = no override)
      //      2. service_extras.price_override (per-service override, null = no override)
      //      3. extras.default_price          (global default, always set)
      //    service_extras is queried separately (not nested inside location_services) to
      //    ensure price_override comes through — deep 3-level PostgREST embeds drop
      //    junction-level fields before they reach the client.
      const { data: locSvcsRaw } = await supabase
        .from('location_services')
        .select(`
          base_price, is_enabled,
          services!inner (
            id, name, description, pricing_type, duration_minutes,
            is_active, sort_order
          )
        `)
        .eq('location_id', locationId)
        .eq('is_enabled', true)
        .eq('services.is_active', true)
        .order('sort_order', { foreignTable: 'services' })

      const svcIds = (locSvcsRaw || []).map((row: any) => row.services?.id).filter(Boolean)

      const [{ data: locExtrasRaw }, { data: junctionsRaw }] = await Promise.all([
        supabase
          .from('location_extras')
          .select('extra_id, price, is_enabled')
          .eq('location_id', locationId)
          .eq('is_enabled', true),
        svcIds.length > 0
          ? supabase
              .from('service_extras')
              .select(`
                service_id, price_override, sort_order,
                extras!inner (
                  id, name, description,
                  default_price, default_duration_minutes,
                  is_active, is_popular, is_quote_only, sort_order
                )
              `)
              .in('service_id', svcIds)
          : Promise.resolve({ data: [] }),
      ])

      // Map of extras.id → location price override (null = no location override)
      const locExtraMap: Record<string, number | null> = {}
      for (const le of locExtrasRaw || []) locExtraMap[le.extra_id] = le.price ?? null

      const services: any[] = (locSvcsRaw || []).map((row: any) => ({
        ...row.services,
        base_price: row.base_price,
      }))

      // 4. Fetch frequency discounts
      const { data: fdData } = await supabase
        .from('frequency_discounts')
        .select('frequency, discount_percent, is_enabled')
        .eq('business_id', businessId)

      const frequencyDiscounts = fdData || []

      // 5. Form structure — skip in preview mode, use previewData instead
      let form: any
      let steps: any[]
      let placements: any[]
      let customFields: any[]

      if (mode === 'preview' && previewData) {
        form = previewData.form
        steps = previewData.steps
        placements = previewData.placements
        customFields = previewData.customFields
      } else {
        const { data: formRow, error: formErr } = await supabase
          .from('booking_forms')
          .select('id, title, subtitle')
          .eq('business_id', businessId)
          .single()
        if (formErr || !formRow) throw new Error('No booking form found for this business')

        form = formRow

        const { data: stepsData } = await supabase
          .from('booking_form_steps')
          .select('id, form_id, sort_order, next_button_label, is_submit_step, submit_button_label')
          .eq('form_id', formRow.id)
          .order('sort_order')

        steps = stepsData || []

        const stepIds = steps.map((s: any) => s.id)
        const { data: placementsData } = stepIds.length > 0
          ? await supabase
              .from('booking_form_field_placements')
              .select('id, step_id, builtin_field_key, custom_field_id, sort_order')
              .in('step_id', stepIds)
              .order('sort_order')
          : { data: [] }

        placements = placementsData || []

        const { data: cfData } = await supabase
          .from('custom_fields')
          .select('id, label, field_type, options, required, sort_order, default_value')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('sort_order')

        customFields = cfData || []
      }

      setFormData({
        form,
        steps,
        placements,
        customFields,
        services,
        business: { ...business, timezone },
        frequencyDiscounts,
        locationId,
        junctions: junctionsRaw || [],
        locExtraMap,
      })

      // Seed custom field defaults (existing user input takes precedence)
      const customDefaults: Record<string, any> = {}
      for (const cf of customFields) {
        if (cf.default_value !== null && cf.default_value !== undefined) {
          customDefaults[cf.id] = cf.default_value
        }
      }
      setValues(prev => ({
        ...prev,
        custom: { ...customDefaults, ...prev.custom },
      }))
    } catch (e: any) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading booking form…</div>
  )
  if (loadError) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
      <strong>Error loading form:</strong> {loadError}
    </div>
  )

  if (!formData || formData.steps.length === 0) return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-4 text-sm">
      No steps configured for this form yet.
    </div>
  )

  if (submittedJobId) return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
      <p className="text-lg font-semibold text-green-800">Booking received!</p>
      <p className="text-sm text-green-700">Job ID: {submittedJobId}</p>
      <p className="text-sm text-green-600">You'll receive a confirmation email shortly.</p>
    </div>
  )

  const selectedService = formData.services.find(s => s.id === values.service_id) ?? null

  // Derive extras for the currently selected service directly from raw junctions at render
  // time. This ensures the three-layer price resolution uses the correct service_id for the
  // price_override lookup, rather than relying on a value baked during load.
  const currentExtras: any[] = values.service_id
    ? (formData.junctions || [])
        .filter((j: any) => j.service_id === values.service_id)
        .filter((junc: any) => junc.extras && Object.prototype.hasOwnProperty.call(formData.locExtraMap, junc.extras.id))
        .map((junc: any) => ({
          ...junc.extras,
          duration_minutes: junc.extras.default_duration_minutes,
          price: (formData.locExtraMap || {})[junc.extras.id] ?? junc.price_override ?? junc.extras.default_price,
          sort_order: junc.sort_order,
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
    : []

  // A step is skipped when it contains only extras_picker fields AND the selected service
  // has no applicable extras for this location. If no service is selected yet, don't skip.
  const hasApplicableExtras =
    values.service_id === null ||
    currentExtras.some((e: any) => e.is_active)

  const visibleSteps = formData.steps.filter(step => {
    const pls = formData.placements.filter(p => p.step_id === step.id)
    const isExtrasOnly = pls.length > 0 && pls.every(p => p.builtin_field_key === 'extras_picker')
    return !isExtrasOnly || hasApplicableExtras
  })

  const safeStepIndex = Math.min(currentStepIndex, Math.max(0, visibleSteps.length - 1))
  const currentStep = visibleSteps[safeStepIndex]
  const currentPlacements = formData.placements
    .filter(p => p.step_id === currentStep.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  function validatePlacement(p: any, values: any, customFields: any[], business: any): string | null {
    if (p.builtin_field_key) {
      switch (p.builtin_field_key) {
        case 'service_picker':
          return values.service_id ? null : 'Select a service to continue'
        case 'room_counts': {
          const svc = formData.services.find((s: any) => s.id === values.service_id) ?? null
          if (svc?.pricing_type !== 'room_based') return null
          if (values.room_counts.bedrooms == null) return 'Select number of bedrooms'
          if (values.room_counts.bathrooms == null) return 'Select number of bathrooms'
          return null
        }
        case 'extras_picker':
          return null
        case 'frequency_picker':
          return values.frequency ? null : 'Choose a frequency'
        case 'date_time_picker':
          if (!values.date_time.scheduled_date) return 'Select a date'
          if (!values.date_time.is_flexible && (!values.date_time.scheduled_time || values.date_time.scheduled_time === 'flexible')) return 'Select a time'
          return null
        case 'address': {
          const a = values.address
          if (!a.line1?.trim()) return 'Enter street address'
          if (!a.city?.trim()) return 'Enter suburb'
          if (!a.state?.trim()) return 'Select state'
          if (!a.postcode?.trim()) return 'Enter postcode'
          return null
        }
        case 'contact_info': {
          const c = values.contact_info
          if (!c.full_name?.trim()) return 'Enter your name'
          if (!c.email?.trim()) return 'Enter your email'
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return 'Enter a valid email address'
          if (!c.phone?.trim()) return 'Enter your phone number'
          return null
        }
        case 'tnc_checkbox':
          if (business?.tnc_url && !values.tnc_accepted) return 'Accept the Terms & Conditions to continue'
          return null
        default:
          return null
      }
    }
    if (p.custom_field_id) {
      const cf = customFields.find((f: any) => f.id === p.custom_field_id)
      if (!cf) return null
      if (!cf.required) return null
      const v = values.custom[cf.id]
      if (cf.field_type === 'checkbox') return v === true ? null : `${cf.label} is required`
      if (v === undefined || v === null || v === '') return `${cf.label} is required`
      return null
    }
    return null
  }

  const stepValidation: string | null = (() => {
    for (const p of currentPlacements) {
      const err = validatePlacement(p, values, formData.customFields, formData.business)
      if (err) return err
    }
    return null
  })()
  const canProceed = stepValidation === null

  function renderBuiltin(key: string, placementId: string) {
    switch (key) {
      case 'service_picker':
        return (
          <ServicePickerField
            key={placementId}
            value={values.service_id}
            onChange={v => setValues(prev => ({ ...prev, service_id: v, extras: [] }))}
            context={{ services: formData.services, business: formData.business }}
          />
        )
      case 'room_counts':
        return (
          <RoomCountsField
            key={placementId}
            value={values.room_counts}
            onChange={v => setValues(prev => ({ ...prev, room_counts: v }))}
            context={{ selectedService, roomPricing }}
          />
        )
      case 'extras_picker':
        return (
          <ExtrasPickerField
            key={placementId}
            value={values.extras}
            onChange={v => setValues(prev => ({ ...prev, extras: v }))}
            context={{
              selectedService: selectedService ? { ...selectedService, service_extras: currentExtras } : null,
              business: formData.business,
            }}
          />
        )
      case 'frequency_picker':
        return (
          <FrequencyPickerField
            key={placementId}
            value={values.frequency}
            onChange={v => setValues(prev => ({ ...prev, frequency: v }))}
            context={{ frequencyDiscounts: formData.frequencyDiscounts, business: formData.business }}
          />
        )
      case 'date_time_picker':
        return (
          <DateTimePickerField
            key={placementId}
            value={values.date_time}
            onChange={v => setValues(prev => ({ ...prev, date_time: v }))}
            context={{ businessTimezone: formData.business?.timezone }}
          />
        )
      case 'address':
        return (
          <AddressField
            key={placementId}
            value={values.address}
            onChange={v => setValues(prev => ({ ...prev, address: v }))}
            context={{}}
          />
        )
      case 'contact_info':
        return (
          <ContactInfoField
            key={placementId}
            value={values.contact_info}
            onChange={v => setValues(prev => ({ ...prev, contact_info: v }))}
            context={{}}
          />
        )
      case 'tnc_checkbox':
        return formData.business?.tnc_url ? (
          <TncCheckboxField
            key={placementId}
            value={values.tnc_accepted}
            onChange={v => setValues(prev => ({ ...prev, tnc_accepted: v }))}
            context={{ tncUrl: formData.business.tnc_url }}
          />
        ) : null
      default:
        return (
          <div key={placementId} className="text-xs text-red-500 px-1">
            Unknown built-in: {key}
          </div>
        )
    }
  }

  function renderPlacement(p: any) {
    if (p.builtin_field_key) return renderBuiltin(p.builtin_field_key, p.id)
    if (p.custom_field_id) {
      const cf = formData.customFields.find(f => f.id === p.custom_field_id)
      if (!cf) return null
      return (
        <CustomFieldInput
          key={p.id}
          field={cf}
          value={values.custom[cf.id] ?? null}
          onChange={v => setValues(prev => ({ ...prev, custom: { ...prev.custom, [cf.id]: v } }))}
        />
      )
    }
    return null
  }

  return (
    <div
      className="max-w-2xl mx-auto px-6 pt-6 pb-12 sm:pb-6"
      style={{ '--brand-color': formData.business?.brand_color || '#1A6B4A' } as React.CSSProperties}
    >
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div
          className="px-6 py-4 sm:py-10"
          style={{ backgroundColor: formData.business.brand_color || '#1A6B4A' }}
        >
          <div className="flex items-center gap-3 sm:gap-5">
            {formData.business.logo_url ? (
              <img
                src={formData.business.logo_url}
                alt={`${formData.business.name} logo`}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-contain bg-white p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-2xl">{formData.business.name?.charAt(0) ?? ''}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="hidden sm:block text-sm font-medium text-white/80">{formData.business.name}</p>
              {formData.form.title && (
                <h1 className="text-lg sm:text-3xl font-bold text-white leading-tight mt-1">
                  {formData.form.title}
                </h1>
              )}
              {formData.form.subtitle && (
                <p className="text-sm text-white/80 mt-0.5 sm:mt-1">{formData.form.subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-4">
            Step {safeStepIndex + 1} of {visibleSteps.length}
          </p>

          <div className="space-y-3 sm:space-y-5">
            {currentPlacements.map(p => renderPlacement(p))}
            {currentPlacements.length === 0 && (
              <p className="text-sm text-gray-400 italic">No fields on this step.</p>
            )}
          </div>

          <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentStepIndex(i => Math.max(0, i - 1))}
              disabled={currentStepIndex === 0}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg disabled:opacity-30"
            >
              Back
            </button>
            <div className="flex flex-col items-end">
              <button
                onClick={() => {
                  if (!canProceed || submitting) return
                  if (currentStep.is_submit_step) {
                    handleSubmit()
                  } else {
                    setCurrentStepIndex(i => Math.min(visibleSteps.length - 1, i + 1))
                  }
                }}
                disabled={!canProceed || submitting}
                className="px-6 py-2 border border-transparent bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-30 flex items-center gap-2"
              >
                {submitting && currentStep.is_submit_step ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    Submitting your booking…
                  </span>
                ) : currentStep.is_submit_step ? (currentStep.submit_button_label || 'Submit') : (currentStep.next_button_label || 'Next')}
              </button>
              {submitting && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Please wait, this may take a few seconds…
                </p>
              )}
              {stepValidation && !submitError && (
                <p className="mt-2 text-xs text-gray-500 text-right">{stepValidation}</p>
              )}
              {submitError && (
                <p className="mt-3 text-sm text-red-600 text-right">{submitError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DebugSection({ title, data }: { title: string; data: any }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-xs text-gray-400">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && (
        <pre className="text-xs text-gray-700 bg-gray-50 px-4 py-3 overflow-x-auto border-t border-gray-200 leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
