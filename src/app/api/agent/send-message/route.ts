// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sendDialpadSmsRaw } from '@/lib/sms/dialpad'
import { upsertCrmContact, logCrmActivity } from '@/lib/crm/upsert'
import { appendDailyLogEntry, dateInTimezone } from '@/lib/agent/dailyLog'

const resend = new Resend(process.env.RESEND_API_KEY)

function splitName(fullName: string) {
  const parts = (fullName || '').trim().split(/\s+/)
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') || undefined }
}

function emailHtml(businessName: string, brandColor: string, body: string) {
  const paragraphs = body.split(/\n{2,}/).map(p => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`).join('')
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background-color:${brandColor || '#0A0F1E'};padding:28px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${businessName}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">${paragraphs}</td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">${businessName} · Powered by BookdIn</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await request.json()
  const {
    channel, taskId, taskType, taskTitle, amount,
    contactId: providedContactId, customerId, customerName, customerPhone, customerEmail,
    to, text, emailSubject, emailBody,
  } = body

  if (!channel || !['sms', 'email'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be "sms" or "email"' }, { status: 400 })
  }
  if (!to) return NextResponse.json({ error: 'Missing recipient (to)' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses')
    .select('name, phone, contact_email, brand_color, timezone, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_enabled')
    .eq('id', businessId).single()
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // Resolve (or create) the CRM contact so this outreach gets logged, even if the task
  // wasn't already linked to one.
  let contactId = providedContactId || null
  if (!contactId && customerId) {
    const result = await upsertCrmContact(supabase, {
      business_id: businessId,
      customer_id: customerId,
      full_name: customerName || 'Customer',
      email: customerEmail,
      phone: customerPhone,
      source: 'admin',
    })
    if (result.contact_id) contactId = result.contact_id
  }

  let sendResult: { ok: boolean; error?: string; messageId?: string }

  if (channel === 'sms') {
    if (!text?.trim()) return NextResponse.json({ error: 'Missing SMS text' }, { status: 400 })
    const { first, last } = splitName(customerName)
    const result = await sendDialpadSmsRaw({
      business: {
        sms_provider: business.sms_provider,
        sms_api_key_encrypted: business.sms_api_key_encrypted,
        sms_api_key_iv: business.sms_api_key_iv,
        sms_user_id: business.sms_user_id,
        sms_template: null,
        sms_enabled: business.sms_enabled,
      },
      toPhone: to,
      text,
      customerId,
      customerFirstName: first,
      customerLastName: last,
      customerEmail,
      businessName: business.name,
    })
    sendResult = result.status === 'sent'
      ? { ok: true, messageId: result.message_id }
      : { ok: false, error: result.error || `SMS ${result.status}` }
  } else {
    if (!emailBody?.trim()) return NextResponse.json({ error: 'Missing email body' }, { status: 400 })
    try {
      const { data, error } = await resend.emails.send({
        from: `${business.name} <hello@bookdin.co>`,
        reply_to: business.contact_email || 'hello@bookdin.co',
        to,
        subject: emailSubject || `A note from ${business.name}`,
        html: emailHtml(business.name, business.brand_color, emailBody),
        text: emailBody,
      })
      if (error) throw error
      sendResult = { ok: true, messageId: data?.id }
    } catch (err: any) {
      sendResult = { ok: false, error: err.message || 'Email send failed' }
    }
  }

  if (!sendResult.ok) {
    return NextResponse.json({ error: sendResult.error }, { status: 502 })
  }

  // Log the outreach and, for a lead still sitting in "Lead", advance them to "Contacted" —
  // best-effort, never blocks the response since the message has already gone out.
  if (contactId) {
    await logCrmActivity(supabase, {
      business_id: businessId,
      contact_id: contactId,
      type: channel,
      title: `${channel === 'sms' ? 'SMS' : 'Email'} sent — ${taskTitle || taskType || 'AI Agent outreach'}`,
      body: channel === 'sms' ? text : `Subject: ${emailSubject}\n\n${emailBody}`,
    })
    await supabase.from('crm_contacts')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', contactId)
    await supabase.from('crm_contacts')
      .update({ stage: 'contacted' })
      .eq('id', contactId).eq('stage', 'lead')
  }

  // Daily memory: record this send so the agent knows what's already been actioned today.
  const today = dateInTimezone(business.timezone)
  await appendDailyLogEntry(supabase, businessId, today, 'messages_sent', {
    channel, taskId, taskType, taskTitle, contactId, customerName,
    to, amount: typeof amount === 'number' ? amount : undefined,
    messageId: sendResult.messageId,
  })

  return NextResponse.json({ success: true, contactId, messageId: sendResult.messageId })
}
