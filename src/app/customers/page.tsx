// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { formatCurrency, formatDateShort, getInitials } from '@/lib/utils'

export const metadata = { title: 'Customers' }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  let query = supabase
    .from('customers')
    .select('*')
    .eq('business_id', profile!.business_id!)
    .order('created_at', { ascending: false })

  if (searchParams.q) {
    query = query.or(`full_name.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`)
  }

  const { data: customers } = await query

  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{customers?.length || 0} total customers</p>
        </div>
        <Link href="/customers/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add customer
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input name="q" defaultValue={searchParams.q}
          placeholder="Search by name or email..."
          className="w-full max-w-sm pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
      </form>

      {customers && customers.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Phone</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Bookings</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Lifetime value</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Last booking</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer, i) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/customers/${customer.id}`} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {getInitials(customer.full_name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{customer.full_name}</p>
                        <p className="text-xs text-gray-400">{customer.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm text-gray-600">{customer.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-sm text-gray-900">{customer.total_bookings}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(customer.lifetime_value)}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm text-gray-500">
                      {customer.last_booking_at ? formatDateShort(customer.last_booking_at) : 'Never'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/customers/${customer.id}`}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {searchParams.q ? 'No customers found' : 'No customers yet'}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            {searchParams.q ? `No results for "${searchParams.q}"` : 'Add your first customer or they\'ll appear here after booking online'}
          </p>
          {!searchParams.q && (
            <Link href="/customers/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
              <Plus className="w-4 h-4" />
              Add customer
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
