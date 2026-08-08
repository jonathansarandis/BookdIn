// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import CustomersTable from './CustomersTable'

export const metadata = { title: 'Customers' }

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', profile!.business_id!)
    .order('created_at', { ascending: false })

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

      <CustomersTable customers={customers || []} />
    </div>
  )
}
