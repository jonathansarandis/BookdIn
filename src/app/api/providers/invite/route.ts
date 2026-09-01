// @ts-nocheck
// src/app/api/providers/invite/route.ts
// Returns a provider's persistent portal link (generating one if they don't
// have one yet) so the admin can copy/share it directly. No Supabase Auth
// involved — see src/lib/providerPortal.ts for the full reasoning: the old
// invite/magiclink + password flow forced subcontractors to recreate their
// password on every re-sent link, on top of the link itself expiring on
// Supabase's ~1hr OTP TTL. The portal_token link has no expiry and needs no
// password — click it once, stay logged in.
//
// Auth accepts EITHER a cookie session (web admin UI) OR a Bearer token
// (mobile app).
//
// Optional `channel` ('email' | 'sms' | 'both', default 'email') sends the
// portal link via the business's configured Dialpad SMS. 'email' here just
// means "no SMS" — there's no Supabase invite email anymore, so the admin UI
// copies the link to the clipboard for the admin to paste wherever they like.
//
// Optional `regenerate: true` invalidates the OLD link and issues a brand new
// one — for when a provider's link has leaked or they've left the business.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendDialpadSmsRaw } from '@/lib/sms/dialpad'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Cookie session first (web admin UI); fall back to a Bearer token (mobile app).
  const cookieClient = createClient()
  let { data: { user } } = await cookieClient.auth.getUser()

  if (!user) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token) {
      const { data: { user: tokenUser } } = await serviceClient.auth.getUser(token)
      user = tokenUser
    }
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider_id, channel = 'email', regenerate = false } = await request.json()
  if (!provider_id) return NextResponse.json({ error: 'Missing provider_id' }, { status: 400 })
  if (!['email', 'sms', 'both'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be "email", "sms", or "both"' }, { status: 400 })
  }

  // Verify the caller actually owns this provider's business (cookie path is
  // already RLS-scoped via createClient(), but the bearer/service-role path
  // bypasses RLS, so check explicitly).
  const { data: callerProfile } = await serviceClient
    .from('profiles').select('business_id').eq('id', user.id).single()

  const { data: provider } = await serviceClient
    .from('providers')
    .select('*')
    .eq('id', provider_id)
    .single()

  if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  if (!callerProfile?.business_id || callerProfile.business_id !== provider.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // No Supabase Auth user to create, so — unlike the old flow — an email
  // address genuinely isn't required unless SMS wasn't requested either.
  if (channel === 'email' && !provider.email) {
    return NextResponse.json({ error: 'Provider has no email address — use SMS instead, or add an email' }, { status: 400 })
  }
  if (channel !== 'email' && !provider.phone) {
    return NextResponse.json({ error: 'Provider has no phone number' }, { status: 400 })
  }

  // Build the link from the actual domain the admin is on, not the
  // NEXT_PUBLIC_APP_URL env (which is localhost in this codebase).
  const origin =
    request.headers.get('origin') ||
    (() => { try { return new URL(request.url).origin } catch { return '' } })() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''

  // Reuse the existing token unless this is an explicit regenerate (link
  // leaked, provider left the business, etc.) — mirrors card_setup_token's
  // "reuse if still valid" behaviour, just with no expiry to check at all.
  let portalToken = regenerate ? null : provider.portal_token
  if (!portalToken) {
    portalToken = crypto.randomBytes(32).toString('hex')
    const { error: tokenErr } = await serviceClient
      .from('providers')
      .update({ portal_token: portalToken })
      .eq('id', provider_id)
    if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 })
  }

  const actionLink = `${origin}/provider/portal/${portalToken}`

  if (provider.email) {
    await serviceClient.from('providers').update({ invite_email: provider.email }).eq('id', provider_id)
  }

  // Optional SMS delivery of the same link.
  let smsResult: { attempted: boolean; sent: boolean; error?: string } = { attempted: false, sent: false }
  if (channel === 'sms' || channel === 'both') {
    smsResult.attempted = true
    const { data: business } = await serviceClient
      .from('businesses')
      .select('name, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_enabled')
      .eq('id', provider.business_id).single()

    if (business) {
      const [first] = (provider.display_name || '').trim().split(/\s+/)
      const result = await sendDialpadSmsRaw({
        business: {
          sms_provider: business.sms_provider,
          sms_api_key_encrypted: business.sms_api_key_encrypted,
          sms_api_key_iv: business.sms_api_key_iv,
          sms_user_id: business.sms_user_id,
          sms_template: null,
          sms_enabled: business.sms_enabled,
        },
        toPhone: provider.phone,
        text: `Hi ${first || 'there'}! Here's your BookdIn provider portal link — bookmark it, no password needed and it never expires: ${actionLink}`,
        businessName: business.name,
      })
      smsResult.sent = result.status === 'sent'
      if (result.status !== 'sent') smsResult.error = result.error
    } else {
      smsResult.error = 'Business not found'
    }
  }

  if (channel === 'sms' && !smsResult.sent) {
    return NextResponse.json({ error: smsResult.error || 'SMS send failed' }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    link: actionLink,
    channel,
    regenerated: regenerate,
    sms: smsResult,
    message: channel === 'sms'
      ? `Portal link sent to ${provider.phone}`
      : channel === 'both'
      ? `Portal link sent to ${provider.phone}${smsResult.sent ? '' : ' (SMS failed — link still generated below)'}`
      : `Portal link ready — copy and send it to ${provider.display_name || 'the provider'}`,
  })
}
