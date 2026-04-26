// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import { formatCurrency, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Jobs' }

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { status?: string; filter?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  let query = supabase
    .from('jobs')
    .select('*, customer:customers(full_name, email), service:services(name), provider:providers(display_name), address:addresses(line1, city)')
    .eq('business_id', profile!.business_id!)
    .order('scheduled_at', { ascending: false })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString()

  if (searchParams.filter === 'today') {
    query = query.gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd)
  } else if (searchParams.filter === 'upcoming') {
    query = query.gte('scheduled_at', todayStart).lte('scheduled_at', weekEnd)
  } else if (searchParams.filter === 'unassigned') {
    query = query.is('provider_id', null).not('status', 'in', '("completed","cancelled")')
  }

  const { data: jobs } = await query.limit(50)

  const FILTERS = [
    { label: 'All jobs', value: '' },
    { label: 'Today', value: 'today' },
    { label: 'This week', value: 'upcoming' },
    { label: 'Unassigned', value: 'unassigned' },
  ]

  const STATUSES = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">{jobs?.length || 0} jobs</p>
        </div>
        <Link href="/booking"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New booking
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {FILTERS.map(f => (
            <Link key={f.value}
              href={`/jobs?filter=${f.value}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                (searchParams.filter || '') === f.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700')}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <Link key={s.value}
              href={`/jobs?${searchParams.filter ? `filter=${searchParams.filter}&` : ''}status=${s.value}`}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                (searchParams.status || '') === s.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white')}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Service</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Date & time</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Provider</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Price</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <Link href={`/jobs/${job.id}`} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {getInitials(job.customer?.full_name || '?')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job.customer?.full_name}</p>
                        <p className="text-xs text-gray-400 hidden sm:block">{job.address ? `${job.address.line1}` : ''}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Link href={`/jobs/${job.id}`}>
                      <span className="text-sm text-gray-600">{job.service?.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/jobs/${job.id}`}>
                      <span className="text-sm text-gray-900">{formatDate(job.scheduled_at)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <Link href={`/jobs/${job.id}`}>
                      {job.provider ? (
                        <span className="text-sm text-gray-600">{job.provider.display_name}</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">⚠ Unassigned</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Link href={`/jobs/${job.id}`}>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(job.price)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/jobs/${job.id}`}>
                      <span className={cn('status-pill', JOB_STATUS_COLORS[job.status])}>
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
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
            <ClipboardList className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No jobs found</h3>
          <p className="text-xs text-gray-500 mb-4">Jobs will appear here once bookings are made</p>
          <Link href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" />
            Create first booking
          </Link>
        </div>
      )}
    </div>
  )
}
