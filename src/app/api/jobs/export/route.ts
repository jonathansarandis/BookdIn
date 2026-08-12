import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const location = searchParams.get('location')
  const filter = searchParams.get('filter')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const q = searchParams.get('q')?.trim().toLowerCase()

  let query = supabase
    .from('jobs')
    .select('id, scheduled_at, status, payment_status, price_override, total_price, price, customer:customers(full_name, email, phone), service:services(name), provider:providers(display_name), address:addresses(line1, city), location:locations(name)')
    .eq('business_id', profile.business_id)
    .order('scheduled_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (location) query = query.eq('location_id', location)

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString()

  if (from || to) {
    if (from) query = query.gte('scheduled_at', new Date(from).toISOString())
    if (to) {
      const toEnd = new Date(to)
      toEnd.setDate(toEnd.getDate() + 1)
      query = query.lt('scheduled_at', toEnd.toISOString())
    }
  } else if (filter === 'today') {
    query = query.gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd)
  } else if (filter === 'upcoming') {
    query = query.gte('scheduled_at', todayStart).lte('scheduled_at', weekEnd)
  } else if (filter === 'unassigned') {
    query = query.is('provider_id', null).not('status', 'in', '("completed","cancelled")')
  }

  let { data: jobs } = await query.limit(1000)
  jobs = jobs || []

  if (q) {
    jobs = jobs.filter((job: any) =>
      job.customer?.full_name?.toLowerCase().includes(q) ||
      job.address?.line1?.toLowerCase().includes(q) ||
      job.address?.city?.toLowerCase().includes(q) ||
      job.id?.toLowerCase().includes(q)
    )
  }

  const headers = ['Booking ID', 'Date', 'Customer', 'Email', 'Phone', 'Service', 'Location', 'Address', 'Provider', 'Price (AUD)', 'Payment status', 'Status']
  const rows = jobs.map((job: any) => [
    job.id,
    job.scheduled_at ? new Date(job.scheduled_at).toISOString() : '',
    job.customer?.full_name ?? '',
    job.customer?.email ?? '',
    job.customer?.phone ?? '',
    job.service?.name ?? '',
    job.location?.name ?? '',
    [job.address?.line1, job.address?.city].filter(Boolean).join(', '),
    job.provider?.display_name ?? 'Unassigned',
    ((job.price_override ?? job.total_price ?? job.price ?? 0) / 100).toFixed(2),
    job.payment_status ?? '',
    job.status ?? '',
  ])

  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
