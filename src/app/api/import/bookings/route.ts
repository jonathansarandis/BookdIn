// @ts-nocheck
// src/app/api/import/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0
  return Math.round(parseFloat(priceStr.replace(/[$,]/g, '')) * 100)
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  try {
    const [datePart, timePart] = dateStr.trim().split(' ')
    const [month, day, year] = datePart.split('-')
    const d = new Date(`${year}-${month}-${day}T${convertTime(timePart)}`)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch { return null }
}

function convertTime(timeStr: string): string {
  if (!timeStr) return '09:00:00'
  const isPM = timeStr.includes('PM')
  const isAM = timeStr.includes('AM')
  const clean = timeStr.replace('AM', '').replace('PM', '').trim()
  const [hours, minutes] = clean.split(':')
  let h = parseInt(hours)
  if (isPM && h !== 12) h += 12
  if (isAM && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${minutes || '00'}:00`
}

function parsePhone(phone: string): string | null {
  if (!phone) return null
  return phone.replace(/^\+61/, '0').trim()
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += line[i] }
  }
  result.push(current.trim())
  return result
}

export async function POST(request: NextRequest) {
  // Get token from Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the token and get the user
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get business_id
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  const businessId = profile?.business_id
  if (!businessId) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  const headers = parseCSVLine(lines[0])

  const { data: services } = await serviceClient.from('services').select('id, name').eq('business_id', businessId)
  const { data: providers } = await serviceClient.from('providers').select('id, display_name').eq('business_id', businessId)

  const results = {
    total: lines.length - 1,
    customers_created: 0,
    customers_existing: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    errors: [] as string[],
  }

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = values[idx] || '' })

    try {
      const email = row.email?.toLowerCase().trim()
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim()
      if (!fullName) continue

      let customerId: string

      if (email) {
        const { data: existing } = await serviceClient
          .from('customers').select('id').eq('business_id', businessId).eq('email', email).maybeSingle()

        if (existing) {
          customerId = existing.id
          results.customers_existing++
        } else {
          const { data: newCustomer, error: ce } = await serviceClient
            .from('customers')
            .insert({ business_id: businessId, full_name: fullName, email, phone: parsePhone(row.phone_number), stripe_customer_id: row.stripe_customer_id || null })
            .select('id').single()
          if (ce || !newCustomer) { results.errors.push(`Row ${i}: ${ce?.message}`); continue }
          customerId = newCustomer.id
          results.customers_created++
        }
      } else {
        const { data: newCustomer } = await serviceClient
          .from('customers')
          .insert({ business_id: businessId, full_name: fullName, phone: parsePhone(row.phone_number) })
          .select('id').single()
        if (!newCustomer) continue
        customerId = newCustomer.id
        results.customers_created++
      }

      // Address
      let addressId: string | null = null
      const streetAddr = row.street_address && row.street_address !== 'N/A' ? row.street_address : null
      if (streetAddr && row.city && row.state) {
        const { data: addr } = await serviceClient
          .from('addresses')
          .insert({ business_id: businessId, customer_id: customerId, line1: streetAddr, city: row.city, state: row.state, postcode: row.zipcode, country: 'AU', is_default: true })
          .select('id').single()
        addressId = addr?.id || null
      }

      const scheduledAt = parseDate(row.service_date)
      if (!scheduledAt) { results.jobs_skipped++; continue }

      // Match service
      let serviceId: string | null = null
      const serviceField = row.services?.toLowerCase() || ''
      if (services?.length) {
        const match = services.find(s => {
          const sName = s.name.toLowerCase()
          if (sName.includes('end of lease') && (serviceField.includes('end') || serviceField.includes('lease'))) return true
          if (sName.includes('move in') && serviceField.includes('move')) return true
          if (sName.includes('deep') && serviceField.includes('deep')) return true
          return false
        }) || services.find(s => s.name.toLowerCase().includes('general')) || services[0]
        serviceId = match?.id || null
      }

      // Match provider
      let providerId: string | null = null
      if (row.assigned_to?.trim() && providers?.length) {
        const provName = row.assigned_to.trim().toLowerCase()
        const match = providers.find(p =>
          p.display_name.toLowerCase().includes(provName.split(' ')[0]) ||
          provName.includes(p.display_name.toLowerCase().split(' ')[0])
        )
        providerId = match?.id || null
      }

      const totalPrice = parsePrice(row.price)
      const isPaid = row.status?.toLowerCase() === 'paid'

      const noteParts = []
      if (row.services) noteParts.push(`Service: ${row.services}`)
      if (row.extras) noteParts.push(`Extras: ${row.extras}`)
      if (row.notes) noteParts.push(row.notes)

      const { error: jobError } = await serviceClient.from('jobs').insert({
        business_id: businessId,
        customer_id: customerId,
        address_id: addressId,
        service_id: serviceId,
        provider_id: providerId,
        status: isPaid ? 'completed' : 'pending',
        scheduled_at: scheduledAt,
        duration_minutes: 120,
        price: totalPrice,
        total_price: totalPrice,
        tax_amount: 0,
        frequency: 'one_time',
        customer_notes: noteParts.join(' | ') || null,
        payment_method: row.payment_method === 'CC' ? 'card' : 'other',
        payment_status: isPaid ? 'paid' : 'unpaid',
        paid_at: isPaid ? scheduledAt : null,
        stripe_payment_intent_id: row.stripe_payment_method_id || null,
        booking_source: 'import',
      })

      if (jobError) {
        results.errors.push(`Row ${i}: ${jobError.message}`)
        results.jobs_skipped++
      } else {
        results.jobs_created++
      }
    } catch (err: any) {
      results.errors.push(`Row ${i}: ${err.message}`)
    }
  }

  return NextResponse.json(results)
}
