import { Resend } from 'resend'
import {
  bookingConfirmationTemplate,
  receiptTemplate,
  cancellationTemplate,
  reminderTemplate,
  type BusinessEmailData,
  type CustomerEmailData,
  type AddressEmailData,
  type ServiceEmailData,
  type JobEmailData,
} from './templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'BookdIn <hello@bookdin.co>'

type SendResult = { success: true; id: string } | { success: false; error: string }

function replyTo(business: BusinessEmailData): string {
  return business.contact_email || 'hello@bookdin.co'
}

export async function sendBookingConfirmation(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cardSetupUrl?: string
}): Promise<SendResult> {
  try {
    const { subject, html, text } = bookingConfirmationTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendBookingConfirmation failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendReceipt(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  paymentAmount: number
}): Promise<SendResult> {
  try {
    const { subject, html, text } = receiptTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendReceipt failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendCancellation(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
  cancellationReason?: string
}): Promise<SendResult> {
  try {
    const { subject, html, text } = cancellationTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendCancellation failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}

export async function sendReminder(params: {
  job: JobEmailData
  customer: CustomerEmailData
  business: BusinessEmailData
  address: AddressEmailData
  service: ServiceEmailData
}): Promise<SendResult> {
  try {
    const { subject, html, text } = reminderTemplate(params)
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.customer.email,
      reply_to: replyTo(params.business),
      subject,
      html,
      text,
    })
    if (error) throw error
    return { success: true, id: data!.id }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[email] sendReminder failed:', error, { jobId: params.job.id })
    return { success: false, error: msg }
  }
}
