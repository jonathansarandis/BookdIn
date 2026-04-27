// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { Plus, FileText } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-50 text-blue-700',
  viewed:   'bg-purple-50 text-purple-700',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  expired:  'bg-orange-50 text-orange-700',
  invoiced: 'bg-teal-50 text-teal-700',
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchQuotes() }, [])

  async function fetchQuotes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()

    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customers(id, full_name)')
      .eq('business_id', profile?.business_id)
      .order('created_at', { ascending: false })

    setQuotes(data || [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Quotes</h1>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New quote
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No quotes yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first quote to get started</p>
          <Link href="/quotes/new" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
            <Plus className="w-4 h-4" /> New quote
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Quote</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valid until</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map(quote => (
                <tr key={quote.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => window.location.href = `/quotes/${quote.id}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    QT-{quote.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {quote.customer?.full_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-600'}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {quote.valid_until ? formatDateShort(quote.valid_until) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(quote.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
