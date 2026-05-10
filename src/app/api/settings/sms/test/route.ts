// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendDialpadSms } from '@/lib/sms/dialpad'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { business_id, to_phone } = await req.json()
    if (!business_id || !to_phone) {
      return NextResponse.json({ error: 'Missing business_id or to_phone' }, { status: 400 })
    }

    // Verify ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()
    if (!profile || profile.business_id !== business_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Pull SMS config from businesses row
    const { data: business } = await supabase
      .from('businesses')
      .select('name, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_template, sms_enabled')
      .eq('id', business_id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const result = await sendDialpadSms({
      business: {
        sms_provider: business.sms_provider,
        sms_api_key_encrypted: business.sms_api_key_encrypted,
        sms_api_key_iv: business.sms_api_key_iv,
        sms_user_id: business.sms_user_id,
        sms_template: business.sms_template,
        sms_enabled: true,  // bypass enabled check for testing
      },
      toPhone: to_phone,
      vars: {
        customer_name: 'Test User',
        service_name: 'Test Service',
        date: 'Today',
        time: '12:00 pm',
        business_name: business.name || 'Test Business',
        business_phone: '',
      },
    })

    if (result.status !== 'sent') {
      return NextResponse.json({ error: result.error || `Send failed: ${result.status}` }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `Test SMS sent to ${to_phone}. Check your phone in 30 seconds.`,
      message_id: result.message_id,
    })
  } catch (err: any) {
    console.error('SMS test POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
