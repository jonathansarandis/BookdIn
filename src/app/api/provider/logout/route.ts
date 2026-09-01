// @ts-nocheck
// POST /api/provider/logout
// Clears the persistent portal cookie (and any legacy Supabase Auth session)
// for a shared-device sign-out. Not required for normal use — the whole
// point of the portal link is that a subcontractor never has to sign back in
// — but a cleaner sharing a tablet/phone with a teammate still needs a way
// to get the previous person's session off the device.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PORTAL_COOKIE } from '@/lib/providerPortal'

export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut().catch(() => {})

  const response = NextResponse.json({ success: true })
  response.cookies.set(PORTAL_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
