// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

export default function BookingFormRenderer({
  businessId,
  locationId,
  mode,
  previewData,
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
  } | null>(null)

  useEffect(() => {
    load()
  }, [businessId, locationId, mode])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      // 1. Fetch business
      const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, logo_url, brand_color, timezone, tax_rate, tax_name, show_tax, tax_mode, tnc_url')
        .eq('id', businessId)
        .single()
      if (bizErr || !business) throw new Error(bizErr?.message || 'Business not found')

      // 2. Fetch location row for timezone
      const { data: location } = await supabase
        .from('locations')
        .select('id, timezone')
        .eq('id', locationId)
        .single()

      const timezone = business.timezone || location?.timezone || null

      // 3. Fetch services via location_services (location-scoped pricing)
      const [{ data: locSvcsRaw }, { data: locExtrasRaw }] = await Promise.all([
        supabase
          .from('location_services')
          .select(`
            base_price, is_enabled,
            services!inner (
              id, name, description, pricing_type, duration_minutes,
              is_active, sort_order,
              service_extras (
                id, name, description, duration_minutes, is_active,
                sort_order, is_popular, is_quote_only
              )
            )
          `)
          .eq('location_id', locationId)
          .eq('is_enabled', true)
          .eq('services.is_active', true)
          .order('sort_order', { foreignTable: 'services' }),
        supabase
          .from('location_extras')
          .select('extra_id, price, is_enabled')
          .eq('location_id', locationId)
          .eq('is_enabled', true),
      ])

      const extraPriceMap: Record<string, number> = {}
      for (const le of locExtrasRaw || []) extraPriceMap[le.extra_id] = le.price

      const services: any[] = (locSvcsRaw || []).map((row: any) => ({
        ...row.services,
        base_price: row.base_price,
        service_extras: (row.services.service_extras || [])
          .filter((ex: any) => extraPriceMap[ex.id] !== undefined)
          .map((ex: any) => ({ ...ex, price: extraPriceMap[ex.id] })),
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
        // Fetch booking form for this business
        const { data: formRow, error: formErr } = await supabase
          .from('booking_forms')
          .select('id, title, subtitle')
          .eq('business_id', businessId)
          .single()
        if (formErr || !formRow) throw new Error('No booking form found for this business')

        form = formRow

        // Fetch steps
        const { data: stepsData } = await supabase
          .from('booking_form_steps')
          .select('id, form_id, sort_order, next_button_label, is_submit_step, submit_button_label')
          .eq('form_id', formRow.id)
          .order('sort_order')

        steps = stepsData || []

        // Fetch placements via step IDs (no form_id column on placements table)
        const stepIds = steps.map((s: any) => s.id)
        const { data: placementsData } = stepIds.length > 0
          ? await supabase
              .from('booking_form_field_placements')
              .select('id, step_id, builtin_field_key, custom_field_id, sort_order')
              .in('step_id', stepIds)
              .order('sort_order')
          : { data: [] }

        placements = placementsData || []

        // Fetch active custom fields
        const { data: cfData } = await supabase
          .from('custom_fields')
          .select('id, label, field_type, options, required, sort_order')
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
      })
    } catch (e: any) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading booking form…</div>
  if (loadError) return <div className="p-4 text-sm text-red-600">Error: {loadError}</div>

  return (
    <div className="p-4">
      <pre className="text-xs whitespace-pre-wrap break-all bg-gray-50 border border-gray-200 rounded-lg p-4">
        {JSON.stringify(formData, null, 2)}
      </pre>
    </div>
  )
}
