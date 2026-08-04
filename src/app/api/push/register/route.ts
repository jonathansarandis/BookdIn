// @ts-nocheck
// src/app/api/push/register/route.ts
// Called by both mobile apps right after login (and again whenever the
// Expo push token rotates). Auth accepts a cookie session OR a Bearer
// token — same dual-auth pattern as /api/providers/accept and
// /api/providers/invite, since neither mobile app has cookies.
//
// Writes to whichever of providers/profiles the caller actually has a row
// in — providers for the provider (cleaner) app, profiles for the owner
// app. A caller isn't expected to have both.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

  const { push_token } = await request.json()
  if (!push_token || typeof push_token !== 'string') {
    return NextResponse.json({ error: 'Missing push_token' }, { status: 400 })
  }

  const { data: provider } = await serviceClient
    .from('providers').select('id').eq('user_id', user.id).maybeSingle()
  if (provider) {
    await serviceClient.from('providers').update({ push_token }).eq('id', provider.id)
    return NextResponse.json({ success: true, target: 'provider' })
  }

  const { data: profile } = await serviceClient
    .from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (profile) {
    await serviceClient.from('profiles').update({ push_token }).eq('id', profile.id)
    return NextResponse.json({ success: true, target: 'profile' })
  }

  return NextResponse.json({ error: 'No provider or profile found for this user' }, { status: 404 })
}
