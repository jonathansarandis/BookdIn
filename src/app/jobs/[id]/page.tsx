// @ts-nocheck
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArrowLeft, MapPin, User, FileText } from 'lucide-react'
import JobStatusUpdater, { CancelBookingButton } from '@/app/jobs/JobStatusUpdater'
import PayButton from '@/components/payments/PayButton'
import ProviderAssigner from '@/app/jobs/[id]/ProviderAssigner'
import JobMessages from '@/app/jobs/[id]/JobMessages'
import CardSetupButton from '@/app/jobs/[id]/CardSetupButton'
import NotesEditor from '@/app/jobs/[id]/NotesEditor'
import ScheduleEditor from '@/app/jobs/[id]/ScheduleEditor'

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

async function listPhotos(adminClient: any, businessId: string, jobId: string, folder: string) {
  try {
    const prefix = `${businessId}/${jobId}/${folder}`
    const { data: files } = await adminClient.storage.from('job-photos').list(prefix)
    if (!files?.length) return []
    const urls = await Promise.all(
      files
        .filter((f: any) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map(async (f: any) => {
          const { data } = await adminClient.storage
            .from('job-photos')
            .createSignedUrl(`${prefix}/${f.name}`, 7 * 24 * 3600)
          return data?.signedUrl ?? null
        })
    )
    return urls.filter(Boolean)
  } catch {
    return []
  }
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase    = createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, full_name')
    .eq('id', user.id)
    .single()

  const [{ data: job }, { data: providers }, { data: business }] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(id, full_name, email, phone),
        service:services(id, name, base_price),
        provider:providers(id, display_name, color),
        address:addresses(line1, city, state, postcode),
        job_extras(id, name, price)
      `)
      .eq('id', params.id)
      .eq('business_id', profile?.business_id)
      .single(),
    supabase
      .from('providers')
      .select('id, display_name, color')
      .eq('business_id', profile?.business_id)
      .eq('is_active', true)
      .order('display_name'),
    supabase
      .from('businesses')
      .select('tax_rate, tax_name, show_tax')
      .eq('id', profile?.business_id)
      .single(),
  ])

  if (!job) redirect('/jobs')

  const businessId = profile?.business_id ?? ''

  // Photos
  const [beforePhotos, afterPhotos] = await Promise.all([
    listPhotos(adminClient, businessId, job.id, 'before'),
    listPhotos(adminClient, businessId, job.id, 'after'),
  ])

  // Messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, created_at, sender_name, sender_role, content')
    .eq('job_id', job.id)
    .order('created_at', { ascending: true })

  // Provider location
  let providerLocation = null
  if (job.provider_id) {
    const { data: loc } = await supabase
      .from('provider_locations')
      .select('status, updated_at')
      .eq('provider_id', job.provider_id)
      .single()
    if (loc) {
      const ageMs = Date.now() - new Date(loc.updated_at).getTime()
      if (ageMs < 5 * 60 * 1000 && loc.status !== 'offline') {
        providerLocation = { ...loc, ageMin: Math.floor(ageMs / 60000) }
      }
    }
  }

  const isPaid  = job.payment_status === 'paid'
  const canPay  = !isPaid && job.status !== 'cancelled' && job.total_price > 0

  // Currently assumes tax-inclusive pricing (correct for AU/UK B2C).
  // For US/exclusive markets we'll add a businesses.tax_inclusive boolean
  // and branch the math accordingly.
  const taxRate = business?.tax_rate ?? 0
  const taxName = business?.tax_name?.trim() || 'Tax'
  const showTaxBreakdown = taxRate > 0 && (business?.show_tax ?? false)
  const totalCents = job.total_price || 0
  const taxCents = showTaxBreakdown ? Math.round(totalCents * taxRate / (100 + taxRate)) : 0
  const subtotalCents = totalCents - taxCents

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/calendar" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Booking #{job.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-sm text-gray-500">{job.service?.name || 'Service'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CancelBookingButton jobId={job.id} status={job.status} />
          <Link
            href={`/booking?rebook=${job.id}`}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
          >
            Rebook
          </Link>
          {isPaid || job.status === 'cancelled' ? (
            <span
              title="Cannot edit a paid or cancelled booking. Refund or rebook instead."
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed select-none"
            >
              Edit booking
            </span>
          ) : (
            <Link
              href={`/booking?edit=${job.id}`}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              Edit booking
            </Link>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[job.status] || job.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Main details */}
        <div className="md:col-span-2 space-y-5">

          {/* Schedule */}
          <ScheduleEditor
            jobId={job.id}
            initialScheduledAt={job.scheduled_at}
            durationMinutes={job.duration_minutes ?? null}
          />

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
              {job.customer.email && <p className="text-sm text-gray-500 ml-6">{job.customer.email}</p>}
              {job.customer.phone && <p className="text-sm text-gray-500 ml-6">{job.customer.phone}</p>}
            </div>
          )}

          {/* Provider */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Service provider</h2>
              {providerLocation && (
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  providerLocation.status === 'on_site'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  {providerLocation.status === 'on_site' ? 'Provider on site' : 'Provider en route'}
                  {' · '}
                  {providerLocation.ageMin === 0 ? 'just now' : `${providerLocation.ageMin}m ago`}
                </span>
              )}
            </div>
            <ProviderAssigner
              jobId={job.id}
              currentProviderId={job.provider_id || null}
              currentProviderName={job.provider?.display_name || null}
              currentProviderColor={job.provider?.color || null}
              providers={providers || []}
            />
          </div>

          {/* Notes */}
          <NotesEditor jobId={job.id} initialNotes={job.notes ?? null} />

          {/* Add-ons — structured extras saved via job_extras join table */}
          {job.job_extras?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">Add-ons</h2>
              {job.job_extras.map((extra: any) => (
                <div key={extra.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{extra.name}</span>
                  <span className="text-gray-900 font-medium">+${(extra.price / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legacy customer notes — only shows for historical records */}
          {job.customer_notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900 text-sm">Booking notes <span className="text-gray-400 font-normal">(legacy)</span></h2>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <p>{job.customer_notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Payment</h2>
            {showTaxBreakdown ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{taxName} ({taxRate}%)</span>
                  <span className="text-gray-900">${(taxCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">${(totalCents / 100).toFixed(2)} AUD</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">${((job.total_price || 0) / 100).toFixed(2)} AUD</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isPaid ? 'Paid' : 'Unpaid'}
              </span>
            </div>
            {canPay && (
              <PayButton jobId={job.id} amount={job.total_price}
                label={`Collect payment · $${((job.total_price || 0) / 100).toFixed(2)}`} />
            )}
            {!isPaid && job.status !== 'cancelled' && (
              <CardSetupButton jobId={job.id} />
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

          {/* Photos — Before */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Photos</h2>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Before</p>
              {beforePhotos.length === 0 ? (
                <p className="text-xs text-gray-400">No photos yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {beforePhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                      <img src={url} alt="Before" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">After</p>
              {afterPhotos.length === 0 ? (
                <p className="text-xs text-gray-400">No photos yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {afterPhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                      <img src={url} alt="After" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <JobMessages
            jobId={job.id}
            businessId={businessId}
            senderName={profile?.full_name ?? 'Owner'}
            initialMessages={messages ?? []}
          />

        </div>
      </div>
    </div>
  )
}
