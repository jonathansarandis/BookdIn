// @ts-nocheck
// src/app/api/invoices/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInvoicePdf } from '@/lib/invoices/pdf'
import { fetchInvoiceForPdf } from '@/lib/invoices/fetchInvoiceData'

export async function GET(
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

  const pdfBuffer = await generateInvoicePdf(result.pdfData)

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.pdfData.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
