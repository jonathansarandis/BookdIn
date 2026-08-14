'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toBusinessDateTime, fromBusinessDateTime, formatBusinessDateTime } from '@/lib/datetime'
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

// Completed/cancelled jobs can't be dragged to a new date — nothing to reschedule.
const DRAGGABLE_STATUSES = new Set(['pending', 'confirmed', 'assigned', 'on_the_way', 'in_progress'])

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function chipLabel(job: any, tz: string) {
  const time = job.is_flexible_time ? 'Flexible' : formatBusinessDateTime(job.scheduled_at, tz, 'h:mm a')
  return `${job.location?.name ? job.location.name.slice(0, 3).toUpperCase() + ' ' : ''}${time} ${job.customer?.full_name?.split(' ')[0] || ''}`
}

function JobChip({ job, businessTimezone, onOpen }: { job: any; businessTimezone: string; onOpen: (job: any) => void }) {
  const draggable = DRAGGABLE_STATUSES.has(job.status)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, disabled: !draggable })
  const tz = job.location?.timezone || businessTimezone

  return (
    <button
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={() => onOpen(job)}
      title={draggable ? 'Drag to reschedule, or click for details' : undefined}
      className={cn(
        'block w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity',
        draggable ? 'cursor-grab active:cursor-grabbing' : '',
        isDragging ? 'opacity-30' : '',
        STATUS_CHIP[job.status] || 'bg-gray-100 text-gray-800'
      )}
    >
      {job.location?.name && (
        <span className="opacity-60 mr-1">{job.location.name.slice(0, 3).toUpperCase()}</span>
      )}
      {job.is_flexible_time ? 'Flexible · ' : formatBusinessDateTime(job.scheduled_at, tz, 'h:mm a') + ' '}
      {job.customer?.full_name?.split(' ')[0]}
    </button>
  )
}

function DayCell({
  day, dayJobs, isToday, isWeekend, businessTimezone, onOpen, onMore,
}: {
  day: number; dayJobs: any[]; isToday: boolean; isWeekend: boolean; businessTimezone: string
  onOpen: (job: any) => void; onMore: (day: number, jobs: any[]) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] border-r border-b border-gray-100 p-1.5 transition-colors',
        isWeekend ? 'bg-gray-50/30' : '',
        isToday ? 'bg-brand-50/40' : '',
        isOver ? 'bg-brand-100/70 ring-2 ring-inset ring-brand-400' : ''
      )}
    >
      <div className={cn(
        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
        isToday ? 'bg-brand-500 text-white' : 'text-gray-500'
      )}>
        {day}
      </div>
      <div className="space-y-0.5">
        {dayJobs.slice(0, 3).map((job: any) => (
          <JobChip key={job.id} job={job} businessTimezone={businessTimezone} onOpen={onOpen} />
        ))}
        {dayJobs.length > 3 && (
          <button
            onClick={() => onMore(day, dayJobs)}
            className="block w-full text-left text-[10px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded px-1.5 py-0.5 transition-colors"
          >
            +{dayJobs.length - 3} more
          </button>
        )}
      </div>
    </div>
  )
}

export default function CalendarGrid({ jobs, businessTimezone, year, month }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [localJobs, setLocalJobs] = useState(jobs)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [dayModal, setDayModal] = useState<{ day: number; jobs: any[] } | null>(null)
  const [activeJob, setActiveJob] = useState<any>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  useEffect(() => { setLocalJobs(jobs) }, [jobs])

  const sensors = useSensors(
    // A small movement threshold so a plain click/tap still opens the job popover instead
    // of always starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const nowInBusiness = toBusinessDateTime(new Date().toISOString(), businessTimezone)
  const isCurrentMonth = nowInBusiness.getMonth() === month && nowInBusiness.getFullYear() === year

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  function getJobsForDay(day: number) {
    return localJobs.filter(job => {
      // Bucket each job by day using its own location's timezone, not one shared
      // business timezone — a business with locations in different timezones (e.g.
      // Melbourne + Perth) would otherwise show jobs under the wrong day/time.
      const jobDate = toBusinessDateTime(job.scheduled_at, job.location?.timezone || businessTimezone)
      return jobDate.getDate() === day &&
             jobDate.getMonth() === month &&
             jobDate.getFullYear() === year
    })
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveJob(null)
    if (!over) return

    const targetDay = parseInt(String(over.id).replace('day-', ''), 10)
    if (Number.isNaN(targetDay)) return

    const job = localJobs.find(j => j.id === active.id)
    if (!job) return

    const tz = job.location?.timezone || businessTimezone
    const current = toBusinessDateTime(job.scheduled_at, tz)
    if (current.getDate() === targetDay && current.getMonth() === month && current.getFullYear() === year) {
      return // dropped back on the same day — nothing to do
    }

    // Keep the existing time-of-day, only the date changes.
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${year}-${pad(month + 1)}-${pad(targetDay)}`
    const timeStr = `${pad(current.getHours())}:${pad(current.getMinutes())}`
    const newScheduledAt = fromBusinessDateTime(dateStr, timeStr, tz)

    const { error } = await supabase.from('jobs').update({ scheduled_at: newScheduledAt }).eq('id', job.id)
    if (error) {
      setMoveError(`Couldn't reschedule ${job.customer?.full_name || 'this booking'}: ${error.message}`)
      return
    }

    setLocalJobs(prev => prev.map(j => j.id === job.id ? { ...j, scheduled_at: newScheduledAt } : j))
    router.refresh()
  }

  return (
    <>
      {moveError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          {moveError}
          <button onClick={() => setMoveError(null)} className="text-red-400 hover:text-red-600 ml-3">×</button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={e => setActiveJob(localJobs.find(j => j.id === e.active.id) || null)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveJob(null)}
      >
        {/* Day headers — sticky so you can always tell which weekday column you're in
            while scrolling through a tall month. Kept as its own bordered/rounded piece
            (rather than nested inside the grid's overflow-hidden wrapper below) since an
            overflow-hidden ancestor can otherwise clip position:sticky. */}
        <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-t-xl overflow-hidden grid grid-cols-7">
          {DAY_NAMES.map(day => (
            <div key={day} className="py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="bg-white border-x border-b border-gray-200 rounded-b-xl overflow-hidden grid grid-cols-7">
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
              <DayCell
                key={day}
                day={day}
                dayJobs={dayJobs}
                isToday={isToday}
                isWeekend={isWeekend}
                businessTimezone={businessTimezone}
                onOpen={setSelectedJob}
                onMore={(d, js) => setDayModal({ day: d, jobs: js })}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeJob && (
            <div className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded shadow-lg', STATUS_CHIP[activeJob.status] || 'bg-gray-100 text-gray-800')}>
              {chipLabel(activeJob, activeJob.location?.timezone || businessTimezone)}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {dayModal && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDayModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {dayModal.jobs.length} {dayModal.jobs.length === 1 ? 'booking' : 'bookings'} on day {dayModal.day}
              </h3>
              <button
                onClick={() => setDayModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {dayModal.jobs.map((job: any) => (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job)
                    setDayModal(null)
                  }}
                  className={cn(
                    'block w-full text-left px-3 py-2 rounded-lg hover:opacity-80 transition-opacity',
                    STATUS_CHIP[job.status] || 'bg-gray-100 text-gray-800'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold truncate">
                      {job.location?.name && (
                        <span className="opacity-60 mr-2 text-xs">{job.location.name.slice(0,3).toUpperCase()}</span>
                      )}
                      {job.customer?.full_name || 'Unknown'}
                    </span>
                    <span className="text-sm font-medium flex-shrink-0">
                      {job.is_flexible_time ? 'Flexible' : formatBusinessDateTime(job.scheduled_at, job.location?.timezone || businessTimezone, 'h:mm a')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <JobPopover
        job={selectedJob}
        businessTimezone={businessTimezone}
        onClose={() => setSelectedJob(null)}
      />
    </>
  )
}
