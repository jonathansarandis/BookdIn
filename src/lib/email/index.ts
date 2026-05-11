import { Resend } from 'resend'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  bookingConfirmationTemplate,
  receiptTemplate,
  cancellationTemplate,
  reminderTemplate,
  renderConfirmationHtml,
  substituteVars,
  ownerBookingNotificationTemplate,
  type BusinessEmailData,
  type CustomerEmailData,
  type AddressEmailData,
  type ServiceEmailData,
  type JobEmailData,
} from './templates'
import { DEFAULT_BOOKING_CONFIRMATION_BODY } from './defaultTemplates'
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
          .select('cancellation_fee_cents, cancellation_cutoff, phone, website, street_address, suburb, state, postcode, country, business_number, business_number_label')
          .eq('id', params.business_id)
          .single(),
      ])

      // Extract body string — new schema: { body: string }
      // Graceful fallback for old sectioned schema: concatenate fields on-the-fly
      const rawSections: any = templateRow?.sections ?? null
      let templateBody: string
      if (typeof rawSections?.body === 'string') {
        templateBody = rawSections.body
      } else if (rawSections?.greeting) {
        console.warn('[email] Old sectioned template detected — migrating to body format on-the-fly')
        const parts: string[] = []
        if (rawSections.greeting)              parts.push(rawSections.greeting)
        parts.push('{{booking_details}}')
        if (rawSections.extras_note_heading)   parts.push(`**${rawSections.extras_note_heading}**`)
        if (rawSections.extras_note_body)      parts.push(rawSections.extras_note_body)
        if (rawSections.payment_heading)       parts.push(`**${rawSections.payment_heading}**`)
        if (rawSections.payment_body)          parts.push(rawSections.payment_body)
        parts.push('{{payment_button}}')
        if (rawSections.payment_disclosure)    parts.push(rawSections.payment_disclosure)
        if (rawSections.cancellation_heading)  parts.push(`**${rawSections.cancellation_heading}**`)
        if (rawSections.cancellation_body)     parts.push(rawSections.cancellation_body)
        if (rawSections.walkthrough_heading)   parts.push(`**${rawSections.walkthrough_heading}**`)
        if (rawSections.walkthrough_body)      parts.push(rawSections.walkthrough_body)
        if (rawSections.sign_off)              parts.push(rawSections.sign_off)
        templateBody = parts.join('\n\n')
      } else {
        templateBody = DEFAULT_BOOKING_CONFIRMATION_BODY
      }

      const cancellationFeeCents: number = (bizExtra as any)?.cancellation_fee_cents ?? 5000
      const cancellationCutoff: string = (bizExtra as any)?.cancellation_cutoff ?? '5 PM'

      const tz = params.business.timezone
      const dateStr = formatBusinessDateTime(params.job.scheduled_at, tz, 'EEEE, d MMMM yyyy')
      const arrivalStr = params.job.is_flexible_time
        ? "Flexible — we'll confirm a specific time closer to your booking"
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

      const augmentedBusiness = {
        ...params.business,
        phone:                 (bizExtra as any)?.phone ?? null,
        website:               (bizExtra as any)?.website ?? null,
        street_address:        (bizExtra as any)?.street_address ?? null,
        suburb:                (bizExtra as any)?.suburb ?? null,
        state:                 (bizExtra as any)?.state ?? null,
        postcode:              (bizExtra as any)?.postcode ?? null,
        country:               (bizExtra as any)?.country ?? null,
        business_number:       (bizExtra as any)?.business_number ?? null,
        business_number_label: (bizExtra as any)?.business_number_label ?? null,
      }

      html = renderConfirmationHtml(
        templateBody, vars, augmentedBusiness,
        params.job, params.service, params.address,
        params.cardSetupUrl,
      )
      subject = params.job.is_flexible_time
        ? `Booking confirmed — ${params.service.name}`
        : `Booking confirmed — ${params.service.name} on ${dateStr}`
      // Plain-text: strip markdown, replace block tokens
      text = substituteVars(
        templateBody
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\{\{booking_details\}\}/g,
            `---\nService: ${params.service.name}\nDate: ${dateStr}\nTime: ${arrivalStr}\nAddress: ${vars.address}\nTotal: ${vars.total}\n---`)
          .replace(/\{\{payment_button\}\}/g,
            params.cardSetupUrl ? `Add card details securely: ${params.cardSetupUrl}` : ''),
        vars,
      )
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

export async function sendOwnerBookingNotification(params: {
  job: JobEmailData
  customer: CustomerEmailData & { phone?: string | null }
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  frequency?: string | null
  jobUrl: string
  ownerEmail: string
}): Promise<SendResult> {
  try {
    const { subject, html, text } = ownerBookingNotificationTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.ownerEmail,
      bcc: 'jonathan.sarandis@gmail.com',
      reply_to: params.customer.email,
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendOwnerBookingNotification failed:', error, { jobId: params.job.id })
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
