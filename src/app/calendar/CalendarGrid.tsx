// @ts-nocheck
'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toBusinessDateTime, formatBusinessDateTime } from '@/lib/datetime'
import JobPopover from './JobPopover'

interface Props {
  jobs: any[]
  businessTimezone: string
  year: number
  month: number
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_CHIP: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-800',
  confirmed:   'bg-green-100 text-green-800',
  assigned:    'bg-purple-100 text-purple-800',
  on_the_way:  'bg-blue-100 text-blue-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed:   'bg-gray-200 text-gray-700',
  cancelled:   'bg-red-100 text-red-600',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarGrid({ jobs, businessTimezone, year, month }: Props) {
  const [selectedJob, setSelectedJob] = useState<any>(null)

  const nowInBusiness = toBusinessDateTime(new Date().toISOString(), businessTimezone)
  const isCurrentMonth = nowInBusiness.getMonth() === month && nowInBusiness.getFullYear() === year

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  function getJobsForDay(day: number) {
    return jobs.filter(job => {
      const jobDate = toBusinessDateTime(job.scheduled_at, businessTimezone)
      return jobDate.getDate() === day &&
             jobDate.getMonth() === month &&
             jobDate.getFullYear() === year
    })
  }

  return (
    <>
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
          {/* Empty offset cells */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-gray-100 bg-gray-50/50" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayJobs = getJobsForDay(day)
            const isToday = isCurrentMonth && nowInBusiness.getDate() === day
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
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={cn(
                        'block w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity',
                        STATUS_CHIP[job.status] || 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {job.is_flexible_time ? 'Flexible · ' : formatBusinessDateTime(job.scheduled_at, businessTimezone, 'h:mm a') + ' '}
                      {job.customer?.full_name?.split(' ')[0]}
                    </button>
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

      <JobPopover
        job={selectedJob}
        businessTimezone={businessTimezone}
        onClose={() => setSelectedJob(null)}
      />
    </>
  )
}
