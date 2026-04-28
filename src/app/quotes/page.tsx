// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchQuotes() }, [])

  async function fetchQuotes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customers(id, full_name, email)')
      .eq('business_id', profile?.business_id)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  const totalAccepted = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0)
  const totalPending = quotes.filter(q => q.status === 'sent').reduce((s, q) => s + q.total, 0)
  const totalDeclined = quotes.filter(q => q.status === 'declined').reduce((s, q) => s + q.total, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} quotes</p>
        </div>
        <Link href="/quotes/new" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#2563FF', textDecoration: 'none' }}>
          <Plus className="w-4 h-4" /> New quote
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Accepted', value: formatCurrency(totalAccepted), color: 'text-green-600' },
          { label: 'Pending', value: formatCurrency(totalPending), color: 'text-blue-600' },
          { label: 'Declined', value: formatCurrency(totalDeclined), color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 mb-2">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : quotes.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3.5">Quote</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden md:table-cell">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden lg:table-cell">Created</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Amount</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((quote: any) => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none' }}>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        QT-{quote.id.slice(0, 8).toUpperCase()}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none' }}>
                      <p className="text-sm text-gray-700">{quote.customer?.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{quote.customer?.email || ''}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none' }}>
                      <span className="text-sm text-gray-600">{formatDate(quote.created_at)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none' }}>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(quote.total)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none' }}>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-500'}`}>
                        {quote.status}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/quotes/${quote.id}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all" style={{ textDecoration: 'none' }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(37,99,255,0.08)' }}>
            <FileText className="w-7 h-7" style={{ color: '#2563FF' }} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No quotes yet</h3>
          <p className="text-sm text-gray-400 mb-5">Create your first quote to send to a customer</p>
          <Link href="/quotes/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#2563FF', textDecoration: 'none' }}>
            <Plus className="w-4 h-4" /> New quote
          </Link>
        </div>
      )}
    </div>
  )
}
