// @ts-nocheck
// src/app/api/providers/invite/route.ts
// Generates a fresh portal access link for a provider and returns it so the
// admin can copy/share it directly (email delivery still happens if Supabase
// SMTP is configured). Fixes: links no longer point at a stale/localhost URL
// (we use the request origin), and invites can be re-sent any number of times
// (generateLink is repeatable; existing users fall back to a magic link).
//
// Auth accepts EITHER a cookie session (web admin UI) OR a Bearer token
// (mobile app — same pattern as /api/providers/accept, which already needed
// this because the invite-accept flow itself uses a bearer-only session).
//
// Optional `channel` ('email' | 'sms' | 'both', default 'email') sends the
// portal link via the business's configured Dialpad SMS in addition to (or
// instead of) Supabase's invite email.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  const { provider_id, channel = 'email' } = await request.json()
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
  if (channel !== 'sms' && !provider.email) {
    return NextResponse.json({ error: 'Provider has no email address' }, { status: 400 })
  }
  if (channel !== 'email' && !provider.phone) {
    return NextResponse.json({ error: 'Provider has no phone number' }, { status: 400 })
  }
  // Supabase invite links require an email even when the primary delivery channel is SMS
  // (the invite creates/identifies the auth user by email).
  if (!provider.email) {
    return NextResponse.json({ error: 'Provider needs an email address — required to create their login even when inviting by SMS' }, { status: 400 })
  }

  // Build the redirect from the actual domain the admin is on, not the
  // NEXT_PUBLIC_APP_URL env (which is localhost in this codebase).
  const origin =
    request.headers.get('origin') ||
    (() => { try { return new URL(request.url).origin } catch { return '' } })() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  const redirectTo = `${origin}/provider/accept`

  const metadata = {
    provider_id: provider.id,
    display_name: provider.display_name,
    is_provider: true,
  }

  // First attempt: an invite link (also creates the auth user if new).
  let actionLink: string | null = null
  let mode: 'invite' | 'magiclink' = 'invite'

  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.generateLink({
    type: 'invite',
    email: provider.email,
    options: { redirectTo, data: metadata },
  })

  if (inviteError) {
    // Most common cause: the user already exists (a re-invite). Fall back to a
    // magic link so the admin can still hand them a working portal link.
    const { data: magicData, error: magicError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: provider.email,
      options: { redirectTo },
    })
    if (magicError) {
      return NextResponse.json({ error: magicError.message }, { status: 500 })
    }
    actionLink = magicData?.properties?.action_link ?? null
    mode = 'magiclink'
  } else {
    actionLink = inviteData?.properties?.action_link ?? null
  }

  await serviceClient
    .from('providers')
    .update({ invite_email: provider.email })
    .eq('id', provider_id)

  // Optional SMS delivery of the same link.
  let smsResult: { attempted: boolean; sent: boolean; error?: string } = { attempted: false, sent: false }
  if ((channel === 'sms' || channel === 'both') && actionLink) {
    smsResult.attempted = true
    const { data: business } = await serviceClient
      .from('businesses')
      .select('name, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_enabled')
      .eq('id', provider.business_id).single()

    if (business) {
      const [first, ...rest] = (provider.display_name || '').trim().split(/\s+/)
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
        text: `Hi ${first || 'there'}! ${business.name || 'Your team'} has set you up on the BookdIn provider app. Tap this link to get started: ${actionLink}`,
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
    mode,
    channel,
    sms: smsResult,
    message: channel === 'sms'
      ? `Invite SMS sent to ${provider.phone}`
      : channel === 'both'
      ? `Invite sent to ${provider.email}${smsResult.sent ? ` and ${provider.phone}` : ' (SMS failed — link still generated below)'}`
      : `Portal link ready for ${provider.email}`,
  })
}
