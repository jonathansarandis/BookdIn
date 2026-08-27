// @ts-nocheck
// POST /api/jobs/[id]/attach-saved-card  { paymentMethodId }
//
// Records a customer's already-saved card against a job WITHOUT authorizing it —
// mirrors what /api/secure-card/save does for a fresh card-on-file link. This exists
// because the admin booking form's "use saved card" option was calling
// /api/stripe/intent directly, which creates+confirms a manual-capture PaymentIntent
// immediately (a real Stripe hold) the instant the job is created, regardless of how
// far away the service date is. That's the bug: rebooking a customer for a date weeks
// out was pre-authorizing their card that same second. The correct behaviour (used
// everywhere else in the app) is: record the card, set payment_status='card_on_file',
// and let the nightly cron (/api/cron/capture-payments) authorize it the day before
// the job, or let staff hit "Pre-authorize" manually for same-day bookings.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile?.business_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentMethodId } = await req.json().catch(() => ({}))
  if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, business_id, customer_id, scheduled_at, customer:customers(stripe_customer_id), business:businesses(timezone, stripe_account_id)')
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  let stripeCustomerId = job.customer?.stripe_customer_id

  if (!stripeCustomerId) {
    // Self-heal instead of dead-ending: paymentMethodId here is an existing,
    // already-verified card (selected from "use saved card"), so find the
    // Stripe Customer it's attached to — or, if it was never attached to one
    // (a known gap in one of the older save paths), create one now and
    // attach it — rather than telling staff to use "New card" for a
    // customer who plainly already has a card on file.
    const stripeOpts = job.business?.stripe_account_id ? { stripeAccount: job.business.stripe_account_id } : {}
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId, stripeOpts)
      stripeCustomerId = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id

      if (!stripeCustomerId) {
        const newCustomer = await stripe.customers.create({}, stripeOpts)
        await stripe.paymentMethods.attach(paymentMethodId, { customer: newCustomer.id }, stripeOpts)
        stripeCustomerId = newCustomer.id
      }

      if (job.customer_id) {
        await admin.from('customers').update({ stripe_customer_id: stripeCustomerId }).eq('id', job.customer_id)
      }
    } catch (err: any) {
      console.error('[attach-saved-card] Self-heal Stripe customer link failed:', err.message)
      return NextResponse.json({ error: 'This customer has no Stripe customer record yet — use "New card" instead.' }, { status: 409 })
    }
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: stripeCustomerId,
      payment_status: 'card_on_file',
      payment_method: 'card',
    })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Cron only authorizes jobs scheduled for "tomorrow" — a same-day booking needs a
  // human to hit Pre-authorize manually, so flag it the same way secure-card/save does.
  try {
    const jobTz = job.business?.timezone || 'Australia/Melbourne'
    const jobDate = new Intl.DateTimeFormat('en-AU', { timeZone: jobTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(job.scheduled_at))
    const today = new Intl.DateTimeFormat('en-AU', { timeZone: jobTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    if (jobDate === today) {
      const { data: staff } = await admin.from('profiles').select('id').eq('business_id', job.business_id)
      if (staff?.length) {
        await admin.from('notifications').insert(staff.map((s: any) => ({
          business_id: job.business_id,
          user_id: s.id,
          type: 'same_day_auth_required',
          title: 'Same-day auth required',
          body: `Card on file for today's booking — authorize manually before service.`,
          entity_type: 'job',
          entity_id: job.id,
          action_url: `/jobs/${job.id}`,
        })))
      }
    }
  } catch (e) {
    console.error('[attach-saved-card] same-day notification failed (non-blocking):', e)
  }

  return NextResponse.json({ success: true })
}
