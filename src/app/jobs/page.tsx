// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ClipboardList, AlertCircle } from 'lucide-react'
import { formatCurrency, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import BookingsToolbar from '@/app/jobs/BookingsToolbar'
import StatusFilter from '@/app/jobs/StatusFilter'
import { fromBusinessDateTime, getCurrentDateTimeInfo } from '@/lib/datetime'

// Pure calendar-day arithmetic on a "yyyy-MM-dd" string, deliberately anchored
// in UTC just to do the addition safely — the result is handed to
// fromBusinessDateTime() below to get the actual timezone-aware instant, so
// this step itself never needs to know about the business's timezone.
function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const metadata = { title: 'Bookings' }

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed:   'bg-blue-50 text-blue-700 border border-blue-200',
  in_progress: 'bg-purple-50 text-purple-700 border border-purple-200',
  completed:   'bg-green-50 text-green-700 border border-green-200',
  cancelled:   'bg-gray-100 text-gray-500 border border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

const PAYMENT_STYLES: Record<string, string> = {
  paid:    'bg-green-50 text-green-700',
  unpaid:  'bg-gray-100 text-gray-500',
  overdue: 'bg-red-50 text-red-600',
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return {
    date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

// Preserves every current query param while overriding the ones passed in —
// used so switching one filter (status, location, etc.) doesn't drop the others.
function buildJobsUrl(current: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  const merged = { ...current, ...overrides }
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `/jobs?${qs}` : '/jobs'
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { status?: string; filter?: string; location?: string; q?: string; from?: string; to?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const [{ data: locations }, { data: business }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('business_id', profile!.business_id!).order('name'),
    supabase.from('businesses').select('timezone').eq('id', profile!.business_id!).single(),
  ])
  const tz = business?.timezone || 'Australia/Melbourne'

  let query = supabase
    .from('jobs')
    .select('*, customer:customers(full_name, email), service:services(name), provider:providers(display_name, color), address:addresses(line1, city), location:locations(id, name)')
    .eq('business_id', profile!.business_id!)
    .order('scheduled_at', { ascending: false })

  // status can now be a comma-separated list (multi-select), e.g. "pending,confirmed" —
  // Cancelled is kept mutually exclusive of everything else client-side (StatusFilter),
  // so a list containing "cancelled" here will only ever be exactly ["cancelled"].
  const selectedStatuses = searchParams.status ? searchParams.status.split(',').filter(Boolean) : []
  if (selectedStatuses.length === 1) query = query.eq('status', selectedStatuses[0])
  else if (selectedStatuses.length > 1) query = query.in('status', selectedStatuses)

  if (searchParams.location) query = query.eq('location_id', searchParams.location)

  // Date-range boundaries must be computed in the BUSINESS's local timezone,
  // not raw UTC — new Date("2026-08-10") parses as UTC midnight, which is
  // 10am on Aug 10 in Melbourne (AEST, UTC+10). That shifted the whole
  // filter window ~10 hours later than the Calendar page's boundaries (which
  // already convert correctly via fromBusinessDateTime), so a job that the
  // Calendar correctly shows on Aug 10 could be wrongly excluded here, and a
  // job that belongs to the next day could be wrongly included — causing the
  // Bookings page total to disagree with a manual count off the Calendar.
  const { today: todayStr } = getCurrentDateTimeInfo(tz)

  // An explicit date range takes priority over the quick filters below.
  if (searchParams.from || searchParams.to) {
    if (searchParams.from) query = query.gte('scheduled_at', fromBusinessDateTime(searchParams.from, '00:00', tz))
    if (searchParams.to) {
      query = query.lt('scheduled_at', fromBusinessDateTime(addDaysToDateStr(searchParams.to, 1), '00:00', tz))
    }
  } else if (searchParams.filter === 'today') {
    query = query
      .gte('scheduled_at', fromBusinessDateTime(todayStr, '00:00', tz))
      .lt('scheduled_at', fromBusinessDateTime(addDaysToDateStr(todayStr, 1), '00:00', tz))
  } else if (searchParams.filter === 'upcoming') {
    query = query
      .gte('scheduled_at', fromBusinessDateTime(todayStr, '00:00', tz))
      .lte('scheduled_at', fromBusinessDateTime(addDaysToDateStr(todayStr, 7), '23:59', tz))
  } else if (searchParams.filter === 'unassigned') {
    query = query.is('provider_id', null).not('status', 'in', '("completed","cancelled")')
  }

  let { data: jobs, error: jobsError } = await query.limit(100)

  // See customers/page.tsx — same retry-once-on-error rationale: a stale
  // token can fail this request even though the page itself loaded fine.
  if (jobsError) {
    console.error('[jobs] query failed, retrying once:', jobsError.message)
    const retry = await query.limit(100)
    jobs = retry.data
    jobsError = retry.error
    if (jobsError) console.error('[jobs] retry also failed:', jobsError.message)
  }

  // Free-text search across customer name, address, and booking ID — the
  // result set is already capped at 100 rows so filtering in memory is fine.
  const searchTerm = searchParams.q?.trim().toLowerCase()
  if (searchTerm && jobs) {
    jobs = jobs.filter((job: any) =>
      job.customer?.full_name?.toLowerCase().includes(searchTerm) ||
      job.address?.line1?.toLowerCase().includes(searchTerm) ||
      job.address?.city?.toLowerCase().includes(searchTerm) ||
      job.id?.toLowerCase().includes(searchTerm)
    )
  }

  // Cancelled bookings never happened / won't be paid, so their $ shouldn't quietly inflate
  // the headline Revenue figure — excluded by default and whenever viewing a mix of other
  // statuses. The one exception: if the admin has deliberately filtered down to exactly
  // "Cancelled" (to see what was lost), the total should reflect that view.
  const isCancelledOnlyView = selectedStatuses.length === 1 && selectedStatuses[0] === 'cancelled'
  const totalRevenueCents = (jobs || []).reduce((sum: number, job: any) => {
    if (!isCancelledOnlyView && job.status === 'cancelled') return sum
    return sum + (job.price_override ?? job.total_price ?? job.price ?? 0)
  }, 0)

  const FILTERS = [
    { label: 'All bookings', value: '' },
    { label: 'Today',        value: 'today' },
    { label: 'This week',    value: 'upcoming' },
    { label: 'Unassigned',   value: 'unassigned' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobsError ? '—' : (
              <>
                <span className="font-medium text-gray-700">Total Bookings:</span> {jobs?.length || 0}
                <span className="mx-2 text-gray-300">|</span>
                <span className="font-medium text-gray-700">Revenue:</span> {formatCurrency(totalRevenueCents)}
                {!isCancelledOnlyView && (jobs || []).some((j: any) => j.status === 'cancelled') && (
                  <span className="text-gray-400"> (excludes cancelled)</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BookingsToolbar />
          <Link
            href="/booking"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: '#2563FF' }}
          >
            <Plus className="w-4 h-4" />
            New booking
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {FILTERS.map(f => (
            <Link key={f.value}
              href={buildJobsUrl(searchParams, { filter: f.value || undefined })}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                (searchParams.filter || '') === f.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700')}>
              {f.label}
            </Link>
          ))}
        </div>
        <StatusFilter />
      </div>

      {locations && locations.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={buildJobsUrl(searchParams, { location: undefined })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              !searchParams.location
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
            )}
          >
            All locations
          </Link>
          {locations.map(loc => (
            <Link
              key={loc.id}
              href={buildJobsUrl(searchParams, { location: loc.id })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                searchParams.location === loc.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
              )}
            >
              {loc.name}
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      {jobsError ? (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Couldn't load bookings — check your connection and try refreshing.
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3.5">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden md:table-cell">Service</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Date & time</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden lg:table-cell">Provider</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden md:table-cell">Price</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5 hidden lg:table-cell">Payment</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job: any) => {
                const dt = job.scheduled_at ? formatDateTime(job.scheduled_at) : null
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                          style={{ background: '#2563FF' }}
                        >
                          {getInitials(job.customer?.full_name || '?')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{job.customer?.full_name}</p>
                            {job.location?.name && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {job.location.name.slice(0, 3)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{job.address?.line1 || job.customer?.email || ''}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        <span className="text-sm text-gray-600">{job.service?.name || '—'}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        {dt ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{dt.date}</p>
                            <p className="text-xs text-gray-400">{dt.time}</p>
                          </div>
                        ) : <span className="text-sm text-gray-400">—</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        {job.provider ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
                              style={{ background: job.provider.color || '#2563FF', fontSize: '10px', fontWeight: 700 }}
                            >
                              {getInitials(job.provider.display_name)}
                            </div>
                            <span className="text-sm text-gray-700">{job.provider.display_name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            Unassigned
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(job.price_override ?? job.total_price ?? job.price ?? 0)}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PAYMENT_STYLES[job.payment_status || 'unpaid'])}>
                          {job.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-500')}>
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(37,99,255,0.08)' }}>
            <ClipboardList className="w-7 h-7" style={{ color: '#2563FF' }} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No bookings found</h3>
          <p className="text-sm text-gray-400 mb-5">Bookings will appear here once created</p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#2563FF' }}
          >
            <Plus className="w-4 h-4" />
            Create first booking
          </Link>
        </div>
      )}
    </div>
  )
}
