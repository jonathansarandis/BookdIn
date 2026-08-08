import PDFDocument from 'pdfkit'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export interface InvoicePdfLineItem {
  description: string
  amountCents: number   // ex-tax
}

export interface InvoicePdfData {
  invoiceNumber: string
  status: string
  createdAt: string
  dueDate?: string | null
  business: {
    name: string
    logoUrl?: string | null
    businessNumber?: string | null
    businessNumberLabel?: string | null
    streetAddress?: string | null
    suburb?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
    email?: string | null
    phone?: string | null
    currency?: string | null
  }
  customer: {
    fullName: string
    email?: string | null
    phone?: string | null
  }
  customerAddress?: { line1: string; city: string; state: string; postcode: string } | null
  serviceDate?: string | null
  serviceName?: string | null
  lineItems: InvoicePdfLineItem[]
  subtotalCents: number
  taxCents: number
  taxLabel: string
  totalCents: number
  notes?: string | null
}

const INK = '#1a1a1a'
const MUTED = '#6b7280'
const RULE = '#e5e7eb'
const PAGE_MARGIN = 50

async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    // pdfkit only embeds JPEG/PNG — skip anything else (e.g. SVG logos) rather than error
    if (!/\.(png|jpe?g)(\?.*)?$/i.test(url)) return null
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const currency = data.business.currency || 'AUD'
  const money = (cents: number) => formatCurrency(cents, currency)

  const logoBuffer = data.business.logoUrl ? await fetchLogoBuffer(data.business.logoUrl) : null

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const pageWidth = doc.page.width - PAGE_MARGIN * 2

  // ── Header: logo/business (left) + invoice meta (right) ──────────────────
  const headerTop = doc.y
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE_MARGIN, headerTop, { fit: [140, 50] })
    } catch {
      // corrupt/unsupported image data — fall through without a logo
    }
  }
  const businessTextX = PAGE_MARGIN
  const businessTextY = logoBuffer ? headerTop + 56 : headerTop
  doc.fontSize(14).fillColor(INK).font('Helvetica-Bold').text(data.business.name, businessTextX, businessTextY)
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
  if (data.business.businessNumber) {
    doc.text(`${data.business.businessNumberLabel || 'ABN'}: ${data.business.businessNumber}`)
  }
  const addrLine = [data.business.streetAddress, [data.business.suburb, data.business.state, data.business.postcode].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')
  if (addrLine) doc.text(addrLine)
  if (data.business.email) doc.text(data.business.email)
  if (data.business.phone) doc.text(data.business.phone)

  doc.fontSize(20).fillColor(INK).font('Helvetica-Bold').text('INVOICE', PAGE_MARGIN, headerTop, { width: pageWidth, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(data.invoiceNumber, { width: pageWidth, align: 'right' })
    .text(`Issued ${formatDateShort(data.createdAt)}`, { width: pageWidth, align: 'right' })
  if (data.dueDate) doc.text(`Due ${formatDateShort(data.dueDate)}`, { width: pageWidth, align: 'right' })
  doc.font('Helvetica-Bold').fillColor(INK)
    .text(data.status.toUpperCase(), { width: pageWidth, align: 'right' })

  doc.moveDown(2)
  doc.y = Math.max(doc.y, businessTextY + 90)

  // ── Bill to ────────────────────────────────────────────────────────────
  const billToY = doc.y
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('BILL TO', PAGE_MARGIN, billToY)
  doc.font('Helvetica').fontSize(11).fillColor(INK).text(data.customer.fullName, PAGE_MARGIN, billToY + 14)
  doc.fontSize(9).fillColor(MUTED)
  if (data.customerAddress) {
    doc.text(data.customerAddress.line1)
    doc.text(`${data.customerAddress.city} ${data.customerAddress.state} ${data.customerAddress.postcode}`)
  }
  if (data.customer.email) doc.text(data.customer.email)
  if (data.customer.phone) doc.text(data.customer.phone)

  if (data.serviceName || data.serviceDate) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('SERVICE', PAGE_MARGIN + 300, billToY, { width: pageWidth - 300 })
    doc.font('Helvetica').fontSize(11).fillColor(INK).text(data.serviceName || '—', PAGE_MARGIN + 300, billToY + 14, { width: pageWidth - 300 })
    if (data.serviceDate) {
      doc.fontSize(9).fillColor(MUTED).text(formatDateShort(data.serviceDate), PAGE_MARGIN + 300, doc.y, { width: pageWidth - 300 })
    }
  }

  doc.moveDown(3)

  // ── Line items table ──────────────────────────────────────────────────
  const tableTop = doc.y + 10
  const descX = PAGE_MARGIN
  const amountColWidth = 100
  const amountX = PAGE_MARGIN + pageWidth - amountColWidth

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  doc.text('DESCRIPTION', descX, tableTop)
  doc.text('AMOUNT (EX-GST)', amountX, tableTop, { width: amountColWidth, align: 'right' })
  doc.moveTo(PAGE_MARGIN, tableTop + 16).lineTo(PAGE_MARGIN + pageWidth, tableTop + 16).strokeColor(RULE).stroke()

  let rowY = tableTop + 24
  doc.font('Helvetica').fontSize(10).fillColor(INK)
  for (const item of data.lineItems) {
    doc.text(item.description, descX, rowY, { width: pageWidth - amountColWidth - 20 })
    doc.text(money(item.amountCents), amountX, rowY, { width: amountColWidth, align: 'right' })
    rowY = doc.y + 10
  }

  doc.moveTo(PAGE_MARGIN, rowY).lineTo(PAGE_MARGIN + pageWidth, rowY).strokeColor(RULE).stroke()
  rowY += 12

  const totalsX = PAGE_MARGIN + pageWidth - 220
  const totalsLabelWidth = 120
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
  doc.text('Subtotal (ex-GST)', totalsX, rowY, { width: totalsLabelWidth })
  doc.fillColor(INK).text(money(data.subtotalCents), totalsX + totalsLabelWidth, rowY, { width: 100, align: 'right' })
  rowY = doc.y + 6

  doc.fillColor(MUTED).text(data.taxLabel, totalsX, rowY, { width: totalsLabelWidth })
  doc.fillColor(INK).text(money(data.taxCents), totalsX + totalsLabelWidth, rowY, { width: 100, align: 'right' })
  rowY = doc.y + 8

  doc.moveTo(totalsX, rowY).lineTo(PAGE_MARGIN + pageWidth, rowY).strokeColor(RULE).stroke()
  rowY += 8

  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK)
  doc.text('Total (inc-GST)', totalsX, rowY, { width: totalsLabelWidth })
  doc.text(money(data.totalCents), totalsX + totalsLabelWidth, rowY, { width: 100, align: 'right' })
  rowY = doc.y + 30

  if (data.notes) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('NOTES', PAGE_MARGIN, rowY)
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(data.notes, PAGE_MARGIN, rowY + 14, { width: pageWidth })
  }

  doc.end()
  return done
}
