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
    const extras = invoice.job.job_extras || []
    const extrasTotalCents = extras.reduce((sum: number, e: any) => sum + (e.price || 0) * (e.quantity || 1), 0)
    const serviceAmountCents = invoice.subtotal - extrasTotalCents
    lineItems.push({ description: invoice.job.service?.name || 'Service', amountCents: serviceAmountCents })
    for (const e of extras) {
      lineItems.push({
        description: e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name,
        amountCents: (e.price || 0) * (e.quantity || 1),
      })
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
