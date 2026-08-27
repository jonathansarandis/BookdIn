// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcTaxSplit } from '@/lib/pricing'

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let name: string
  let price_cents: number
  try {
    const body = await req.json()
    name = body.name
    price_cents = body.price_cents
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!Number.isInteger(price_cents) || price_cents <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, business_id, total_price, tax_amount, business:businesses(tax_rate)')
    .eq('id', params.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: insertError } = await supabase.from('job_extras').insert({
    job_id: job.id,
    extra_id: null,
    name: name.trim(),
    price: price_cents,
  })

  if (insertError) {
    console.error('[extras] insert failed:', insertError.message)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }

  // price_cents is the GST-inclusive amount added to the customer's total (matching
  // how it's displayed — a line item within the already-GST-inclusive Total). Without
  // splitting out its GST portion here, tax_amount goes stale relative to total_price,
  // which silently inflates "ex-GST" revenue and subcontractor payout everywhere
  // getExGstAmount() is used (profit report, payroll) by the item's full amount.
  const taxRate = job.business?.tax_rate ?? 10
  const itemTaxSplit = calcTaxSplit(price_cents, 'inclusive', taxRate)

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      total_price: job.total_price + price_cents,
      tax_amount: (job.tax_amount ?? 0) + itemTaxSplit.tax,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[extras] total_price update failed:', updateError.message)
    return NextResponse.json({ error: 'Item added but total update failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
