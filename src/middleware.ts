// @ts-nocheck
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/reset-password',
    '/auth/reset-verify',
    '/auth/forgot-password',
    '/book',
    '/booking-confirmed',
    '/secure-card',
    '/',
    '/pricing',
    '/features',
    '/about',
    '/api/webhooks',
    '/api/import',
    '/api/demo',
    '/api/demo/logout',
    '/api/bookings/public',
    '/api/secure-card',
    '/api/stripe/webhook',
    '/api/cron',
    '/api/providers/accept',
    '/api/providers/invite',
    '/api/push/register',
    '/api/notify/job-event',
    '/provider/login',
    '/provider/accept',
    '/.well-known',
  ]
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!user && !isPublic) {
    if (pathname.startsWith('/provider')) {
      const url = request.nextUrl.clone()
      url.pathname = '/provider/login'
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  const isDemoUser = user?.email === 'demo@bookdin.co'
  const isAuthPage = pathname === '/auth/login' || pathname === '/auth/signup'

  // Role-aware routing: cleaners (rows in `providers`, no row in `profiles`) share
  // the same auth.users table as admin/staff, so any link that lands them on an
  // admin-facing page — the generic /auth/login page, a stale job/notification
  // link, etc. — must bounce them to their own portal instead of a dead-end admin
  // page. Only resolved when it can actually change the outcome (an /auth/* page,
  // or a protected non-provider page) to avoid a DB round trip on every request.
  // Never applies to /api/* — an API caller expects JSON/status codes, not an
  // HTML redirect, and every API route already does its own auth check. Without
  // this exclusion, "/api/provider/jobs".startsWith('/provider') is false (it
  // starts with "/api/provider", not "/provider"), so a cleaner's own fetch()
  // calls got silently redirected to the dashboard HTML page instead of JSON —
  // res.json() then threw on the HTML body, leaving the schedule empty.
  if (user && !isDemoUser && !pathname.startsWith('/api/') && (isAuthPage || (!isPublic && !pathname.startsWith('/provider')))) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()

    if (profile) {
      if (isAuthPage) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } else {
      // No admin/staff profile. Providers can't read their own `providers` row via
      // the anon/cookie client — get_my_business_id() resolves to NULL for them,
      // so the RLS policy (business_id = get_my_business_id()) never matches —
      // hence the service-role client here.
      const admin = createServiceRoleClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: provider } = await admin.from('providers').select('id').eq('user_id', user.id).maybeSingle()
      if (provider) {
        const url = request.nextUrl.clone()
        url.pathname = '/provider/dashboard'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
