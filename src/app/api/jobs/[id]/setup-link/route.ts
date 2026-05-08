// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

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

  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, business_id, card_setup_token, card_setup_token_expires_at, stripe_payment_method_id')
    .eq('id', params.id)
    .single()
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let token = job.card_setup_token
  let expiresAt = job.card_setup_token_expires_at

  const now = new Date()
  const expired = !expiresAt || new Date(expiresAt) < now
  if (!token || expired) {
    token = crypto.randomBytes(32).toString('hex')
    expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: upd } = await supabase
      .from('jobs')
      .update({ card_setup_token: token, card_setup_token_expires_at: expiresAt })
      .eq('id', job.id)
    if (upd) return NextResponse.json({ error: upd.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return NextResponse.json({
    url: `${appUrl}/secure-card/${token}`,
    token,
    expiresAt,
  })
}
