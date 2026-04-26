import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Clock, DollarSign, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const metadata = { title: 'Services' }

export default async function ServicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

  const { data: services } = await supabase
    .from('services')
    .select('*, service_extras(*)')
    .eq('business_id', profile!.business_id!)
    .order('sort_order')

  const PRICING_LABELS: Record<string, string> = {
    flat: 'Flat rate',
    hourly: 'Hourly',
    room_based: 'Room-based',
    sqft_based: 'Per sq ft',
    custom: 'Custom',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Services & Pricing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage what you offer and how you charge</p>
        </div>
        <Link href="/services/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add service
        </Link>
      </div>

      {services && services.length > 0 ? (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{service.name}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${service.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {service.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {PRICING_LABELS[service.pricing_type]}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-xs text-gray-500 mb-3">{service.description}</p>
                  )}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <DollarSign className="w-3.5 h-3.5" />
                      Starting from {formatCurrency(service.base_price)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      ~{service.duration_minutes >= 60
                        ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? ` ${service.duration_minutes % 60}m` : ''}`
                        : `${service.duration_minutes}m`}
                    </div>
                    {service.service_extras?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {service.service_extras.length} add-on{service.service_extras.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {service.service_extras?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {service.service_extras.map((extra: any) => (
                        <span key={extra.id} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {extra.name} +{formatCurrency(extra.price)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link href={`/services/${service.id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3 h-3" />
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No services yet</h3>
          <p className="text-xs text-gray-500 mb-4">Add your first service to start taking bookings</p>
          <Link href="/services/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
            <Plus className="w-4 h-4" />
            Add your first service
          </Link>
        </div>
      )}
    </div>
  )
}
