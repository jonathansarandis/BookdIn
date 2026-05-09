// @ts-nocheck
// POST /api/secure-card/save  { token, paymentMethodId, stripeCustomerId }
// SetupIntent has already attached the PM to the customer — just persist to DB.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  let token: string
  let paymentMethodId: string
  let stripeCustomerId: string

  try {
    const body = await request.json()
    token = body.token
    paymentMethodId = body.paymentMethodId
    stripeCustomerId = body.stripeCustomerId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token || !paymentMethodId || !stripeCustomerId) {
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

  // Stripe already attached the PM to the customer via SetupIntent confirmation.
  // Persist the result to the database and consume the token.
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: stripeCustomerId,
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
