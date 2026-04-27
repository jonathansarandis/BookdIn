// @ts-nocheck
// src/app/api/import/bookings/route.ts
// Upload the ConvertLabs bookings CSV to import customers and jobs

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
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
    // Format: "01-30-2026 11:00AM"
    const [datePart, timePart] = dateStr.split(' ')
    const [month, day, year] = datePart.split('-')
    const timeStr = timePart?.replace('AM', ' AM').replace('PM', ' PM')
    const d = new Date(`${year}-${month}-${day} ${timeStr}`)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

function parsePhone(phone: string): string | null {
  if (!phone) return null
  // Convert +614XXXXXXXX to 04XXXXXXXX
  return phone.replace(/^\+61/, '0').trim()
}

function parseStatus(status: string): string {
  const s = status?.toLowerCase()
  if (s === 'paid') return 'completed'
  if (s === 'pending') return 'pending'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'completed'
}

function parsePaymentStatus(status: string): string {
  return status?.toLowerCase() === 'paid' ? 'paid' : 'unpaid'
}

// Parse CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const businessId = formData.get('business_id') as string

  if (!file || !businessId) {
    return NextResponse.json({ error: 'Missing file or business_id' }, { status: 400 })
  }

  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  const headers = parseCSVLine(lines[0])

  const results = {
    total: lines.length - 1,
    customers_created: 0,
    customers_existing: 0,
    jobs_created: 0,
    jobs_skipped: 0,
    errors: [] as string[],
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    try {
      const email = row.email?.toLowerCase().trim()
      const fullName = `${row.first_name} ${row.last_name}`.trim()

      if (!email && !fullName) continue

      // Find or create customer
      let customerId: string

      if (email) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .eq('email', email)
          .single()

        if (existing) {
          customerId = existing.id
          results.customers_existing++
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              business_id: businessId,
              full_name: fullName,
              email,
              phone: parsePhone(row.phone_number),
              stripe_customer_id: row.stripe_customer_id || null,
            })
            .select('id')
            .single()

          if (customerError) {
            results.errors.push(`Row ${i}: Customer error — ${customerError.message}`)
            continue
          }
          customerId = newCustomer.id
          results.customers_created++
        }
      } else {
        // No email — create by name
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            business_id: businessId,
            full_name: fullName,
            phone: parsePhone(row.phone_number),
          })
          .select('id')
          .single()
        if (!newCustomer) continue
        customerId = newCustomer.id
        results.customers_created++
      }

      // Create address if we have one
      let addressId: string | null = null
      if (row.street_address && row.city && row.state) {
        const { data: addr } = await supabase
          .from('addresses')
          .insert({
            business_id: businessId,
            customer_id: customerId,
            line1: row.street_address !== 'N/A' ? row.street_address : row.address,
            city: row.city,
            state: row.state,
            postcode: row.zipcode,
            country: 'AU',
            is_default: true,
          })
          .select('id')
          .single()
        addressId = addr?.id || null
      }

      // Parse scheduled date
      const scheduledAt = parseDate(row.service_date)
      if (!scheduledAt) {
        results.jobs_skipped++
        continue
      }

      // Find matching service (best effort by bedroom/bathroom count in service field)
      const { data: services } = await supabase
        .from('services')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .limit(1)

      const serviceId = services?.[0]?.id || null

      // Find provider by name
      let providerId: string | null = null
      if (row.assigned_to) {
        const { data: provider } = await supabase
          .from('providers')
          .select('id')
          .eq('business_id', businessId)
          .ilike('display_name', `%${row.assigned_to.trim()}%`)
          .single()
        providerId = provider?.id || null
      }

      const totalPrice = parsePrice(row.price)
      const status = parseStatus(row.status)
      const paymentStatus = parsePaymentStatus(row.status)

      // Build notes
      const noteParts = []
      if (row.services) noteParts.push(`Service: ${row.services}`)
      if (row.extras) noteParts.push(`Extras: ${row.extras}`)
      if (row.notes) noteParts.push(row.notes)
      if (row.frequency) noteParts.push(`Frequency: ${row.frequency}`)
      const combinedNotes = noteParts.join(' | ')

      const { error: jobError } = await supabase
        .from('jobs')
        .insert({
          business_id: businessId,
          customer_id: customerId,
          address_id: addressId,
          service_id: serviceId,
          provider_id: providerId,
          status,
          scheduled_at: scheduledAt,
          duration_minutes: 120,
          price: totalPrice,
          total_price: totalPrice,
          tax_amount: 0,
          frequency: row.frequency?.toLowerCase().replace(' ', '_') || 'one_time',
          customer_notes: combinedNotes || null,
          payment_method: row.payment_method === 'CC' ? 'card' : 'other',
          payment_status: paymentStatus,
          paid_at: paymentStatus === 'paid' ? scheduledAt : null,
          stripe_payment_intent_id: row.stripe_payment_method_id || null,
          booking_source: 'import',
        })

      if (jobError) {
        results.errors.push(`Row ${i}: Job error — ${jobError.message}`)
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
