import { formatBusinessDateTime } from '@/lib/datetime'

// ─── Shared data shapes ────────────────────────────────────────────────────

export interface BusinessEmailData {
  name: string
  brand_color?: string | null
  logo_url?: string | null
  contact_email?: string | null
  timezone: string
}

export interface CustomerEmailData {
  full_name: string
  email: string
}

export interface AddressEmailData {
  line1: string
  city: string
  state: string
  postcode: string
}

export interface ServiceEmailData {
  name: string
}

export interface JobEmailData {
  id: string
  scheduled_at: string
  total_price: number
  tax_amount?: number | null
}

export interface TemplateResult {
  subject: string
  html: string
  text: string
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function accent(business: BusinessEmailData): string {
  return business.brand_color || '#1A6B4A'
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatAddr(a: AddressEmailData): string {
  return `${a.line1}, ${a.city} ${a.state} ${a.postcode}`
}

function emailHeader(business: BusinessEmailData): string {
  const color = accent(business)
  const logo = business.logo_url
    ? `<img src="${business.logo_url}" alt="${business.name}" style="max-height:40px;max-width:200px;display:block;margin-bottom:10px;" />`
    : ''
  return `
    <tr>
      <td style="background-color:${color};padding:32px 40px;">
        ${logo}
        <span style="color:#ffffff;font-size:22px;font-weight:600;">${business.name}</span>
      </td>
    </tr>`
}

function emailFooter(business: BusinessEmailData): string {
  return `
    <tr>
      <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
          ${business.name} &middot; Powered by BookdIn
        </p>
      </td>
    </tr>`
}

function wrapEmail(business: BusinessEmailData, body: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        ${emailHeader(business)}
        <tr><td style="padding:40px;">${body}</td></tr>
        ${emailFooter(business)}
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Shared booking summary table used by confirmation and reminder
function bookingSummaryTable(
  job: JobEmailData,
  service: ServiceEmailData,
  address: AddressEmailData,
  business: BusinessEmailData,
): string {
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone)
  const taxCents = job.tax_amount ?? 0
  const showTax = taxCents > 0
  const subtotalCents = job.total_price - taxCents

  const taxRows = showTax ? `
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Subtotal</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${formatMoney(subtotalCents)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Tax</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${formatMoney(taxCents)}</td>
        </tr></table>
      </td></tr>` : ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Service</td>
          <td style="text-align:right;color:#111827;font-size:14px;font-weight:600;">${service.name}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Date &amp; time</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${dateStr}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Address</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${formatAddr(address)}</td>
        </tr></table>
      </td></tr>
      ${taxRows}
      <tr><td style="padding:6px 0;border-top:2px solid #111827;">
        <table width="100%"><tr>
          <td style="color:#111827;font-size:15px;font-weight:700;">Total</td>
          <td style="text-align:right;color:#111827;font-size:18px;font-weight:700;">${formatMoney(job.total_price)} AUD</td>
        </tr></table>
      </td></tr>
    </table>`
}

// ─── Booking confirmation ──────────────────────────────────────────────────

export function bookingConfirmationTemplate(data: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cardSetupUrl?: string
}): TemplateResult {
  const { job, customer, business, address, service, cardSetupUrl } = data
  const color = accent(business)
  const firstName = customer.full_name.split(' ')[0]
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone)

  const paymentSection = cardSetupUrl
    ? `<div style="background-color:#fefce8;border:1px solid #fde047;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#854d0e;font-size:15px;font-weight:600;">Action required: Add your card on file</p>
        <p style="margin:0 0 16px;color:#92400e;font-size:14px;line-height:1.6;">
          To secure your booking please save your card details via our secure link. Your card won't be charged until after your service is complete.
        </p>
        <a href="${cardSetupUrl}" style="display:inline-block;background-color:${color};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Add card details securely &rarr;
        </a>
      </div>`
    : `<div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">
          Payment will be collected on the day of your service. We'll be in touch shortly to confirm your booking.
        </p>
      </div>`

  const subject = `Booking confirmed — ${service.name} on ${dateStr}`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Thanks for booking with us! Your booking has been received and we'll be in touch shortly to confirm.
    </p>
    ${bookingSummaryTable(job, service, address, business)}
    ${paymentSection}
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      Questions? Simply reply to this email and we'll get back to you.
    </p>`)

  const textLines = [
    `Hi ${firstName},`,
    '',
    'Your booking is confirmed.',
    '',
    `Service: ${service.name}`,
    `Date: ${dateStr}`,
    `Address: ${formatAddr(address)}`,
    `Total: ${formatMoney(job.total_price)} AUD`,
    '',
    cardSetupUrl
      ? `Add your card on file: ${cardSetupUrl}`
      : 'Payment will be collected on the day.',
    '',
    'Questions? Reply to this email.',
    '',
    `— ${business.name}`,
  ]

  return { subject, html, text: textLines.join('\n') }
}

// ─── Receipt ───────────────────────────────────────────────────────────────

export function receiptTemplate(data: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  paymentAmount: number
}): TemplateResult {
  const { job, customer, business, paymentAmount } = data
  const firstName = customer.full_name.split(' ')[0]
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone)
  const ref = job.id.slice(0, 8).toUpperCase()

  const subject = `Receipt — ${formatMoney(paymentAmount)} payment received`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      We've received your payment. Thanks for choosing ${business.name}!
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Amount paid</p>
      <p style="margin:0;color:#166534;font-size:28px;font-weight:700;">${formatMoney(paymentAmount)} AUD</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Booking reference</td>
          <td style="text-align:right;color:#111827;font-size:14px;font-family:monospace;">#${ref}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Service date</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${dateStr}</td>
        </tr></table>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      If you have any questions about this payment, simply reply to this email.
    </p>`)

  const text = [
    `Hi ${firstName},`,
    '',
    `Payment received: ${formatMoney(paymentAmount)} AUD`,
    `Booking reference: #${ref}`,
    `Service date: ${dateStr}`,
    '',
    'Questions about this payment? Reply to this email.',
    '',
    `— ${business.name}`,
  ].join('\n')

  return { subject, html, text }
}

// ─── Cancellation ─────────────────────────────────────────────────────────

export function cancellationTemplate(data: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cancellationReason?: string
}): TemplateResult {
  const { job, customer, business, address, service, cancellationReason } = data
  const firstName = customer.full_name.split(' ')[0]
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone)
  const ref = job.id.slice(0, 8).toUpperCase()

  const reasonHtml = cancellationReason
    ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${cancellationReason}</p>`
    : ''

  const subject = `Booking cancelled — ${service.name} on ${dateStr}`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your booking has been cancelled. We're sorry for any inconvenience.
    </p>
    ${reasonHtml}
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Booking reference</td>
          <td style="text-align:right;color:#111827;font-size:14px;font-family:monospace;">#${ref}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Service</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${service.name}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Was scheduled</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${dateStr}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;">
        <table width="100%"><tr>
          <td style="color:#6b7280;font-size:14px;">Address</td>
          <td style="text-align:right;color:#111827;font-size:14px;">${formatAddr(address)}</td>
        </tr></table>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;color:#6b7280;font-size:14px;line-height:1.6;">
      If you'd like to rebook, please reply to this email.
    </p>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      If you believe this was cancelled in error, please get in touch as soon as possible.
    </p>`)

  const textLines = [
    `Hi ${firstName},`,
    '',
    'Your booking has been cancelled.',
    '',
    `Booking reference: #${ref}`,
    `Service: ${service.name}`,
    `Was scheduled: ${dateStr}`,
    `Address: ${formatAddr(address)}`,
  ]
  if (cancellationReason) textLines.push(`Reason: ${cancellationReason}`)
  textLines.push('', 'To rebook, reply to this email.', '', `— ${business.name}`)

  return { subject, html, text: textLines.join('\n') }
}

// ─── Reminder ─────────────────────────────────────────────────────────────

export function reminderTemplate(data: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
}): TemplateResult {
  const { job, customer, business, address, service } = data
  const color = accent(business)
  const firstName = customer.full_name.split(' ')[0]
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone)

  const subject = `Reminder: ${service.name} is tomorrow`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      This is a friendly reminder that your service is scheduled for <strong>tomorrow</strong>. We look forward to seeing you!
    </p>
    ${bookingSummaryTable(job, service, address, business)}
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">
        Please ensure someone is home and the property is accessible at the scheduled time.
      </p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      Need to reschedule or have questions? Simply reply to this email as soon as possible.
    </p>`)

  const text = [
    `Hi ${firstName},`,
    '',
    'Reminder: your service is tomorrow.',
    '',
    `Service: ${service.name}`,
    `Date: ${dateStr}`,
    `Address: ${formatAddr(address)}`,
    `Total: ${formatMoney(job.total_price)} AUD`,
    '',
    'Please ensure someone is home and the property is accessible.',
    '',
    'Need to reschedule? Reply to this email.',
    '',
    `— ${business.name}`,
  ].join('\n')

  return { subject, html, text }
}
