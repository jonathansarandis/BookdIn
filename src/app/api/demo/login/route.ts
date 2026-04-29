// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@bookdin.co',
      password: 'BookdInDemo2026!',
    })

    if (error || !data.session) {
      console.error('Demo login error:', error)
      return NextResponse.json({ error: 'Demo login failed', details: error?.message }, { status: 500 })
    }

    const requestUrl = new URL(request.url)
    const origin = requestUrl.origin

    return NextResponse.redirect(`${origin}/dashboard?demo=true`)

  } catch (err: any) {
    console.error('Demo login exception:', err)
    return NextResponse.json({ error: 'Demo unavailable', details: err.message }, { status: 500 })
  }
}
