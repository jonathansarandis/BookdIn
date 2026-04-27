// @ts-nocheck
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, MapPin, Calendar, Clock, User, Briefcase, FileText, DollarSign } from 'lucide-react'
import JobStatusUpdater from '@/app/jobs/JobStatusUpdater'
import PayButton from '@/components/payments/PayButton'

const STATUS_STYLES = {
  pending:     'bg-yellow-100 text-yellow-800',
  confirmed:   'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-800',
}

const STATUS_LABELS = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(id, full_name, email, phone),
      service:services(id, name, base_price),
      provider:providers(id, display_name, color),
      address:addresses(line1, city, state, postcode)
    `)
    .eq('id', params.id)
    .eq('business_id', profile?.business_id)
    .single()

  if (!job) redirect('/jobs')

  const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : null
  const isPaid = job.payment_status === 'paid'
  const canPay = !isPaid && job.status !== 'cancelled' && job.total_price > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job #{job.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-sm text-gray-500">{job.service?.name || 'Service'}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-700'}`}>
          {STATUS_LABELS[job.status] || job.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Main details */}
        <div className="md:col-span-2 space-y-5">

          {/* Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Schedule</h2>
            {scheduledAt && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                {scheduledAt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            {job.scheduled_time && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                {new Date(`2000-01-01T${job.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
            )}
            {job.duration_minutes && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                {job.duration_minutes} minutes
              </div>
            )}
          </div>

          {/* Address */}
          {job.address && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Address</h2>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <span>{job.address.line1}, {job.address.city} {job.address.state} {job.address.postcode}</span>
              </div>
            </div>
          )}

          {/* Customer */}
          {job.customer && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Customer</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <Link href={`/customers/${job.customer.id}`} className="text-brand-600 hover:underline font-medium">
                  {job.customer.full_name}
                </Link>
              </div>
              {job.customer.email && (
                <p className="text-sm text-gray-500 ml-6">{job.customer.email}</p>
              )}
              {job.customer.phone && (
                <p className="text-sm text-gray-500 ml-6">{job.customer.phone}</p>
              )}
            </div>
          )}

          {/* Provider */}
          {job.provider && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Assigned provider</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span>{job.provider.display_name}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900">Notes</h2>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <p>{job.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Payment</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">
                ${((job.total_price || 0) / 100).toFixed(2)} AUD
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isPaid ? 'Paid' : 'Unpaid'}
              </span>
            </div>
            {canPay && (
              <PayButton
                jobId={job.id}
                amount={job.total_price}
                label={`Collect payment · $${((job.total_price || 0) / 100).toFixed(2)}`}
              />
            )}
            {isPaid && job.status === 'completed' && (
              <p className="text-xs text-green-600 text-center">✓ Payment received</p>
            )}
          </div>

          {/* Status updater */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Update status</h2>
            <JobStatusUpdater jobId={job.id} currentStatus={job.status} providers={[]} currentProviderId={job.provider_id || null} />
          </div>

        </div>
      </div>
    </div>
  )
}
