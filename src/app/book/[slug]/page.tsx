// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import BookingFormRenderer from '@/components/booking-form/BookingFormRenderer'

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [business, setBusiness] = useState<any>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [thankYouUrl, setThankYouUrl] = useState<string | null>(null)
  const [prefetchedBusiness, setPrefetchedBusiness] = useState<any>(null)
  const [prefetchedLocation, setPrefetchedLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: loc } = await supabase
        .from('locations_public')
        .select('location_id, location_timezone, location_thank_you_url, location_slug, business_id, business_name, logo_url, brand_color, tax_rate, tax_name, show_tax, tax_mode, tnc_url, business_timezone')
        .eq('location_slug', slug)
        .single()

      if (!loc) { setLoading(false); return }

      setBusiness({
        id: loc.business_id,
        name: loc.business_name,
        logo_url: loc.logo_url,
        brand_color: loc.brand_color,
      })
      setLocationId(loc.location_id)
      setThankYouUrl(loc.location_thank_you_url || null)
      setPrefetchedBusiness({
        id: loc.business_id,
        name: loc.business_name,
        logo_url: loc.logo_url,
        brand_color: loc.brand_color,
        timezone: loc.business_timezone,
        tax_rate: loc.tax_rate,
        tax_name: loc.tax_name,
        show_tax: loc.show_tax,
        tax_mode: loc.tax_mode,
        tnc_url: loc.tnc_url,
      })
      setPrefetchedLocation({
        id: loc.location_id,
        timezone: loc.location_timezone,
      })
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!business || !locationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Booking page not found.</p>
      </div>
    )
  }

  const brand = business.brand_color || '#1A6B4A'

  return (
    <div className="min-h-screen bg-gray-50" style={{ '--brand-color': brand } as React.CSSProperties}>
      <BookingFormRenderer
        businessId={business.id}
        locationId={locationId}
        mode="live"
        thankYouUrl={thankYouUrl}
        prefetchedBusiness={prefetchedBusiness}
        prefetchedLocation={prefetchedLocation}
      />
    </div>
  )
}
