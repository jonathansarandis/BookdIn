// @ts-nocheck
'use client'

import { CheckCircle2 } from 'lucide-react'

export default function BookingConfirmedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">You're all set!</h2>
        <p className="text-gray-500 text-sm">
          Your card details have been saved securely. Your booking is confirmed and we'll see you on the day!
        </p>
      </div>
    </div>
  )
}
