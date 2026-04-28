// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Users, Phone, Mail } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export const metadata = { title: 'Customers' }

const AVATAR_COLORS = [
  '#2563FF', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#4f46e5', '#16a34a', '#ea580c', '#9333ea',
]

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
    query = query.or(`full_name.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%,phone.ilike.%${searchParams.q}%`)
  }

  const { data: customers } = await query

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers?.length || 0} total customers</p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
          style={{ background: '#2563FF' }}
        >
          <Plus className="w-4 h-4" />
          Add customer
        </Link>
      </div>

      {/* Search */}
      <form method="GET">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search by name, email or phone..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#2563FF' } as any}
          />
        </div>
      </form>

      {/* Table */}
      {customers && customers.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3.5">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden md:table-cell">Contact</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden lg:table-cell">Location</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden md:table-cell">Added</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer: any, i: number) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link href={`/customers/${customer.id}`} className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {getInitials(customer.full_name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{customer.full_name}</p>
                        <p className="text-xs text-gray-400">{customer.email || 'No email'}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Link href={`/customers/${customer.id}`} style={{ textDecoration: 'none' }}>
                      <div className="space-y-0.5">
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Mail className="w-3 h-3 text-gray-300" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <Link href={`/customers/${customer.id}`} style={{ textDecoration: 'none' }}>
                      <span className="text-sm text-gray-500">
                        {customer.suburb || customer.city || '—'}
                        {customer.state ? `, ${customer.state}` : ''}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Link href={`/customers/${customer.id}`} style={{ textDecoration: 'none' }}>
                      <span className="text-sm text-gray-400">
                        {new Date(customer.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all"
                      style={{ textDecoration: 'none' }}
                    >
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
            <Users className="w-7 h-7" style={{ color: '#2563FF' }} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No customers yet</h3>
          <p className="text-sm text-gray-400 mb-5">Add your first customer to get started</p>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#2563FF' }}
          >
            <Plus className="w-4 h-4" />
            Add customer
          </Link>
        </div>
      )}
    </div>
  )
}
