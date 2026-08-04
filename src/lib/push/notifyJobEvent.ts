// @ts-nocheck
// Server-only. Looks up who should be pushed for a job event and sends it.
// Called directly (same process) from routes that already did the DB write
// and their own auth check — this function does no auth of its own.
import { createClient } from '@supabase/supabase-js'
import { sendExpoPush } from './expo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type JobEvent =
  | { event: 'assigned' }
  | { event: 'cancelled' }
  | { event: 'completed' }
  | { event: 'message'; senderRole: 'owner' | 'provider'; preview: string }

export async function notifyJobEvent(jobId: string, evt: JobEvent) {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, business_id, provider_id, customer:customers(full_name), business:businesses(name), provider:providers(display_name)')
      .eq('id', jobId)
      .single()
    if (!job) return

    const customerName = job.customer?.full_name ?? 'a customer'
    const businessName = job.business?.name ?? 'BookdIn'
    const providerName = job.provider?.display_name ?? 'Your provider'

    async function pushToProvider(title: string, body: string) {
      if (!job.provider_id) return
      const { data: provider } = await supabase
        .from('providers').select('push_token').eq('id', job.provider_id).single()
      if (provider?.push_token) {
        await sendExpoPush([{ to: provider.push_token, title, body, data: { jobId, type: evt.event } }])
      }
    }

    async function pushToOwners(title: string, body: string) {
      const { data: staff } = await supabase
        .from('profiles').select('push_token').eq('business_id', job.business_id)
      const messages = (staff ?? [])
        .filter((s: { push_token: string | null }) => s.push_token)
        .map((s: { push_token: string }) => ({ to: s.push_token, title, body, data: { jobId, type: evt.event } }))
      if (messages.length) await sendExpoPush(messages)
    }

    switch (evt.event) {
      case 'assigned':
        await pushToProvider('New job assigned', `You've been assigned a job for ${customerName}.`)
        break
      case 'cancelled':
        await pushToProvider('Job cancelled', `Your job for ${customerName} was cancelled.`)
        break
      case 'completed':
        await pushToOwners('Job completed', `${customerName}'s job with ${providerName} was marked complete.`)
        break
      case 'message':
        if (evt.senderRole === 'owner') {
          await pushToProvider(`New message — ${businessName}`, evt.preview)
        } else {
          await pushToOwners(`New message — ${providerName}`, evt.preview)
        }
        break
    }
  } catch (e: any) {
    console.error('[notifyJobEvent] failed:', e.message)
  }
}
