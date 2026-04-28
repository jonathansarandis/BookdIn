// @ts-nocheck
// src/app/api/providers/invite/route.ts
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

  // Get provider details
  const { data: provider } = await serviceClient
    .from('providers')
    .select('*')
    .eq('id', provider_id)
    .single()

  if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  if (!provider.email) return NextResponse.json({ error: 'Provider has no email address' }, { status: 400 })

  // Invite the provider via Supabase Auth
  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    provider.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bookd-in.vercel.app'}/provider/accept`,
      data: {
        provider_id: provider.id,
        display_name: provider.display_name,
        is_provider: true,
      }
    }
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Update provider with invite info
  await serviceClient
    .from('providers')
    .update({ invite_email: provider.email })
    .eq('id', provider_id)

  return NextResponse.json({ success: true, message: `Invite sent to ${provider.email}` })
}
