// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { ArrowLeft, User, Loader2 } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600 border-gray-200',
  sent:     'bg-blue-50 text-blue-700 border-blue-200',
  viewed:   'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  expired:  'bg-orange-50 text-orange-700 border-orange-200',
  invoiced: 'bg-teal-50 text-teal-700 border-teal-200',
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => { fetchQuote() }, [])

  async function fetchQuote() {
    const { data } = await supabase
      .from('quotes')
      .select('*, customer:customers(id, full_name, email, phone)')
      .eq('id', params.id)
      .single()

    setQuote(data)
    setLoading(false)
  }

  async function handleAction(action: string) {
    setActing(action)
    const res = await fetch(`/api/quotes/${params.id}/${action}`, { method: 'POST' })
    const data = await res.json()

    if (action === 'convert' && data.invoice_id) {
      router.push(`/invoices/${data.invoice_id}`)
      return
    }

    await fetchQuote()
    setActing(null)
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
  if (!quote) return <div className="text-sm text-gray-400 py-8 text-center">Quote not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              QT-{quote.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-gray-500">Created {formatDateShort(quote.created_at)}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium border capitalize ${STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          {quote.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">

          {/* Customer */}
          {quote.customer && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Customer</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <Link href={`/customers/${quote.customer.id}`} className="text-brand-600 hover:underline font-medium">
                  {quote.customer.full_name}
                </Link>
              </div>
              {quote.customer.email && <p className="text-sm text-gray-500 ml-6">{quote.customer.email}</p>}
              {quote.customer.phone && <p className="text-sm text-gray-500 ml-6">{quote.customer.phone}</p>}
            </div>
          )}

          {/* Amount */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Amount</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            {quote.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span>{formatCurrency(quote.tax_amount)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Notes</h2>
              <p className="text-sm text-gray-600">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Details</h2>
            {quote.valid_until && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valid until</span>
                <span className="text-gray-900">{formatDateShort(quote.valid_until)}</span>
              </div>
            )}
            {quote.sent_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sent</span>
                <span className="text-gray-900">{formatDateShort(quote.sent_at)}</span>
              </div>
            )}
            {quote.accepted_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Accepted</span>
                <span className="text-green-700 font-medium">{formatDateShort(quote.accepted_at)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>

            {quote.status === 'draft' && (
              <button
                onClick={() => handleAction('send')}
                disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {acting === 'send' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Mark as sent
              </button>
            )}

            {(quote.status === 'sent' || quote.status === 'viewed') && (
              <>
                <button
                  onClick={() => handleAction('accept')}
                  disabled={!!acting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {acting === 'accept' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Mark as accepted
                </button>
                <button
                  onClick={() => handleAction('decline')}
                  disabled={!!acting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {acting === 'decline' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Mark as declined
                </button>
              </>
            )}

            {quote.status === 'accepted' && (
              <button
                onClick={() => handleAction('convert')}
                disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {acting === 'convert' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Convert to invoice
              </button>
            )}

            {quote.status === 'invoiced' && (
              <p className="text-xs text-teal-600 text-center font-medium">✓ Converted to invoice</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
