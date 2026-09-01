// @ts-nocheck
// GET /provider/portal/[token]
//
// The ENTIRE provider login flow. No email, no password, no Supabase Auth —
// this is the one persistent link a subcontractor is given (see
// src/lib/providerPortal.ts for why). Visiting it looks the token up
// directly against providers.portal_token and, if it matches, sets a
// long-lived cookie and drops them straight into their dashboard. No expiry:
// the link keeps working until an admin explicitly regenerates it (e.g. if
// it leaked), at which point this lookup simply stops matching.
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PORTAL_COOKIE, PORTAL_COOKIE_MAX_AGE } from '@/lib/providerPortal'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params

  const { data: provider } = await admin
    .from('providers')
    .select('id')
    .eq('portal_token', token)
    .maybeSingle()

  const url = request.nextUrl.clone()
  url.search = ''

  if (!provider) {
    url.pathname = '/provider/link-invalid'
    return NextResponse.redirect(url)
  }

  url.pathname = '/provider/dashboard'
  const response = NextResponse.redirect(url)
  response.cookies.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_COOKIE_MAX_AGE,
  })
  return response
}
