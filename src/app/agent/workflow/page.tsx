'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, Loader2, LogOut, Send, AlertCircle,
  CreditCard, UserX, PhoneCall, Calendar, PartyPopper,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AgentMessageModal from '@/components/AgentMessageModal'

interface Task {
  id: string; type: string; priority: 'urgent' | 'high' | 'medium'
  title: string; subtitle: string; action: string
  jobId?: string; contactId?: string; crmStage?: string
  customerId?: string; customerName?: string; customerPhone?: string; customerEmail?: string
  amount?: number; jobDate?: string; quoteTotal?: number; quoteSentAt?: string; daysSinceCreated?: number
}

const TASK_ICONS: Record<string, any> = { chase_payment: CreditCard, assign_provider: UserX, follow_up_lead: PhoneCall, fill_calendar: Calendar }
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400' }
const CRM_STAGE_LABELS: Record<string, string> = { lead: 'Lead', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' }
const CRM_STAGE_COLORS: Record<string, string> = { lead: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-50 text-blue-700', quoted: 'bg-purple-50 text-purple-700', won: 'bg-green-50 text-green-700', lost: 'bg-red-50 text-red-700' }

export default function WorkflowPage() {
  const [brief, setBrief] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [messageTask, setMessageTask] = useState<Task | null>(null)

  const [eodSummary, setEodSummary] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const [briefRes, logRes] = await Promise.all([
        fetch('/api/agent/brief'),
        fetch('/api/agent/daily-log'),
      ])
      if (!briefRes.ok) throw new Error(`Brief request failed: ${briefRes.status}`)
      const briefData = await briefRes.json()
      const logData = logRes.ok ? await logRes.json() : null
      setBrief(briefData)

      // A task counts as done if it was already actioned or messaged today —
      // same dedup logic as the eod-summary cron (tasks_actioned ∪ messages_sent by taskId).
      const log = logData?.log
      const done = new Set<string>()
      for (const t of log?.tasks_actioned || []) if (t.taskId) done.add(t.taskId)
      for (const m of log?.messages_sent || []) if (m.taskId) done.add(m.taskId)
      setDoneIds(done)
      if (log?.notes) setEodSummary(log.notes)
    } catch (err) {
      console.error('WorkflowPage: failed to load', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function handleAction(task: Task) {
    if (task.type === 'chase_payment' || task.type === 'follow_up_lead') {
      setMessageTask(task)
    } else if (task.jobId) {
      window.open(`/jobs/${task.jobId}`, '_blank')
    } else {
      window.open('/calendar', '_blank')
    }
  }

  function handleMessageSent(task: Task) {
    setDoneIds(prev => new Set([...prev, task.id]))
  }

  async function handleComplete(task: Task) {
    if (doneIds.has(task.id) || completingId) return
    setCompletingId(task.id)
    setDoneIds(prev => new Set([...prev, task.id]))
    try {
      const res = await fetch('/api/agent/complete-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, taskType: task.type, taskTitle: task.title, note: notes[task.id] }),
      })
      if (!res.ok) throw new Error(`Complete failed: ${res.status}`)
    } catch (err) {
      console.error('WorkflowPage: failed to log completed task', err)
      setDoneIds(prev => { const next = new Set(prev); next.delete(task.id); return next })
    } finally {
      setCompletingId(null)
    }
  }

  async function handleReport() {
    if (!eodSummary.trim() || reporting) return
    setReporting(true)
    try {
      const res = await fetch('/api/agent/report-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: eodSummary.trim() }),
      })
      if (!res.ok) throw new Error(`Report failed: ${res.status}`)
      setReported(true)
    } catch (err) {
      console.error('WorkflowPage: failed to report summary', err)
    } finally {
      setReporting(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const todayLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  const tasks: Task[] = brief?.tasks || []
  const doneCount = tasks.filter(t => doneIds.has(t.id)).length
  const totalCount = tasks.length
  const allDone = totalCount === 0 || doneCount === totalCount
  const progressPct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-500">Couldn't load today's checklist.</p>
        <button onClick={load} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: '#0A0F1E' }}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Daily Checklist</h1>
            <p className="text-sm text-gray-500">{todayLabel}</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {doneCount} of {totalCount} task{totalCount === 1 ? '' : 's'} complete
            </p>
            <span className="text-xs font-semibold text-gray-400">{progressPct}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, background: allDone ? '#16a34a' : '#2563FF' }}
            />
          </div>
        </div>

        {/* Task list */}
        {totalCount === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Nothing needs attention today</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map(task => {
              const Icon = TASK_ICONS[task.type] || AlertCircle
              const isDone = doneIds.has(task.id)
              const isCompleting = completingId === task.id
              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-xl px-4 py-3.5 transition-colors ${isDone ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleComplete(task)}
                      disabled={isDone || isCompleting}
                      className="flex-shrink-0 mt-0.5"
                      aria-label={isDone ? 'Completed' : 'Mark complete'}
                    >
                      {isCompleting ? (
                        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <div className={`w-5 h-5 rounded-full border-2 ${PRIORITY_DOT[task.priority]?.replace('bg-', 'border-') || 'border-gray-300'}`} />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                        {task.crmStage && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${CRM_STAGE_COLORS[task.crmStage] || 'bg-gray-100 text-gray-600'}`}>
                            {CRM_STAGE_LABELS[task.crmStage] || task.crmStage}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{task.subtitle}</p>

                      {!isDone && (
                        <div className="flex flex-col sm:flex-row gap-2 mt-2.5">
                          <input
                            value={notes[task.id] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                            placeholder="Notes (optional) — what happened?"
                            className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleAction(task)}
                              className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold text-white rounded-lg"
                              style={{ background: '#0A0F1E' }}
                            >
                              {task.action}
                            </button>
                          </div>
                        </div>
                      )}
                      {isDone && notes[task.id] && (
                        <p className="text-xs text-gray-500 italic mt-1.5">"{notes[task.id]}"</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Completion screen */}
        {allDone && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-5 text-center border-b border-gray-100">
              <PartyPopper className="w-7 h-7 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-900">
                {totalCount === 0 ? "All clear for today" : "All tasks complete"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Wrap up with a quick summary for the owner</p>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={eodSummary}
                onChange={e => { setEodSummary(e.target.value); setReported(false) }}
                rows={4}
                placeholder="e.g. Chased 8 payments, 5 confirmed. Assigned 3 jobs. Followed up 4 leads, 2 booked."
                disabled={reporting}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
              />
              <button
                onClick={handleReport}
                disabled={!eodSummary.trim() || reporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: reported ? '#16a34a' : '#0A0F1E' }}
              >
                {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : reported ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {reported ? 'Reported to Jonathan' : 'Report to Jonathan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {messageTask && (
        <AgentMessageModal
          task={messageTask}
          onClose={() => setMessageTask(null)}
          onSent={() => { handleMessageSent(messageTask); setMessageTask(null) }}
        />
      )}
    </div>
  )
}
