// @ts-nocheck
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ArrowLeft, User, Calendar, FileText } from 'lucide-react'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import PayButton from '@/components/payments/PayButton'

const STATUS_STYLES: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600 border-gray-200',
  sent:    'bg-blue-50 text-blue-700 border-blue-200',
  paid:    'bg-green-50 text-green-700 border-green-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  void:    'bg-gray-100 text-gray-400 border-gray-200',
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invoice, error } = await serviceClient
    .from('invoices')
    .select(`
      *,
      customer:customers(id, full_name, email, phone),
      job:jobs!invoices_job_id_fkey(id, scheduled_at, service:services(name))
    `)
    .eq('id', params.id)
    .single()

  if (error || !invoice) redirect('/invoices')

  const isPaid = invoice.status === 'paid'
  const canPay = !isPaid && invoice.status !== 'void' && invoice.total > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              INV-{invoice.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-gray-500">Created {formatDateShort(invoice.created_at)}</p>
          </div>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium border capitalize', STATUS_STYLES[invoice.status] || 'bg-gray-100 text-gray-700')}>
          {invoice.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Main details */}
        <div className="md:col-span-2 space-y-5">

          {/* Customer */}
          {invoice.customer && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Customer</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <Link href={`/customers/${invoice.customer.id}`} className="text-brand-600 hover:underline font-medium">
                  {invoice.customer.full_name}
                </Link>
              </div>
              {invoice.customer.email && (
                <p className="text-sm text-gray-500 ml-6">{invoice.customer.email}</p>
              )}
              {invoice.customer.phone && (
                <p className="text-sm text-gray-500 ml-6">{invoice.customer.phone}</p>
              )}
            </div>
          )}

          {/* Linked job */}
          {invoice.job && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Linked job</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4 text-gray-400" />
                <Link href={`/jobs/${invoice.job.id}`} className="text-brand-600 hover:underline">
                  {invoice.job.service?.name || 'Service'}
                </Link>
              </div>
              {invoice.job.scheduled_at && (
                <div className="flex items-center gap-2 text-sm text-gray-500 ml-6">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateShort(invoice.job.scheduled_at)}
                </div>
              )}
            </div>
          )}

          {/* Amount breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Amount</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(invoice.subtotal || invoice.total)}</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{invoice.tax_name || 'Tax'}</span>
                <span className="text-gray-900">{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Notes</h2>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Payment</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</span>
            </div>
            {invoice.due_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Due date</span>
                <span className="text-gray-900">{formatDateShort(invoice.due_date)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', STATUS_STYLES[invoice.status])}>
                {invoice.status}
              </span>
            </div>
            {canPay && (
              <PayButton
                invoiceId={invoice.id}
                amount={invoice.total}
                label={`Collect payment · ${formatCurrency(invoice.total)}`}
              />
            )}
            {isPaid && invoice.paid_at && (
              <p className="text-xs text-green-600 text-center">✓ Paid {formatDateShort(invoice.paid_at)}</p>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
            {invoice.status === 'draft' && (
              <form action={`/api/invoices/${invoice.id}/send`} method="POST">
                <button type="submit" className="w-full py-2 px-4 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors">
                  Mark as sent
                </button>
              </form>
            )}
            {invoice.status !== 'void' && invoice.status !== 'paid' && (
              <form action={`/api/invoices/${invoice.id}/mark-paid`} method="POST">
                <button type="submit" className="w-full py-2 px-4 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
                  Mark as paid
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
