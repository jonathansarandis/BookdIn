// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import CustomersTable from './CustomersTable'

export const metadata = { title: 'Customers' }

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  let { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', profile!.business_id!)
    .order('created_at', { ascending: false })

  // A stale/expired token can make this request fail even though the page
  // itself loaded fine (middleware refreshes cookies before the page renders,
  // but that's not airtight) — one retry against a fresh session closes that
  // gap instead of showing "0 customers" for a business that has hundreds.
  if (customersError) {
    console.error('[customers] query failed, retrying once:', customersError.message)
    const retry = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', profile!.business_id!)
      .order('created_at', { ascending: false })
    customers = retry.data
    customersError = retry.error
    if (customersError) console.error('[customers] retry also failed:', customersError.message)
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customersError ? '—' : customers?.length || 0} total customers</p>
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

      {customersError ? (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Couldn't load customers — check your connection and try refreshing.
        </div>
      ) : (
        <CustomersTable customers={customers || []} />
      )}
    </div>
  )
}
