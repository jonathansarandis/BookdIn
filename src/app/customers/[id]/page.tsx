// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, Clock, CreditCard } from 'lucide-react'
import { formatCurrency, formatDate, getInitials, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import RemoveCardButton from './RemoveCardButton'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('business_id', profile!.business_id!)
    .single()

  if (!customer) notFound()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, service:services(name), provider:providers(display_name), address:addresses(*)')
    .eq('customer_id', customer.id)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  const { data: addresses } = await supabase
    .from('addresses')
    .select('*')
    .eq('customer_id', customer.id)

  const { data: paymentMethod } = await supabase
    .from('customer_payment_methods')
    .select('stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year')
    .eq('customer_id', customer.id)
    .eq('business_id', profile!.business_id!)
    .single()

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">{customer.full_name}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-semibold">
                {getInitials(customer.full_name)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{customer.full_name}</h3>
                <p className="text-xs text-gray-500">Customer since {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <a href={`mailto:${customer.email}`} className="hover:text-brand-600 truncate">{customer.email}</a>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${customer.phone}`} className="hover:text-brand-600">{customer.phone}</a>
                </div>
              )}
            </div>
            {customer.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {customer.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <Link href={`/booking?customer=${customer.id}`}
                className="flex-1 text-center px-3 py-2 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 transition-colors">
                Book again
              </Link>
              <a href={`mailto:${customer.email}`}
                className="flex-1 text-center px-3 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Send email
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stats</h4>
            {[
              { label: 'Total bookings', value: customer.total_bookings, icon: Calendar },
              { label: 'Lifetime value', value: formatCurrency(customer.lifetime_value), icon: DollarSign },
              { label: 'Last booking', value: customer.last_booking_at ? formatDate(customer.last_booking_at) : 'Never', icon: Clock },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </div>
                <span className="text-sm font-medium text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Addresses */}
          {addresses && addresses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Addresses</h4>
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <div key={addr.id} className="flex gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                      <p className="text-xs text-gray-400">{addr.city}, {addr.state} {addr.postcode}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment method */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment method</h4>
              {paymentMethod && <RemoveCardButton customerId={customer.id} />}
            </div>
            {paymentMethod ? (
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <CreditCard className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                {paymentMethod.card_last4 ? (
                  <span>
                    <span className="capitalize">{paymentMethod.card_brand}</span>
                    {' ····'}{paymentMethod.card_last4}
                    {paymentMethod.card_exp_month && paymentMethod.card_exp_year && (
                      <span className="text-gray-400 ml-1.5">
                        expires {paymentMethod.card_exp_month}/{String(paymentMethod.card_exp_year).slice(-2)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">Card on file (details unavailable)</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No card on file</p>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Right column - Jobs */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Booking history</h3>
              <Link href={`/booking?customer=${customer.id}`}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                + New booking
              </Link>
            </div>
            {jobs && jobs.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {jobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{job.service?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.address ? `${job.address.line1}, ${job.address.city}` : ''}
                        {job.provider ? ` · ${job.provider.display_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(job.price)}</p>
                      <p className="text-xs text-gray-400">{formatDate(job.scheduled_at)}</p>
                    </div>
                    <span className={cn('status-pill', JOB_STATUS_COLORS[job.status])}>
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bookings yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
