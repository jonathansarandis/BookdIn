// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@bookdin.co',
      password: 'BookdInDemo2026!',
    })

    if (error || !data.session) {
      return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
    }

    const response = NextResponse.redirect(
      new URL('/dashboard?demo=true', process.env.NEXT_PUBLIC_APP_URL || 'https://bookdin.co')
    )

    // Set the session cookies
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour demo session
      path: '/',
    })
    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    return NextResponse.json({ error: 'Demo unavailable' }, { status: 500 })
  }
}
