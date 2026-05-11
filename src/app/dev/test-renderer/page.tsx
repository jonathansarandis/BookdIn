'use client'

import BookingFormRenderer from '@/components/booking-form/BookingFormRenderer'

export default function TestRendererPage() {
  const businessId = '9363c6d5-31c1-4d56-90f4-cf6715eda809'
  const locationId = 'a7d65f1c-b607-4f80-8aa3-6510aecefb29'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Renderer Test (Phase C1)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live-mode data fetch verification. Each section below is a collapsible JSON dump of fetched data.
          </p>
        </div>
        <BookingFormRenderer
          businessId={businessId}
          locationId={locationId}
          mode="live"
        />
      </div>
    </div>
  )
}
