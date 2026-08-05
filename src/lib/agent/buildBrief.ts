import type { SupabaseClient } from '@supabase/supabase-js'
import { getDailyLog, dateInTimezone } from '@/lib/agent/dailyLog'
import { calculateWeeklyProfit, getMonday } from '@/lib/reports/weeklyProfit'

/**
 * Builds the full agent brief (summary + tasks + calendar gaps) for one business.
 * Shared by the user-facing /api/agent/brief route and the cron jobs (morning briefing,
 * end-of-day summary) — both need the exact same "what needs attention" view, just from
 * a service-role client instead of a per-request authenticated one.
 *
 * Also reads yesterday's daily log so the agent starts each day with continuity — it knows
 * what was actioned/skipped and any outcomes the team reported, not just live BookdIn data.
 */
export async function buildAgentBrief(supabase: SupabaseClient, businessId: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()
  const lastWeekStart = new Date(now.getTime() - 7 * 86400000).toISOString()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3600000).toISOString()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000).toISOString()

  const [
    { data: pendingPayment },
    { data: todayJobs },
    { data: nextWeekJobs },
    { data: recentCancellations },
    { data: unassignedJobs },
    { data: thisWeekJobs },
    { data: lastWeekJobs },
    { data: noResponseLeads },
    { data: crmStaleLeads },
    { data: businessRow },
  ] = await Promise.all([
    supabase.from('jobs').select('id, total_price, price_override, customer_id, customer:customers(full_name, phone, email), scheduled_at, created_at')
      .eq('business_id', businessId).eq('payment_status', 'unpaid').not('status', 'in', '("cancelled","completed")').order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, status, scheduled_at, customer:customers(full_name), address:addresses(city, state), provider:providers(display_name)')
      .eq('business_id', businessId).gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd).order('scheduled_at'),
    supabase.from('jobs').select('id, scheduled_at, status, address:addresses(state)')
      .eq('business_id', businessId).gte('scheduled_at', todayEnd).lt('scheduled_at', weekEnd).not('status', 'eq', 'cancelled').order('scheduled_at'),
    supabase.from('jobs').select('id, total_price, price_override, customer:customers(full_name), scheduled_at, updated_at')
      .eq('business_id', businessId).eq('status', 'cancelled').gte('updated_at', fortyEightHoursAgo).order('updated_at', { ascending: false }),
    supabase.from('jobs').select('id, scheduled_at, customer:customers(full_name), address:addresses(state)')
      .eq('business_id', businessId).is('provider_id', null).not('status', 'in', '("cancelled","completed")').gte('scheduled_at', todayStart).lt('scheduled_at', weekEnd).order('scheduled_at'),
    supabase.from('jobs').select('total_price, price_override')
      .eq('business_id', businessId).gte('scheduled_at', lastWeekStart).lt('scheduled_at', todayEnd).not('status', 'eq', 'cancelled'),
    supabase.from('jobs').select('total_price, price_override')
      .eq('business_id', businessId).gte('scheduled_at', new Date(now.getTime() - 14 * 86400000).toISOString()).lt('scheduled_at', lastWeekStart).not('status', 'eq', 'cancelled'),
    supabase.from('quotes').select('id, created_at, customer_id, customer:customers(full_name, phone, email), total, status')
      .eq('business_id', businessId).eq('status', 'sent').lt('created_at', twentyFourHoursAgo).order('created_at', { ascending: false }).limit(20),
    supabase.from('crm_contacts').select('id, full_name, phone, email, stage, created_at')
      .eq('business_id', businessId).eq('stage', 'lead').lt('created_at', twentyFourHoursAgo).order('created_at', { ascending: true }).limit(10),
    supabase.from('businesses').select('timezone').eq('id', businessId).single(),
  ])

  const yesterdayDate = dateInTimezone(businessRow?.timezone, -1)
  const yesterdayLog = await getDailyLog(supabase, businessId, yesterdayDate)

  // Real weekly profit (revenue - subcontractor pay - GST - manually-entered costs),
  // same calculation /reports/profit shows — replaces the old spreadsheet as the
  // agent's source for "how's the business actually doing this week".
  const thisMonday = getMonday(now)
  const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000)
  const [thisWeekProfitResult, lastWeekProfitResult] = await Promise.all([
    calculateWeeklyProfit(supabase, businessId, thisMonday),
    calculateWeeklyProfit(supabase, businessId, lastMonday),
  ])

  // Link pending-payment jobs and no-response quotes back to their CRM contact (if any) so
  // action buttons and the "What needs you" list can show/advance pipeline stage.
  const linkedCustomerIds = Array.from(new Set([
    ...(pendingPayment || []).map((j: any) => j.customer_id).filter(Boolean),
    ...(noResponseLeads || []).map((q: any) => q.customer_id).filter(Boolean),
  ]))
  let customerToContact: Record<string, { contactId: string; stage: string }> = {}
  if (linkedCustomerIds.length) {
    const { data: linkedContacts } = await supabase
      .from('crm_contacts').select('id, customer_id, stage')
      .eq('business_id', businessId).in('customer_id', linkedCustomerIds)
    for (const c of linkedContacts || []) {
      customerToContact[c.customer_id] = { contactId: c.id, stage: c.stage }
    }
  }

  const thisWeekRevenue = thisWeekJobs?.reduce((s: number, j: any) => s + (j.price_override ?? j.total_price ?? 0), 0) || 0
  const lastWeekRevenue = lastWeekJobs?.reduce((s: number, j: any) => s + (j.price_override ?? j.total_price ?? 0), 0) || 0
  const revenueChange = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0

  const calendarByDay: Record<string, number> = {}
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    calendarByDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const job of nextWeekJobs || []) {
    const key = new Date(job.scheduled_at).toISOString().slice(0, 10)
    if (key in calendarByDay) calendarByDay[key]++
  }
  const calendarGaps = Object.entries(calendarByDay)
    .filter(([, count]) => count < 3)
    .map(([date, count]) => ({ date, count, label: new Date(date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }) }))

  const tasks: any[] = []
  for (const job of (pendingPayment || []).slice(0, 5)) {
    const value = (job.price_override ?? job.total_price ?? 0)
    const linked = customerToContact[job.customer_id]
    tasks.push({ id: `payment-${job.id}`, type: 'chase_payment', priority: 'urgent', title: `Chase payment — ${job.customer?.full_name}`, subtitle: `$${(value / 100).toFixed(2)} unpaid · ${new Date(job.scheduled_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`, jobId: job.id, contactId: linked?.contactId, crmStage: linked?.stage, customerId: job.customer_id, customerName: job.customer?.full_name, customerPhone: job.customer?.phone, customerEmail: job.customer?.email, amount: value, jobDate: new Date(job.scheduled_at).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }), action: 'Send reminder' })
  }
  for (const job of (unassignedJobs || []).slice(0, 3)) {
    tasks.push({ id: `assign-${job.id}`, type: 'assign_provider', priority: 'high', title: `Assign team — ${job.customer?.full_name}`, subtitle: `${job.address?.state || 'Unknown'} · ${new Date(job.scheduled_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`, jobId: job.id, action: 'Assign' })
  }
  for (const quote of (noResponseLeads || []).slice(0, 3)) {
    const linked = customerToContact[quote.customer_id]
    tasks.push({ id: `quote-${quote.id}`, type: 'follow_up_lead', priority: 'medium', title: `Follow up — ${quote.customer?.full_name}`, subtitle: `Quote sent ${new Date(quote.created_at).toLocaleDateString('en-AU')} · no response`, quoteId: quote.id, contactId: linked?.contactId, crmStage: linked?.stage, customerId: quote.customer_id, customerName: quote.customer?.full_name, customerPhone: quote.customer?.phone, customerEmail: quote.customer?.email, quoteTotal: quote.total, quoteSentAt: new Date(quote.created_at).toLocaleDateString('en-AU'), action: 'Call / SMS' })
  }
  for (const contact of (crmStaleLeads || []).slice(0, 3)) {
    const daysSince = Math.floor((now.getTime() - new Date(contact.created_at).getTime()) / 86400000)
    tasks.push({ id: `crm-lead-${contact.id}`, type: 'follow_up_lead', priority: 'medium', title: `Follow up lead — ${contact.full_name}`, subtitle: `${contact.phone || contact.email || 'No contact info'} · Lead for ${daysSince}d, not yet contacted`, contactId: contact.id, crmStage: contact.stage, customerName: contact.full_name, customerPhone: contact.phone, customerEmail: contact.email, daysSinceCreated: daysSince, action: 'Call / SMS' })
  }
  for (const gap of calendarGaps.slice(0, 2)) {
    tasks.push({ id: `gap-${gap.date}`, type: 'fill_calendar', priority: 'medium', title: `Fill calendar — ${gap.label}`, subtitle: `Only ${gap.count} job${gap.count !== 1 ? 's' : ''} booked · target is 5+`, date: gap.date, action: 'View leads' })
  }

  return {
    summary: {
      pendingPaymentCount: pendingPayment?.length || 0,
      pendingPaymentValue: pendingPayment?.reduce((s: number, j: any) => s + (j.price_override ?? j.total_price ?? 0), 0) || 0,
      todayJobCount: todayJobs?.length || 0,
      recentCancellationCount: recentCancellations?.length || 0,
      unassignedCount: unassignedJobs?.length || 0,
      noResponseLeadCount: noResponseLeads?.length || 0,
      thisWeekRevenue, lastWeekRevenue, revenueChange,
      // Real profit (revenue − subcontractor pay − GST − manual costs) for completed
      // jobs so far this week — grows through the week as jobs are completed, same as
      // the /reports/profit page. Not the same as thisWeekRevenue above (that's gross
      // sales across all jobs regardless of completion or expenses).
      thisWeekProfitSoFar: thisWeekProfitResult.totalProfit,
      lastWeekProfit: lastWeekProfitResult.totalProfit,
      profitByLocation: thisWeekProfitResult.locations.map(l => ({ location: l.locationName, profit: l.profit, revenueExGst: l.revenueExGst })),
      nextWeekJobCount: nextWeekJobs?.length || 0,
      crmStaleLeadCount: crmStaleLeads?.length || 0,
      crmFollowUpLeads: (crmStaleLeads || []).map((c: any) => ({
        name: c.full_name,
        phone: c.phone || null,
        email: c.email || null,
        daysSinceCreated: Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86400000),
      })),
      yesterday: yesterdayLog ? {
        tasksActioned: (yesterdayLog.tasks_actioned || []).length,
        messagesSent: (yesterdayLog.messages_sent || []).length,
        revenueRecovered: yesterdayLog.revenue_recovered || 0,
        outcomes: (yesterdayLog.outcomes || []).map((o: any) => o.note),
        eodSummary: yesterdayLog.notes || null,
      } : null,
    },
    tasks, calendarGaps,
    todayJobs: todayJobs || [],
    generatedAt: now.toISOString(),
  }
}
