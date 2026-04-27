// @ts-nocheck
// src/app/api/invoices/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  // Verify the invoice belongs to this business
  const { data: invoice } = await serviceClient
    .from('invoices')
    .select('id, status, business_id')
    .eq('id', params.id)
    .single()

  if (!invoice || invoice.business_id !== profile?.business_id) {
    return NextResponse.redirect(new URL('/invoices', request.url))
  }

  if (invoice.status !== 'draft') {
    return NextResponse.redirect(new URL(`/invoices/${params.id}`, request.url))
  }

  await serviceClient
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.redirect(new URL(`/invoices/${params.id}`, request.url))
}
