'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'

interface Props {
  from: string // yyyy-MM-dd or ''
  to: string // yyyy-MM-dd or ''
  onChange: (range: { from: string | null; to: string | null }) => void
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function toIso(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function displayLabel(from: string, to: string) {
  if (!from && !to) return 'All dates'
  const f = from ? format(parseISO(from), 'dd/MM/yyyy') : '…'
  const t = to ? format(parseISO(to), 'dd/MM/yyyy') : '…'
  return `${f} – ${t}`
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState<Date | null>(from ? parseISO(from) : null)
  const [draftTo, setDraftTo] = useState<Date | null>(to ? parseISO(to) : null)
  const [visibleMonth, setVisibleMonth] = useState<Date>(from ? parseISO(from) : new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  // Re-sync drafts whenever the popover opens, or the URL-driven props change externally.
  useEffect(() => {
    if (open) {
      setDraftFrom(from ? parseISO(from) : null)
      setDraftTo(to ? parseISO(to) : null)
      setVisibleMonth(from ? parseISO(from) : new Date())
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth)
    const monthEnd = endOfMonth(visibleMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [visibleMonth])

  function pickDay(day: Date) {
    if (!draftFrom || (draftFrom && draftTo)) {
      // Starting a fresh selection.
      setDraftFrom(day)
      setDraftTo(null)
      return
    }
    // We have a start but no end yet.
    if (isBefore(day, draftFrom)) {
      setDraftFrom(day)
      setDraftTo(null)
    } else {
      setDraftTo(day)
    }
  }

  function apply() {
    onChange({
      from: draftFrom ? toIso(draftFrom) : null,
      to: draftTo ? toIso(draftTo) : (draftFrom ? toIso(draftFrom) : null),
    })
    setOpen(false)
  }

  function clear() {
    setDraftFrom(null)
    setDraftTo(null)
    onChange({ from: null, to: null })
    setOpen(false)
  }

  function applyPreset(start: Date, end: Date) {
    setDraftFrom(start)
    setDraftTo(end)
    setVisibleMonth(start)
    onChange({ from: toIso(start), to: toIso(end) })
    setOpen(false)
  }

  const today = new Date()
  const presets: { label: string; range: () => [Date, Date] }[] = [
    { label: 'Today', range: () => [today, today] },
    { label: 'This week', range: () => [startOfWeek(today, { weekStartsOn: 1 }), endOfWeek(today, { weekStartsOn: 1 })] },
    { label: 'Last 7 days', range: () => [subDays(today, 6), today] },
    { label: 'This month', range: () => [startOfMonth(today), endOfMonth(today)] },
  ]

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-300 transition-colors"
      >
        <CalendarRange className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span>{displayLabel(from, to)}</span>
        {(from || to) && (
          <span
            role="button"
            onClick={e => {
              e.stopPropagation()
              clear()
            }}
            className="text-gray-400 hover:text-gray-600 ml-1"
            title="Clear date range"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[300px]">
          <div className="flex gap-1.5 flex-wrap mb-3">
            {presets.map(p => {
              const [s, e] = p.range()
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(s, e)}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setVisibleMonth(m => subMonths(m, 1))}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-gray-900">{format(visibleMonth, 'MMMM yyyy')}</span>
            <button
              onClick={() => setVisibleMonth(m => addMonths(m, 1))}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i} className="text-[10px] text-gray-400 font-medium">{d}</span>
            ))}
            {days.map(day => {
              const inCurrentMonth = isSameMonth(day, visibleMonth)
              const isStart = draftFrom && isSameDay(day, draftFrom)
              const isEnd = draftTo && isSameDay(day, draftTo)
              const inRange = draftFrom && draftTo && isWithinInterval(day, {
                start: isBefore(draftFrom, draftTo) ? draftFrom : draftTo,
                end: isBefore(draftFrom, draftTo) ? draftTo : draftFrom,
              })
              const isToday = isSameDay(day, today)

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => pickDay(day)}
                  className={[
                    'text-xs h-7 w-7 mx-auto flex items-center justify-center rounded-full transition-colors',
                    !inCurrentMonth ? 'text-gray-300' : 'text-gray-700',
                    inRange && !isStart && !isEnd ? 'bg-brand-50 rounded-none w-full' : '',
                    isStart || isEnd ? 'bg-brand-600 text-white font-semibold' : 'hover:bg-gray-100',
                    isToday && !isStart && !isEnd ? 'ring-1 ring-brand-300' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <button onClick={clear} className="text-[11px] text-gray-400 hover:text-gray-600">
              Clear
            </button>
            <button
              onClick={apply}
              disabled={!draftFrom}
              className="text-[11px] px-3 py-1.5 rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
