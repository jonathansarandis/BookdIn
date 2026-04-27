// @ts-nocheck
// src/app/api/quotes/[id]/send-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  // Get quote with customer and business details
  const { data: quote, error: quoteError } = await serviceClient
    .from('quotes')
    .select(`
      *,
      customer:customers(id, full_name, email),
      business:businesses(id, name, email)
    `)
    .eq('id', params.id)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (quote.business_id !== profile?.business_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!quote.customer?.email) {
    return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 })
  }

  const quoteRef = `QT-${quote.id.slice(0, 8).toUpperCase()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote from ${quote.business?.name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #166534; padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${quote.business?.name}</h1>
              <p style="margin: 8px 0 0; color: #bbf7d0; font-size: 14px;">Quote for services</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                Hi ${quote.customer.full_name},
              </p>
              <p style="margin: 0 0 32px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                Please find your quote below. If you have any questions, feel free to reply to this email.
              </p>

              <!-- Quote details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <span style="color: #6b7280; font-size: 13px;">Quote reference</span><br>
                    <span style="color: #111827; font-size: 15px; font-weight: 600;">${quoteRef}</span>
                  </td>
                  ${quote.valid_until ? `
                  <td style="padding-bottom: 12px; text-align: right;">
                    <span style="color: #6b7280; font-size: 13px;">Valid until</span><br>
                    <span style="color: #111827; font-size: 15px; font-weight: 600;">${formatDate(quote.valid_until)}</span>
                  </td>
                  ` : ''}
                </tr>
              </table>

              <!-- Pricing -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; padding: 12px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Subtotal</td>
                        <td style="text-align: right; color: #111827; font-size: 14px;">${formatCurrency(quote.subtotal)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${quote.tax_amount > 0 ? `
                <tr>
                  <td style="padding: 12px 0; border-top: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Tax</td>
                        <td style="text-align: right; color: #111827; font-size: 14px;">${formatCurrency(quote.tax_amount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="border-top: 2px solid #e5e7eb; border-bottom: 2px solid #e5e7eb; padding: 16px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #111827; font-size: 16px; font-weight: 700;">Total</td>
                        <td style="text-align: right; color: #111827; font-size: 20px; font-weight: 700;">${formatCurrency(quote.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${quote.notes ? `
              <!-- Notes -->
              <div style="background-color: #f9fafb; border-left: 3px solid #166534; padding: 16px; border-radius: 4px; margin-bottom: 32px;">
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${quote.notes}</p>
              </div>
              ` : ''}

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Thank you for considering ${quote.business?.name}. We look forward to working with you.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                ${quote.business?.name} · Powered by BookdIn
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  try {
    await resend.emails.send({
      from: `${quote.business?.name} <info@cleanfreaks.au>`,
      to: quote.customer.email,
      subject: `Quote ${quoteRef} from ${quote.business?.name}`,
      html: emailHtml,
    })

    // Update quote status to sent
    await serviceClient
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Resend error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
