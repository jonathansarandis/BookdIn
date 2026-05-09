// @ts-nocheck
// POST /api/secure-card/save  { token, paymentMethodId }
// create-intent already wrote stripe_customer_id to the job.
// This endpoint just persists the confirmed payment method and consumes the token.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  let token: string
  let paymentMethodId: string

  try {
    const body = await request.json()
    token = body.token
    paymentMethodId = body.paymentMethodId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token || !paymentMethodId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Re-validate token (expired check + not-yet-saved guard)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, card_setup_token_expires_at')
    .eq('card_setup_token', token)
    .is('stripe_payment_method_id', null)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  if (job.card_setup_token_expires_at && new Date(job.card_setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  // stripe_customer_id is already on the job (set by create-intent).
  // Just record the confirmed payment method and consume the token.
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      payment_status: 'card_on_file',
      card_setup_token: null,
      card_setup_token_expires_at: null,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[secure-card/save] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to record card — please contact support' }, { status: 500 })
  }

  console.log(`[secure-card/save] Card saved for job ${job.id}`)
  return NextResponse.json({ success: true })
}
