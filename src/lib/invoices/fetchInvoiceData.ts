import type { InvoicePdfData, InvoicePdfLineItem } from './pdf'

export async function fetchInvoiceForPdf(admin: any, invoiceId: string, businessId: string) {
  const { data: invoice } = await admin
    .from('invoices')
    .select(`
      *,
      customer:customers(full_name, email, phone),
      job:jobs!invoices_job_id_fkey(
        id, scheduled_at,
        service:services(name),
        address:addresses(line1, city, state, postcode),
        job_extras(name, price, quantity)
      )
    `)
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .single()

  if (!invoice) return null

  const { data: business } = await admin
    .from('businesses')
    .select('name, logo_url, business_number, business_number_label, street_address, suburb, state, postcode, country, contact_email, phone, currency, tax_name')
    .eq('id', businessId)
    .single()

  if (!business) return null

  const lineItems: InvoicePdfLineItem[] = []
  if (invoice.job) {
    // Additional charges added after the initial booking (e.g. on the day of service)
    // are stored as separate child jobs linked via parent_job_id, not folded into this
    // job's own price — pull them in as their own line items rather than letting them
    // sit merged into a single combined "service" amount.
    const { data: children } = await admin
      .from('jobs')
      .select('total_price, customer_notes, payment_status')
      .eq('parent_job_id', invoice.job.id)
      .in('payment_status', ['authorized', 'paid'])
    const additionalCharges = (children || []).filter((c: any) => (c.total_price || 0) > 0)
    const additionalChargesTotalCents = additionalCharges.reduce((sum: number, c: any) => sum + (c.total_price || 0), 0)

    const extras = invoice.job.job_extras || []
    const extrasTotalCents = extras.reduce((sum: number, e: any) => sum + (e.price || 0) * (e.quantity || 1), 0)
    const serviceAmountCents = invoice.subtotal - extrasTotalCents - additionalChargesTotalCents
    lineItems.push({ description: invoice.job.service?.name || 'Service', amountCents: serviceAmountCents })
    for (const e of extras) {
      const amountCents = (e.price || 0) * (e.quantity || 1)
      // Skip add-ons that weren't actually charged (e.g. quote-only extras left at $0
      // because they were never priced/confirmed for this job) — only show line items
      // the customer is actually being billed for.
      if (amountCents <= 0) continue
      lineItems.push({
        description: e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name,
        amountCents,
      })
    }
    for (const c of additionalCharges) {
      lineItems.push({ description: c.customer_notes || 'Additional charge', amountCents: c.total_price })
    }
  } else {
    lineItems.push({ description: invoice.notes || 'Services rendered', amountCents: invoice.subtotal })
  }

  const pdfData: InvoicePdfData = {
    invoiceNumber: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
    status: invoice.status,
    createdAt: invoice.created_at,
    dueDate: invoice.due_date,
    business: {
      name: business.name,
      logoUrl: business.logo_url,
      businessNumber: business.business_number,
      businessNumberLabel: business.business_number_label,
      streetAddress: business.street_address,
      suburb: business.suburb,
      state: business.state,
      postcode: business.postcode,
      country: business.country,
      email: business.contact_email,
      phone: business.phone,
      currency: business.currency,
    },
    customer: {
      fullName: invoice.customer?.full_name || 'Customer',
      email: invoice.customer?.email,
      phone: invoice.customer?.phone,
    },
    customerAddress: invoice.job?.address || null,
    serviceDate: invoice.job?.scheduled_at || null,
    serviceName: invoice.job?.service?.name || null,
    lineItems,
    subtotalCents: invoice.subtotal || 0,
    taxCents: invoice.tax_amount || 0,
    taxLabel: invoice.tax_name || business.tax_name || 'GST',
    totalCents: invoice.total || 0,
    notes: invoice.notes,
  }

  return { invoice, pdfData }
}
