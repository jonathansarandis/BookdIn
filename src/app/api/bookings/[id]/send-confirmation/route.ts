import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resendBookingConfirmation } from '@/lib/email/resend'

// @supabase/ssr v0.5 column-select generics return `never` for columns outside
// the generated snapshot. We cast each query result explicitly rather than using
// @ts-nocheck — this is the correct escape hatch for this Supabase version.

interface ProfileCheck {
  business_id: string | null
}

interface JobAuthCheck {
  business_id: string
}

export async function POST(
  _: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient()

  // 1. Require authenticated session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get caller's business_id
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as ProfileCheck | null

  // 3. Verify job belongs to caller's business (404 avoids leaking job existence)
  const { data: rawJobCheck } = await supabase
    .from('jobs')
    .select('business_id')
    .eq('id', params.id)
    .single()
  const jobCheck = rawJobCheck as unknown as JobAuthCheck | null

  if (!jobCheck || jobCheck.business_id !== profile?.business_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Intentionally NOT idempotent-guarded — this is the "Resend confirmation
  // email" action on the job page (and is also triggered automatically by the
  // price-override route), so re-sending on demand is the whole point.
  const result = await resendBookingConfirmation(params.id, jobCheck.business_id)

  return NextResponse.json(result)
}
