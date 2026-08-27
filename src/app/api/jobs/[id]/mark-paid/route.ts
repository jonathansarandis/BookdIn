// @ts-nocheck
// POST /api/jobs/[id]/mark-paid  { method?: 'cash' | 'bank_transfer' | 'other' }
//
// For payments collected outside Stripe entirely — cash handed to the
// cleaner, a bank transfer, an invoice settled elsewhere, etc. Sets
// payment_status='paid' directly. Never touches Stripe, never charges or
// releases a card — this is purely a bookkeeping record of an offline
// payment, requested because staff had no way to close out a booking's
// payment status when the customer didn't pay through the app.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  if (!profile?.business_id) {
    return NextResponse.json({ error: 'No business' }, { status: 403 })
  }

  let method: string = 'other'
  try {
    const body = await req.json()
    if (body?.method && ['cash', 'bank_transfer', 'other'].includes(body.method)) {
      method = body.method
    }
  } catch {
    // no body — default to 'other'
  }

  const admin = createAdminClient()

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, business_id, payment_status')
    .eq('id', params.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (job.payment_status === 'paid') {
    return NextResponse.json({ success: true, alreadyPaid: true })
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: method,
    })
    .eq('id', params.id)

  if (updateError) {
    console.error('[mark-paid] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }

  await admin.from('activity_logs').insert({
    business_id: job.business_id,
    event_type: 'booking_marked_paid_manually',
    description: `Marked as paid manually (${method})`,
    entity_type: 'job',
    entity_id: params.id,
  })

  console.log(`[mark-paid] Job ${params.id} marked paid manually (${method})`)
  return NextResponse.json({ success: true })
}
