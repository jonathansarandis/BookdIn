// @ts-nocheck
// src/app/api/invoices/[id]/email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInvoicePdf } from '@/lib/invoices/pdf'
import { fetchInvoiceForPdf } from '@/lib/invoices/fetchInvoiceData'
import { formatCurrency } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  if (!profile?.business_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const result = await fetchInvoiceForPdf(admin, params.id, profile.business_id)
  if (!result) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { invoice, pdfData } = result
  if (!invoice.customer?.email) {
    return NextResponse.json({ error: 'Customer has no email on file' }, { status: 400 })
  }

  const pdfBuffer = await generateInvoicePdf(pdfData)

  const { error } = await resend.emails.send({
    from: 'BookdIn <hello@bookdin.co>',
    to: invoice.customer.email,
    reply_to: pdfData.business.email || undefined,
    subject: `Invoice ${pdfData.invoiceNumber} from ${pdfData.business.name}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
        <p>Hi ${pdfData.customer.fullName.split(' ')[0]},</p>
        <p>Please find attached invoice <strong>${pdfData.invoiceNumber}</strong> from ${pdfData.business.name} for <strong>${formatCurrency(pdfData.totalCents, pdfData.business.currency || 'AUD')}</strong>.</p>
        ${pdfData.dueDate ? `<p>Payment is due by ${new Date(pdfData.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : ''}
        <p>Questions? Simply reply to this email.</p>
        <p>— ${pdfData.business.name}</p>
      </div>`,
    text: `Hi ${pdfData.customer.fullName.split(' ')[0]},\n\nPlease find attached invoice ${pdfData.invoiceNumber} from ${pdfData.business.name} for ${formatCurrency(pdfData.totalCents, pdfData.business.currency || 'AUD')}.\n\n— ${pdfData.business.name}`,
    attachments: [
      { filename: `${pdfData.invoiceNumber}.pdf`, content: pdfBuffer },
    ],
  })

  if (error) {
    console.error('[invoice email] send failed:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }

  // Draft invoices move to "sent" once the customer has actually been emailed
  if (invoice.status === 'draft') {
    await admin.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', params.id)
  }

  return NextResponse.json({ success: true })
}
