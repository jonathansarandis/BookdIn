// @ts-nocheck
// src/app/api/quotes/[id]/[action]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  const { data: quote } = await serviceClient
    .from('quotes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!quote || quote.business_id !== profile?.business_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  switch (params.action) {
    case 'send': {
      if (quote.status !== 'draft') {
        return NextResponse.json({ error: 'Quote is not a draft' }, { status: 400 })
      }
      await serviceClient
        .from('quotes')
        .update({ status: 'sent', sent_at: now })
        .eq('id', params.id)
      return NextResponse.json({ success: true })
    }

    case 'accept': {
      if (!['sent', 'viewed'].includes(quote.status)) {
        return NextResponse.json({ error: 'Quote cannot be accepted' }, { status: 400 })
      }
      await serviceClient
        .from('quotes')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', params.id)
      return NextResponse.json({ success: true })
    }

    case 'decline': {
      if (!['sent', 'viewed'].includes(quote.status)) {
        return NextResponse.json({ error: 'Quote cannot be declined' }, { status: 400 })
      }
      await serviceClient
        .from('quotes')
        .update({ status: 'declined' })
        .eq('id', params.id)
      return NextResponse.json({ success: true })
    }

    case 'convert': {
      if (quote.status !== 'accepted') {
        return NextResponse.json({ error: 'Only accepted quotes can be converted' }, { status: 400 })
      }

      // Create invoice from quote
      const { data: invoice, error: invoiceError } = await serviceClient
        .from('invoices')
        .insert({
          business_id: quote.business_id,
          customer_id: quote.customer_id,
          status: 'draft',
          subtotal: quote.subtotal,
          tax_amount: quote.tax_amount,
          total: quote.total,
          notes: quote.notes,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        })
        .select('id')
        .single()

      if (invoiceError || !invoice) {
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
      }

      // Mark quote as invoiced
      await serviceClient
        .from('quotes')
        .update({ status: 'invoiced' })
        .eq('id', params.id)

      return NextResponse.json({ success: true, invoice_id: invoice.id })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
