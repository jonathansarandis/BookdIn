// Shared "(re)send the booking confirmation email for this job" logic, used by
// both the explicit resend endpoint and the price-override route (so a
// corrected price actually reaches the customer without a separate manual step).
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'

interface JobEmailRow {
  id: string
  scheduled_at: string
  total_price: number
  price_override: number | null
  tax_amount: number
  payment_status: string | null
  customer: { full_name: string; email: string } | null
  service: { name: string } | null
  address: { line1: string; city: string; state: string; postcode: string } | null
  business: {
    name: string
    brand_color: string | null
    logo_url: string | null
    contact_email: string | null
    timezone: string
    stripe_onboarded: boolean
    stripe_charges_enabled: boolean
    plan: string
    currency: string
  } | null
}

type ResendResult = { success: true; id: string } | { success: false; error: string }

export async function resendBookingConfirmation(jobId: string, businessId: string): Promise<ResendResult> {
  const admin = createAdminClient()

  const { data: rawJob } = await admin
    .from('jobs')
    .select(`
      id, scheduled_at, total_price, price_override, tax_amount, payment_status,
      customer:customers(full_name, email),
      service:services(name),
      address:addresses(line1, city, state, postcode),
      business:businesses(name, brand_color, logo_url, contact_email, timezone, stripe_onboarded, stripe_charges_enabled, plan, currency)
    `)
    .eq('id', jobId)
    .single()

  if (!rawJob) return { success: false, error: 'Not found' }

  const job = rawJob as unknown as JobEmailRow
  if (!job.customer || !job.service || !job.address || !job.business) {
    return { success: false, error: 'Job data incomplete' }
  }

  const cardSetupUrl = (job.payment_status !== 'paid' && job.business.stripe_charges_enabled)
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${jobId}/card-setup`
    : undefined

  const result = await sendBookingConfirmation({
    job: {
      id: job.id,
      scheduled_at: job.scheduled_at,
      total_price: job.total_price,
      price_override: job.price_override,
      tax_amount: job.tax_amount,
    },
    customer: job.customer,
    business: job.business,
    address: job.address,
    service: job.service,
    cardSetupUrl,
    business_id: businessId,
  })

  if (result.success) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsTable: any = admin.from('jobs')
    await jobsTable.update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', jobId)
  }

  return result
}
