// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify token — works regardless of cookie state (invite flow uses implicit/hash session)
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let provider_id: string
  try {
    const body = await req.json()
    provider_id = body.provider_id
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!provider_id) return NextResponse.json({ error: 'provider_id required' }, { status: 400 })

  // provider_id must match what was embedded in the invite by the server at invite time
  const expectedProviderId = user.user_metadata?.provider_id
  if (!expectedProviderId || expectedProviderId !== provider_id) {
    return NextResponse.json({ error: 'Provider mismatch' }, { status: 403 })
  }

  const { data: provider, error: provErr } = await admin
    .from('providers')
    .select('id, user_id')
    .eq('id', provider_id)
    .single()

  if (provErr || !provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  // Idempotent: already linked to this user
  if (provider.user_id === user.id) return NextResponse.json({ success: true })

  // Linked to a different user — reject
  if (provider.user_id && provider.user_id !== user.id) {
    return NextResponse.json({ error: 'Provider already linked to another account' }, { status: 409 })
  }

  // Write user_id only when currently null — double safety
  const { error: updateError } = await admin
    .from('providers')
    .update({ user_id: user.id, invite_accepted_at: new Date().toISOString() })
    .eq('id', provider_id)
    .is('user_id', null)

  if (updateError) {
    console.error(`[provider-accept] DB update failed for provider ${provider_id}:`, updateError.message)
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
  }

  console.log(`[provider-accept] Linked provider ${provider_id} → user ${user.id}`)
  return NextResponse.json({ success: true })
}
