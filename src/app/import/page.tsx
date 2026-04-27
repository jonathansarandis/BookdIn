// @ts-nocheck
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ImportPage() {
  const [ready, setReady] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth/login'; return }
      setAccessToken(session.access_token)
      setReady(true)
    }
    load()
  }, [])

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file || !accessToken) return

    setImporting(true)
    setError(null)
    setResults(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    const data = await res.json()
    setImporting(false)

    if (!res.ok) {
      setError(data.error || 'Import failed')
    } else {
      setResults(data)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Data Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import your existing customer and booking data from ConvertLabs</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Before importing</p>
            <p className="text-sm text-amber-700 mt-1">Make sure you have added your services in the Services page first. The import will try to match jobs to your existing services.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Bookings & Customers</h2>
            <p className="text-xs text-gray-500">Import from ConvertLabs bookings export CSV</p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">What gets imported:</p>
          <p>✓ Customers (name, email, phone) — duplicates skipped</p>
          <p>✓ Service addresses</p>
          <p>✓ Jobs with dates, prices, payment status</p>
          <p>✓ Provider assignments (matched by name)</p>
          <p>✓ Stripe customer IDs preserved</p>
        </div>

        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
          <p className="text-xs text-gray-400 mt-1">bookings_export.csv from ConvertLabs</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => setFileName(e.target.files?.[0]?.name || '')}
          />
          {fileName && <p className="text-xs text-brand-600 mt-2 font-medium">{fileName}</p>}
        </div>

        <button
          onClick={handleImport}
          disabled={importing || !fileName || !ready}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {importing && <Loader2 className="w-4 h-4 animate-spin" />}
          {importing ? 'Importing... this may take a few minutes' : 'Start import'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Import complete</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total rows', value: results.total },
              { label: 'Customers created', value: results.customers_created },
              { label: 'Existing customers', value: results.customers_existing },
              { label: 'Jobs imported', value: results.jobs_created },
              { label: 'Jobs skipped', value: results.jobs_skipped },
              { label: 'Errors', value: results.errors?.length || 0 },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
          {results.errors?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Errors ({results.errors.length})</p>
              <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {results.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-red-700">{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
