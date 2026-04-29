// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  const origin = new URL(request.url).origin
  const response = NextResponse.redirect(`${origin}/auth/signup`)
  // Clear all Supabase auth cookies
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')
  response.cookies.delete('sb-rpxqiqvvggfuhearxizq-auth-token')
  return response
}
