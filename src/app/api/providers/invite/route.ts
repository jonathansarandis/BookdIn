// @ts-nocheck
// src/app/api/providers/invite/route.ts
// Generates a fresh portal access link for a provider and returns it so the
// admin can copy/share it directly (email delivery still happens if Supabase
// SMTP is configured). Fixes: links no longer point at a stale/localhost URL
// (we use the request origin), and invites can be re-sent any number of times
// (generateLink is repeatable; existing users fall back to a magic link).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider_id } = await request.json()
  if (!provider_id) return NextResponse.json({ error: 'Missing provider_id' }, { status: 400 })

  const { data: provider } = await serviceClient
    .from('providers')
    .select('*')
    .eq('id', provider_id)
    .single()

  if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  if (!provider.email) return NextResponse.json({ error: 'Provider has no email address' }, { status: 400 })

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

  return NextResponse.json({
    success: true,
    link: actionLink,
    mode,
    message: `Portal link ready for ${provider.email}`,
  })
}
