// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toBusinessDateTime, fromBusinessDateTime } from '@/lib/datetime'
import CalendarGrid from './CalendarGrid'

export const metadata = { title: 'Calendar' }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}


export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()
  const { data: business } = await supabase.from('businesses').select('timezone').eq('id', profile!.business_id!).single()
  const businessTimezone = business?.timezone || 'Australia/Melbourne'

  const nowInBusiness = toBusinessDateTime(new Date().toISOString(), businessTimezone)
  const year = parseInt(searchParams.year || String(nowInBusiness.getFullYear()))
  const month = parseInt(searchParams.month || String(nowInBusiness.getMonth()))

  const pad = (n: number) => String(n).padStart(2, '0')
  const daysInMonthForRange = getDaysInMonth(year, month)
  const monthStart = fromBusinessDateTime(`${year}-${pad(month + 1)}-01`, '00:00', businessTimezone)
  const monthEnd = fromBusinessDateTime(`${year}-${pad(month + 1)}-${pad(daysInMonthForRange)}`, '23:59', businessTimezone)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, customer:customers(full_name, email, phone), service:services(name, pricing_type), provider:providers(display_name, color), address:addresses(line1, city, state, postcode), job_extras(id, name, price)')
    .eq('business_id', profile!.business_id!)
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd)
    .neq('status', 'cancelled')
    .order('scheduled_at')

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTH_NAMES[month]} {year}
          </h2>
          <div className="flex items-center gap-1">
            <Link href={`/calendar?month=${prevMonth}&year=${prevYear}`}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <Link href={`/calendar?month=${nowInBusiness.getMonth()}&year=${nowInBusiness.getFullYear()}`}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Today
            </Link>
            <Link href={`/calendar?month=${nextMonth}&year=${nextYear}`}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </Link>
          </div>
        </div>
        <Link href="/booking"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New booking
        </Link>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        {[
          { label: 'Confirmed', color: 'bg-green-100' },
          { label: 'Pending', color: 'bg-amber-100' },
          { label: 'Assigned', color: 'bg-purple-100' },
          { label: 'In progress', color: 'bg-blue-100' },
          { label: 'Completed', color: 'bg-gray-100' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>

      <CalendarGrid
        jobs={jobs || []}
        businessTimezone={businessTimezone}
        year={year}
        month={month}
      />

      {/* Jobs this month summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total bookings', value: jobs?.length || 0 },
          { label: 'Completed', value: jobs?.filter(j => j.status === 'completed').length || 0 },
          { label: 'Pending', value: jobs?.filter(j => j.status === 'pending').length || 0 },
          { label: 'Revenue', value: `$${((jobs?.filter(j => j.status === 'completed').reduce((sum, j) => sum + j.price, 0) || 0) / 100).toFixed(0)}` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
