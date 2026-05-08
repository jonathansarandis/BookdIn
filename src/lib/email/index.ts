import { Resend } from 'resend'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  bookingConfirmationTemplate,
  receiptTemplate,
  cancellationTemplate,
  reminderTemplate,
  renderConfirmationHtml,
  substituteVars,
  type BusinessEmailData,
  type CustomerEmailData,
  type AddressEmailData,
  type ServiceEmailData,
  type JobEmailData,
} from './templates'
import { DEFAULT_BOOKING_CONFIRMATION, type BookingConfirmationSections } from './defaultTemplates'
import { formatBusinessDateTime } from '@/lib/datetime'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'BookdIn <hello@bookdin.co>'

type SendResult = { success: true; id: string } | { success: false; error: string }

function replyTo(business: BusinessEmailData): string {
  return business.contact_email || 'hello@bookdin.co'
}

export async function sendBookingConfirmation(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cardSetupUrl?: string
  business_id?: string
}): Promise<SendResult> {
  try {
    let subject: string
    let html: string
    let text: string

    if (params.business_id) {
      const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const [{ data: templateRow }, { data: bizExtra }] = await Promise.all([
        supabase
          .from('email_templates')
          .select('sections')
          .eq('business_id', params.business_id)
          .eq('template_type', 'booking_confirmation')
          .single(),
        supabase
          .from('businesses')
          .select('cancellation_fee_cents, cancellation_cutoff')
          .eq('id', params.business_id)
          .single(),
      ])

      const sections: BookingConfirmationSections = templateRow?.sections
        ? { ...DEFAULT_BOOKING_CONFIRMATION, ...(templateRow.sections as Partial<BookingConfirmationSections>) }
        : { ...DEFAULT_BOOKING_CONFIRMATION }

      const cancellationFeeCents: number = (bizExtra as any)?.cancellation_fee_cents ?? 5000
      const cancellationCutoff: string = (bizExtra as any)?.cancellation_cutoff ?? '5 PM'

      const tz = params.business.timezone
      const dateStr = params.job.is_flexible_time
        ? "Flexible — we'll confirm a specific time closer to your booking"
        : formatBusinessDateTime(params.job.scheduled_at, tz, 'EEEE, d MMMM yyyy')
      const arrivalStr = params.job.is_flexible_time
        ? 'Flexible'
        : formatBusinessDateTime(params.job.scheduled_at, tz, 'h:mm a')

      const taxCents = params.job.tax_amount ?? 0
      const subtotalCents = params.job.total_price - taxCents
      const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

      const vars: Record<string, string> = {
        customer_name:       params.customer.full_name,
        service_name:        params.service.name,
        date:                dateStr,
        arrival_time:        arrivalStr,
        address:             `${params.address.line1}, ${params.address.city} ${params.address.state} ${params.address.postcode}`,
        subtotal:            fmt(subtotalCents),
        gst:                 fmt(taxCents),
        total:               fmt(params.job.total_price),
        business_name:       params.business.name,
        cancellation_fee:    `$${(cancellationFeeCents / 100).toFixed(0)}`,
        cancellation_cutoff: cancellationCutoff,
      }

      html = renderConfirmationHtml(
        sections, vars, params.business,
        params.job, params.service, params.address,
        params.cardSetupUrl,
      )
      subject = params.job.is_flexible_time
        ? `Booking confirmed — ${params.service.name}`
        : `Booking confirmed — ${params.service.name} on ${dateStr}`
      text = [
        substituteVars(sections.greeting, vars),
        '',
        `Service: ${params.service.name}`,
        `Date: ${dateStr}`,
        `Address: ${vars.address}`,
        `Total: ${vars.total}`,
        '',
        params.cardSetupUrl
          ? `Add your card on file: ${params.cardSetupUrl}`
          : substituteVars(sections.payment_disclosure, vars),
        '',
        substituteVars(sections.sign_off, vars),
      ].join('\n')
    } else {
      const result = bookingConfirmationTemplate(params)
      subject = result.subject
      html = result.html
      text = result.text
    }

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendBookingConfirmation failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendReceipt(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  paymentAmount: number
}): Promise<SendResult> {
  try {
    const { subject, html, text } = receiptTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendReceipt failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendCancellation(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cancellationReason?: string
}): Promise<SendResult> {
  try {
    const { subject, html, text } = cancellationTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendCancellation failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendReminder(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
}): Promise<SendResult> {
  try {
    const { subject, html, text } = reminderTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendReminder failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}
