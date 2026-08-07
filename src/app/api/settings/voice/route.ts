// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    business_id,
    voice_enabled,
    voice_phone_number,
    voice_agent_name,
    voice_agent_personality,
    voice_provider,
    voice_id,
  } = body

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile || profile.business_id !== business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, any> = {
    voice_enabled: !!voice_enabled,
    voice_phone_number: voice_phone_number || null,
    voice_agent_name: voice_agent_name || 'Aria',
    voice_agent_personality: voice_agent_personality || null,
    voice_provider: voice_provider || 'elevenlabs',
    voice_id: voice_id || 'XB0fDUnXU5powFXDhCwa',
  }

  const { error } = await supabase.from('businesses').update(updates).eq('id', business_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
