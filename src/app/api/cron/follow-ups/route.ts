// @ts-nocheck
// src/app/api/cron/follow-ups/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = {
    call_prompts_sent: 0,
    follow_up_emails_sent: 0,
    stale_reminders_sent: 0,
  }

  // ----------------------------------------------------------------
  // 1. QUOTE FOLLOW-UPS
  // Find quotes sent 2+ days ago with no response (still 'sent')
  // ----------------------------------------------------------------
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()

  const { data: overdueQuotes } = await supabase
    .from('quotes')
    .select('*, customer:customers(full_name, email, phone), business:businesses(id, name, brand_color)')
    .eq('status', 'sent')
    .lt('sent_at', twoDaysAgo)

  for (const quote of overdueQuotes || []) {
    // Check we haven't already sent a follow-up notification today
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_id', quote.id)
      .eq('type', 'follow_up')
      .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString())
      .limit(1)

    if (existingNotif?.length) continue

    // Get staff for this business
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('business_id', quote.business_id)

    // Create in-app notifications
    if (staff?.length) {
      await supabase.from('notifications').insert(
        staff.map(s => ({
          business_id: quote.business_id,
          user_id: s.id,
          type: 'follow_up',
          title: `📞 Follow up on quote for ${quote.customer?.full_name}`,
          body: `Quote QT-${quote.id.slice(0, 8).toUpperCase()} was sent 2 days ago with no response. Call to follow up.`,
          entity_type: 'quote',
          entity_id: quote.id,
          action_url: `/quotes/${quote.id}`,
        }))
      )
      results.call_prompts_sent += staff.length
    }

    // Send follow-up email to customer
    if (quote.customer?.email) {
      const quoteRef = `QT-${quote.id.slice(0, 8).toUpperCase()}`
      await resend.emails.send({
        from: `${quote.business?.name} <hello@bookdin.co>`,
        reply_to: staff?.[0]?.email,
        to: quote.customer.email,
        subject: `Following up on your quote — ${quoteRef}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: ${quote.business?.brand_color || '#1A6B4A'};">Following up on your quote</h2>
            <p>Hi ${quote.customer.full_name},</p>
            <p>We wanted to follow up on the quote we sent you a couple of days ago (${quoteRef}) for $${(quote.total / 100).toFixed(2)}.</p>
            <p>If you have any questions or would like to go ahead, simply reply to this email or give us a call.</p>
            <p>We'd love to help!</p>
            <p style="color: #6b7280; font-size: 13px;">— ${quote.business?.name}</p>
          </div>
        `,
      }).catch(console.error)
      results.follow_up_emails_sent++
    }
  }

  // ----------------------------------------------------------------
  // 2. SCHEDULED FOLLOW-UPS DUE NOW
  // Find CRM contacts with next_followup_at in the past
  // ----------------------------------------------------------------
  const { data: dueFollowups } = await supabase
    .from('crm_contacts')
    .select('*, business:businesses(id, name, brand_color)')
    .not('next_followup_at', 'is', null)
    .lt('next_followup_at', now.toISOString())
    .not('stage', 'in', '("won","lost")')

  for (const contact of dueFollowups || []) {
    // Check we haven't already notified today
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_id', contact.id)
      .eq('type', 'follow_up')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .limit(1)

    if (existingNotif?.length) continue

    const { data: staff } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('business_id', contact.business_id)

    if (staff?.length) {
      await supabase.from('notifications').insert(
        staff.map(s => ({
          business_id: contact.business_id,
          user_id: s.id,
          type: 'call_prompt',
          title: `📞 Follow up with ${contact.full_name}`,
          body: `Scheduled follow-up is due now. ${contact.phone ? `Call: ${contact.phone}` : contact.email || ''}`,
          entity_type: 'crm_contact',
          entity_id: contact.id,
          action_url: `/crm/${contact.id}`,
        }))
      )
      results.call_prompts_sent += staff.length

      // Send email to staff
      for (const s of staff) {
        if (!s.email) continue
        await resend.emails.send({
          from: `BookdIn <hello@bookdin.co>`,
          to: s.email,
          subject: `📞 Follow up with ${contact.full_name} now`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: ${contact.business?.brand_color || '#1A6B4A'};">Follow-up reminder</h2>
              <p>Hi ${s.full_name},</p>
              <p>It's time to follow up with <strong>${contact.full_name}</strong>.</p>
              ${contact.phone ? `<p>📞 <a href="tel:${contact.phone}">${contact.phone}</a></p>` : ''}
              ${contact.email ? `<p>✉️ ${contact.email}</p>` : ''}
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/crm/${contact.id}" style="display: inline-block; background: ${contact.business?.brand_color || '#1A6B4A'}; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin-top: 8px;">View contact →</a>
            </div>
          `,
        }).catch(console.error)
      }
    }

    // Clear the follow-up date so it doesn't fire again
    await supabase
      .from('crm_contacts')
      .update({ next_followup_at: null })
      .eq('id', contact.id)
  }

  // ----------------------------------------------------------------
  // 3. STALE CONTACTS — no activity for 3 days
  // ----------------------------------------------------------------
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: staleContacts } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('stage', 'lead')
    .lt('last_activity_at', threeDaysAgo)
    .is('next_followup_at', null)

  for (const contact of staleContacts || []) {
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_id', contact.id)
      .gte('created_at', threeDaysAgo)
      .limit(1)

    if (existingNotif?.length) continue

    const { data: staff } = await supabase
      .from('profiles')
      .select('id')
      .eq('business_id', contact.business_id)

    if (staff?.length) {
      await supabase.from('notifications').insert(
        staff.map(s => ({
          business_id: contact.business_id,
          user_id: s.id,
          type: 'follow_up',
          title: `⚠️ No activity — ${contact.full_name}`,
          body: `This lead has had no activity for 3 days. Consider reaching out.`,
          entity_type: 'crm_contact',
          entity_id: contact.id,
          action_url: `/crm/${contact.id}`,
        }))
      )
      results.stale_reminders_sent += staff.length
    }
  }

  return NextResponse.json({
    message: 'Follow-up cron completed',
    timestamp: now.toISOString(),
    ...results,
  })
}
