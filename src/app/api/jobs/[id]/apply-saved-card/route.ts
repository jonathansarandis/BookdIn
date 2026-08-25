// @ts-nocheck
// POST /api/jobs/[id]/apply-saved-card
//
// Attaches a customer's already-on-file card (customer_payment_methods) to
// a specific job. Useful when a customer has a verified saved card from one
// booking but a different booking of theirs is still unpaid/no-card — e.g.
// after the legacy card-setup bug (see reconcile-card-setup) left some
// bookings with no recoverable Stripe record at all, even though the same
// customer has a valid card on file from another booking.
//
// Scoped tightly to avoid touching any other job or customer's data:
//   - only looks at THIS job (business-ownership checked)
//   - no-ops immediately if a card is already on file for this job — never
//     overwrites an existing saved card
//   - only ever uses the payment method already on file for THIS job's own
//     customer, never any other customer's card
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
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

  const admin = createAdminClient()

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, business_id, stripe_payment_method_id, customer_id')
    .eq('id', params.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Already has a card on file — never overwrite.
  if (job.stripe_payment_method_id) {
    return NextResponse.json({ applied: false, reason: 'already_saved' })
  }

  if (!job.customer_id) {
    return NextResponse.json({ applied: false, reason: 'no_customer_on_job' })
  }

  const { data: cpm } = await admin
    .from('customer_payment_methods')
    .select('stripe_payment_method_id, card_brand, card_last4')
    .eq('customer_id', job.customer_id)
    .eq('business_id', job.business_id)
    .single()

  if (!cpm?.stripe_payment_method_id) {
    return NextResponse.json({ applied: false, reason: 'no_saved_card_for_customer' })
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({
      stripe_payment_method_id: cpm.stripe_payment_method_id,
      payment_status: 'card_on_file',
      card_setup_token: null,
      card_setup_token_expires_at: null,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[apply-saved-card] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
  }

  console.log(`[apply-saved-card] Applied saved card to job ${job.id}`)

  return NextResponse.json({
    applied: true,
    paymentMethodId: cpm.stripe_payment_method_id,
    cardBrand: cpm.card_brand,
    cardLast4: cpm.card_last4,
  })
}
