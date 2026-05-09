import { formatBusinessDateTime } from '@/lib/datetime'

// ─── Shared data shapes ────────────────────────────────────────────────────

export interface BusinessEmailData {
  name: string
  brand_color?: string | null
  logo_url?: string | null
  contact_email?: string | null
  timezone: string
  currency?: string | null
  plan?: string | null
  tax_name?: string | null
  // Contact details (from businesses table — appear in email footer)
  phone?: string | null
  website?: string | null
  street_address?: string | null
  suburb?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  business_number?: string | null
  business_number_label?: string | null
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
  is_flexible_time?: boolean
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

function formatMoney(cents: number, currency?: string | null): string {
  return `$${(cents / 100).toFixed(2)} ${currency || 'USD'}`
}

function formatAddr(a: AddressEmailData): string {
  return `${a.line1}, ${a.city} ${a.state} ${a.postcode}`
}

function emailHeader(business: BusinessEmailData): string {
  const logo = business.logo_url
    ? `<img src="${business.logo_url}" alt="${business.name}" style="max-height:40px;max-width:180px;display:block;margin-bottom:10px;" />`
    : ''
  return `
    <tr>
      <td class="email-header-cell" style="background-color:#ffffff;padding:28px 40px 24px;border-bottom:1px solid #ede9e3;">
        ${logo}
        <span style="color:#1a1a1a;font-size:17px;font-weight:600;display:block;">${business.name}</span>
      </td>
    </tr>`
}

function emailFooter(business: BusinessEmailData): string {
  const addrParts: string[] = []
  if (business.street_address) addrParts.push(business.street_address)
  const cityLine: string[] = []
  if (business.suburb) cityLine.push(business.suburb)
  if (business.state) cityLine.push(business.state)
  if (business.postcode) cityLine.push(business.postcode)
  if (cityLine.length) addrParts.push(cityLine.join(' '))
  if (business.country) addrParts.push(business.country)

  const contactParts: string[] = []
  if (addrParts.length) contactParts.push(addrParts.join(', '))
  if (business.phone) contactParts.push(business.phone)
  if (business.website) {
    const display = business.website.replace(/^https?:\/\//, '')
    contactParts.push(`<a href="${business.website}" style="color:#8a8275;text-decoration:none;">${display}</a>`)
  }
  if (business.business_number) {
    contactParts.push(`${business.business_number_label || 'ABN'}: ${business.business_number}`)
  }

  const contactHtml = contactParts.length
    ? `<p style="margin:4px 0 8px;color:#8a8275;font-size:12px;line-height:1.7;">${contactParts.join(' &nbsp;&middot;&nbsp; ')}</p>`
    : ''

  const poweredBy = (!business.plan || business.plan === 'free')
    ? `<p style="margin:0;font-size:12px;color:#8a8275;"><a href="https://bookdin.co" style="color:#8a8275;text-decoration:none;">Powered by BookdIn</a></p>`
    : ''

  return `
    <tr>
      <td class="email-footer-cell" style="background-color:#f5f3ef;padding:24px 40px;border-top:1px solid #ede9e3;">
        <p style="margin:0;color:#3d3730;font-size:13px;font-weight:600;">${business.name}</p>
        ${contactHtml}
        ${poweredBy}
      </td>
    </tr>`
}

function wrapEmail(business: BusinessEmailData, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @media only screen and (max-width: 620px) {
      .email-card { width: 100% !important; border-radius: 0 !important; }
      .email-body-cell { padding: 24px !important; }
      .email-header-cell { padding: 20px 24px 18px !important; }
      .email-footer-cell { padding: 20px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef;padding:40px 20px;">
    <tr><td align="center">
      <table class="email-card" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
        ${emailHeader(business)}
        <tr><td class="email-body-cell" style="padding:36px 40px;">${body}</td></tr>
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
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone, 'EEEE, d MMMM yyyy')
  const timeStr = job.is_flexible_time
    ? "Flexible — we'll confirm closer to your booking"
    : formatBusinessDateTime(job.scheduled_at, business.timezone, 'h:mm a')
  const taxCents = job.tax_amount ?? 0
  const showTax = taxCents > 0
  const subtotalCents = job.total_price - taxCents
  const taxLabel = business.tax_name || 'Tax'

  const labelStyle = 'margin:0 0 2px;color:#8a8275;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;'
  const valueStyle = 'margin:0;color:#1a1a1a;font-size:14px;line-height:1.5;'
  const cellStyle = 'padding:14px 16px;border-bottom:1px solid #ebe5d9;'

  const taxRows = showTax ? `
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">Subtotal</p>
          <p style="${valueStyle}">${formatMoney(subtotalCents, business.currency)}</p>
        </td>
      </tr>
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">${taxLabel}</p>
          <p style="${valueStyle}">${formatMoney(taxCents, business.currency)}</p>
        </td>
      </tr>` : ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;border-radius:8px;border:1px solid #ebe5d9;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">Service</p>
          <p style="${valueStyle}font-weight:600;">${service.name}</p>
        </td>
      </tr>
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">Date</p>
          <p style="${valueStyle}">${dateStr}</p>
        </td>
      </tr>
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">Time</p>
          <p style="${valueStyle}">${timeStr}</p>
        </td>
      </tr>
      <tr>
        <td style="${cellStyle}">
          <p style="${labelStyle}">Address</p>
          <p style="${valueStyle}">${formatAddr(address)}</p>
        </td>
      </tr>
      ${taxRows}
      <tr>
        <td style="padding:14px 16px;background-color:#f0ebe3;">
          <p style="${labelStyle}">Total</p>
          <p style="margin:0;color:#1a1a1a;font-size:17px;font-weight:600;">${formatMoney(job.total_price, business.currency)}</p>
        </td>
      </tr>
    </table>`
}

// ─── Variable substitution ────────────────────────────────────────────────

export function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

// ─── Markdown-light body renderer ─────────────────────────────────────────

function applyInlineMarkdown(text: string, linkColor: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
      `<a href="${u}" style="color:${linkColor};text-decoration:underline;">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function renderParagraph(para: string, linkColor: string): string {
  const trimmed = para.trim()
  // Heading: entire paragraph is **...**
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
    const text = trimmed.slice(2, -2)
    return `<p style="margin:0 0 12px;color:#6b6258;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${text}</p>`
  }
  const lines = para.split('\n').map(l => applyInlineMarkdown(l, linkColor))
  return `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">${lines.join('<br>')}</p>`
}

export function renderConfirmationHtml(
  body: string,
  vars: Record<string, string>,
  business: BusinessEmailData,
  job: JobEmailData,
  service: ServiceEmailData,
  address: AddressEmailData,
  paymentLink?: string,
): string {
  const color = accent(business)

  const detailsTableHtml =
    `<div style="margin-bottom:24px;">${bookingSummaryTable(job, service, address, business)}</div>`

  const paymentButtonHtml = paymentLink
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${paymentLink}" style="display:inline-block;background-color:${color};color:#ffffff;padding:16px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">
          Add card details securely &rarr;
        </a>
        <p style="margin:10px 0 0;color:#9a8f84;font-size:12px;">Takes about 30 seconds &mdash; your card is held, not charged.</p>
      </div>`
    : ''

  const paragraphs = body.split(/\n\n+/)
  let hasDetails = false
  let hasPayment = false

  const rendered = paragraphs.map(para => {
    const trimmed = para.trim()
    if (trimmed === '{{booking_details}}') { hasDetails = true; return detailsTableHtml }
    if (trimmed === '{{payment_button}}')  { hasPayment = true; return paymentButtonHtml }
    return renderParagraph(substituteVars(trimmed, vars), color)
  })

  if (!hasDetails) rendered.splice(1, 0, detailsTableHtml)
  if (!hasPayment && paymentLink) rendered.splice(rendered.length - 1, 0, paymentButtonHtml)

  return wrapEmail(business, rendered.join('\n'))
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
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone, 'EEEE, d MMMM yyyy')
  const timeStr = job.is_flexible_time
    ? "Flexible — we'll confirm a specific time closer to your booking"
    : formatBusinessDateTime(job.scheduled_at, business.timezone, 'h:mm a')

  const paymentSection = cardSetupUrl
    ? `<div style="background-color:#fefce8;border:1px solid #fde047;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#854d0e;font-size:15px;font-weight:600;">Action required: Add your card on file</p>
        <p style="margin:0 0 16px;color:#92400e;font-size:14px;line-height:1.6;">
          To secure your booking please save your card details via our secure link. Your card won't be charged until after your service is complete.
        </p>
        <div style="text-align:center;margin-top:8px;">
          <a href="${cardSetupUrl}" style="display:inline-block;background-color:${color};color:#ffffff;padding:16px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">
            Add card details securely &rarr;
          </a>
          <p style="margin:10px 0 0;color:#9a8f84;font-size:12px;">Takes about 30 seconds &mdash; your card is held, not charged.</p>
        </div>
      </div>`
    : `<div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:${color};font-size:14px;line-height:1.6;">
          Payment will be collected on the day of your service. We'll be in touch shortly to confirm your booking.
        </p>
      </div>`

  const subject = job.is_flexible_time
    ? `Booking confirmed — ${service.name}`
    : `Booking confirmed — ${service.name} on ${dateStr}`

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
    `Time: ${timeStr}`,
    `Address: ${formatAddr(address)}`,
    `Total: ${formatMoney(job.total_price, business.currency)}`,
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
  const dateStr = job.is_flexible_time ? 'Flexible time' : formatBusinessDateTime(job.scheduled_at, business.timezone)
  const ref = job.id.slice(0, 8).toUpperCase()

  const subject = `Receipt — ${formatMoney(paymentAmount, business.currency)} payment received`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      We've received your payment. Thanks for choosing ${business.name}!
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Amount paid</p>
      <p style="margin:0;color:${accent(business)};font-size:28px;font-weight:700;">${formatMoney(paymentAmount, business.currency)}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;border-radius:8px;border:1px solid #ebe5d9;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 16px;border-bottom:1px solid #ebe5d9;">
        <p style="margin:0 0 2px;color:#8a8275;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Booking reference</p>
        <p style="margin:0;color:#1a1a1a;font-size:14px;font-family:monospace;">#${ref}</p>
      </td></tr>
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 2px;color:#8a8275;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Service date</p>
        <p style="margin:0;color:#1a1a1a;font-size:14px;">${dateStr}</p>
      </td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      If you have any questions about this payment, simply reply to this email.
    </p>`)

  const text = [
    `Hi ${firstName},`,
    '',
    `Payment received: ${formatMoney(paymentAmount, business.currency)}`,
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
  const dateStr = job.is_flexible_time ? 'Flexible time' : formatBusinessDateTime(job.scheduled_at, business.timezone)
  const ref = job.id.slice(0, 8).toUpperCase()

  const reasonHtml = cancellationReason
    ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${cancellationReason}</p>`
    : ''

  const subject = job.is_flexible_time
    ? `Booking cancelled — ${service.name}`
    : `Booking cancelled — ${service.name} on ${dateStr}`

  const labelStyle = 'margin:0 0 2px;color:#8a8275;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;'
  const valueStyle = 'margin:0;color:#1a1a1a;font-size:14px;'
  const cellStyle = 'padding:14px 16px;border-bottom:1px solid #ebe5d9;'

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your booking has been cancelled. We're sorry for any inconvenience.
    </p>
    ${reasonHtml}
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;border-radius:8px;border:1px solid #ebe5d9;overflow:hidden;margin-bottom:24px;">
      <tr><td style="${cellStyle}">
        <p style="${labelStyle}">Booking reference</p>
        <p style="${valueStyle}font-family:monospace;">#${ref}</p>
      </td></tr>
      <tr><td style="${cellStyle}">
        <p style="${labelStyle}">Service</p>
        <p style="${valueStyle}">${service.name}</p>
      </td></tr>
      <tr><td style="${cellStyle}">
        <p style="${labelStyle}">Was scheduled</p>
        <p style="${valueStyle}">${dateStr}</p>
      </td></tr>
      <tr><td style="padding:14px 16px;">
        <p style="${labelStyle}">Address</p>
        <p style="${valueStyle}">${formatAddr(address)}</p>
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
  const dateStr = formatBusinessDateTime(job.scheduled_at, business.timezone, 'EEEE, d MMMM yyyy')
  const timeStr = job.is_flexible_time
    ? "Flexible — we'll text you 1 hour before"
    : formatBusinessDateTime(job.scheduled_at, business.timezone, 'h:mm a')

  const subject = `Reminder: ${service.name} is tomorrow`

  const html = wrapEmail(business, `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      This is a friendly reminder that your service is scheduled for <strong>tomorrow</strong>. We look forward to seeing you!
    </p>
    ${bookingSummaryTable(job, service, address, business)}
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:${color};font-size:14px;line-height:1.6;">
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
    `Time: ${timeStr}`,
    `Address: ${formatAddr(address)}`,
    `Total: ${formatMoney(job.total_price, business.currency)}`,
    '',
    'Please ensure someone is home and the property is accessible.',
    '',
    'Need to reschedule? Reply to this email.',
    '',
    `— ${business.name}`,
  ].join('\n')

  return { subject, html, text }
}
