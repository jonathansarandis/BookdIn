import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'

export const metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, customer:customers(full_name, email)')
    .eq('business_id', profile!.business_id!)
    .order('created_at', { ascending: false })

  const STATUS_COLORS: Record<string, string> = {
    draft:   'bg-gray-100 text-gray-600 border-gray-200',
    sent:    'bg-blue-50 text-blue-700 border-blue-200',
    paid:    'bg-green-50 text-green-700 border-green-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
    void:    'bg-gray-100 text-gray-400 border-gray-200',
  }

  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0) || 0
  const totalOutstanding = invoices?.filter(i => ['sent','overdue'].includes(i.status)).reduce((sum, i) => sum + i.total, 0) || 0
  const totalOverdue = invoices?.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0) || 0

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <p className="text-sm text-gray-500 mt-0.5">{invoices?.length || 0} invoices</p>
        </div>
        <Link href="/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New invoice
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total paid', value: formatCurrency(totalPaid), color: 'text-green-600' },
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), color: 'text-blue-600' },
          { label: 'Overdue', value: formatCurrency(totalOverdue), color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {invoices && invoices.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Invoice</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Due</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/invoices/${invoice.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      INV-{invoice.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-gray-900">{invoice.customer?.full_name}</p>
                    <p className="text-xs text-gray-400">{invoice.customer?.email}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {formatDateShort(invoice.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {invoice.due_date ? formatDateShort(invoice.due_date) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize', STATUS_COLORS[invoice.status])}>
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No invoices yet</h3>
          <p className="text-xs text-gray-500 mb-4">Create your first invoice to start getting paid</p>
          <Link href="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            <Plus className="w-4 h-4" />Create invoice
          </Link>
        </div>
      )}
    </div>
  )
}
