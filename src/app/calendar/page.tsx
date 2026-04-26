import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Calendar' }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const now = new Date()
  const year = parseInt(searchParams.year || String(now.getFullYear()))
  const month = parseInt(searchParams.month || String(now.getMonth()))

  const monthStart = new Date(year, month, 1).toISOString()
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, customer:customers(full_name), service:services(name), provider:providers(display_name, color)')
    .eq('business_id', profile!.business_id!)
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd)
    .not('status', 'in', '("cancelled")')
    .order('scheduled_at')

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const STATUS_CHIP: Record<string, string> = {
    pending:     'bg-amber-100 text-amber-800',
    confirmed:   'bg-green-100 text-green-800',
    assigned:    'bg-purple-100 text-purple-800',
    on_the_way:  'bg-blue-100 text-blue-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed:   'bg-gray-100 text-gray-600',
  }

  function getJobsForDay(day: number) {
    return jobs?.filter(job => {
      const jobDate = new Date(job.scheduled_at)
      return jobDate.getDate() === day &&
             jobDate.getMonth() === month &&
             jobDate.getFullYear() === year
    }) || []
  }

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year

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
            <Link href={`/calendar?month=${now.getMonth()}&year=${now.getFullYear()}`}
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

      {/* Calendar grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_NAMES.map(day => (
            <div key={day} className="py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-gray-100 bg-gray-50/50" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayJobs = getJobsForDay(day)
            const isToday = isCurrentMonth && today.getDate() === day
            const col = (startOffset + i) % 7
            const isWeekend = col === 5 || col === 6

            return (
              <div key={day}
                className={cn(
                  'min-h-[100px] border-r border-b border-gray-100 p-1.5 transition-colors',
                  isWeekend ? 'bg-gray-50/30' : '',
                  isToday ? 'bg-brand-50/40' : ''
                )}>
                <div className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  isToday ? 'bg-brand-500 text-white' : 'text-gray-500'
                )}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayJobs.slice(0, 3).map((job: any) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className={cn(
                        'block text-[10px] font-medium px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity',
                        STATUS_CHIP[job.status] || 'bg-gray-100 text-gray-600'
                      )}>
                      {new Date(job.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {' '}{job.customer?.full_name?.split(' ')[0]}
                    </Link>
                  ))}
                  {dayJobs.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1.5">
                      +{dayJobs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Jobs this month summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total jobs', value: jobs?.length || 0 },
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
