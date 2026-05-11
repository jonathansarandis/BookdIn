'use client'

import BookingFormRenderer from '@/components/booking-form/BookingFormRenderer'

export default function TestRendererPage() {
  // Clean Freaks business + location IDs from the project context
  const businessId = '9363c6d5-31c1-4d56-90f4-cf6715eda809'

  // We need a real location ID. Use the Clean Freaks Melbourne location.
  // If you don't know it offhand, run this SQL to find it:
  //   SELECT id, name FROM locations WHERE business_id = '9363c6d5-31c1-4d56-90f4-cf6715eda809';
  // Then paste the Melbourne UUID below.
  const locationId = 'a7d65f1c-b607-4f80-8aa3-6510aecefb29'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">Renderer Test (C1)</h1>
        <p className="text-sm text-gray-600 mb-6">
          This page renders BookingFormRenderer in live mode with Clean Freaks IDs.
          Should show a JSON dump of all fetched form data.
        </p>
        <BookingFormRenderer
          businessId={businessId}
          locationId={locationId}
          mode="live"
        />
      </div>
    </div>
  )
}
