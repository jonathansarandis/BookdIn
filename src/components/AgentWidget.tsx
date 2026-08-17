'use client'
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { X, CreditCard, UserX, PhoneCall, Calendar, ChevronRight, AlertCircle, Send, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import AgentMessageModal from './AgentMessageModal'
import AgentIcon from './AgentIcon'

const TASK_ICONS: Record<string, any> = { chase_payment: CreditCard, assign_provider: UserX, follow_up_lead: PhoneCall, fill_calendar: Calendar, voice_call_notes: PhoneCall }
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400' }
const CRM_STAGE_LABELS: Record<string, string> = { lead: 'Lead', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' }
const CRM_STAGE_COLORS: Record<string, string> = { lead: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-50 text-blue-700', quoted: 'bg-purple-50 text-purple-700', won: 'bg-green-50 text-green-700', lost: 'bg-red-50 text-red-700' }
const QUICK_ACTIONS = ['Who owes payment?', "What's on today?", 'How busy next week?', 'Who needs a follow up?']

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="whitespace-pre-wrap mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
}

interface Message { role: 'user' | 'assistant'; content: string }

// The compact dashboard widget only has room for a handful of tasks, but buildAgentBrief
// pushes chase_payment tasks in first — so whenever there are 4+ unpaid jobs (common), a
// plain slice(0, 4) shows nothing but payment chases and lead follow-ups never surface,
// even though they're sitting right behind them in brief.tasks. Pick a priority-sorted but
// type-diverse top N instead, capping how many of one task type can crowd the visible list.
function pickDiverseTasks(all: any[], limit: number, maxPerType: number) {
  const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2 }
  const sorted = [...all].sort((a, b) => (priorityWeight[a.priority] ?? 3) - (priorityWeight[b.priority] ?? 3))
  const counts: Record<string, number> = {}
  const picked: any[] = []
  const overflow: any[] = []
  for (const t of sorted) {
    if (picked.length >= limit) { overflow.push(t); continue }
    const c = counts[t.type] || 0
    if (c < maxPerType) {
      picked.push(t)
      counts[t.type] = c + 1
    } else {
      overflow.push(t)
    }
  }
  // If capping left empty slots (e.g. fewer distinct types than the cap allows), backfill
  // from overflow so we still show `limit` tasks whenever that many exist.
  for (const t of overflow) {
    if (picked.length >= limit) break
    picked.push(t)
  }
  return picked
}

export default function AgentWidget() {
  const [brief, setBrief] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const [messages, setMessages] = useState<Message[]>([])
  const [greetingLoading, setGreetingLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messageTask, setMessageTask] = useState<any>(null)
  const [outcomeNote, setOutcomeNote] = useState('')
  const [loggingOutcome, setLoggingOutcome] = useState(false)
  const [outcomeLogged, setOutcomeLogged] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/agent/brief')
      .then(r => {
        if (!r.ok) throw new Error(`Agent brief request failed: ${r.status}`)
        return r.json()
      })
      .then(data => {
        setBrief(data)
        loadGreeting(data.summary)
      })
      .catch(err => {
        console.error('AgentWidget: failed to load brief', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, sending])

  async function loadGreeting(summary: any) {
    setGreetingLoading(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: "Give me a very brief morning greeting (2-3 sentences max) highlighting the single most urgent thing to do today, based on the live data. Be direct and conversational, like a colleague who already looked at the numbers." }],
          briefContext: summary,
        }),
      })
      const data = await res.json()
      // Guard against the greeting resolving after the user has already started chatting
      setMessages(prev => prev.length === 0 ? [{ role: 'assistant', content: data.reply }] : prev)
    } catch (err) {
      console.error('AgentWidget: failed to load greeting', err)
    } finally {
      setGreetingLoading(false)
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return
    const history: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, briefContext: brief?.summary }),
      })
      const data = await res.json()
      setMessages([...history, { role: 'assistant', content: data.reply }])
    } catch (err) {
      console.error('AgentWidget: failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  function handleSend() { if (!input.trim() || sending) return; const m = input.trim(); setInput(''); sendMessage(m) }
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-2.5 text-sm text-gray-400">
        <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
        AI Agent is unavailable right now.
      </div>
    )
  }

  const tasks = pickDiverseTasks((brief.tasks || []).filter((t: any) => !dismissed.has(t.id)), 4, 2)
  const urgentCount = (brief.tasks || []).filter((t: any) => t.priority === 'urgent' && !dismissed.has(t.id)).length

  function handleAction(task: any) {
    if (task.type === 'chase_payment' || task.type === 'follow_up_lead') {
      setMessageTask(task)
    } else if (task.type === 'voice_call_notes' && task.callId) {
      window.open(`/voice/${task.callId}`, '_blank')
    } else if (task.jobId) {
      window.open(`/jobs/${task.jobId}`, '_blank')
    } else {
      window.open('/calendar', '_blank')
    }
  }

  function handleMessageSent(contactId: string | null) {
    if (!contactId) return
    setBrief((prev: any) => prev ? { ...prev, tasks: prev.tasks.map((t: any) => t.contactId === contactId ? { ...t, crmStage: 'contacted' } : t) } : prev)
  }

  function handleDismiss(task: any) {
    setDismissed(p => new Set([...p, task.id]))
    fetch('/api/agent/dismiss-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, taskType: task.type, taskTitle: task.title }),
    }).catch(err => console.error('AgentWidget: failed to log dismissed task', err))
  }

  async function handleLogOutcome() {
    if (!outcomeNote.trim() || loggingOutcome) return
    setLoggingOutcome(true)
    try {
      const res = await fetch('/api/agent/log-outcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: outcomeNote.trim() }),
      })
      if (!res.ok) throw new Error(`Log failed: ${res.status}`)
      setOutcomeNote('')
      setOutcomeLogged(true)
      setTimeout(() => setOutcomeLogged(false), 3000)
    } catch (err) {
      console.error('AgentWidget: failed to log outcome', err)
    } finally {
      setLoggingOutcome(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Chat panel */}
      <div className="agent-widget-dark rounded-xl overflow-hidden" style={{ background: '#0A0F1E' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.3)' }}>
              <AgentIcon className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AI Agent</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-gray-400">Online</p>
              </div>
            </div>
          </div>
          <Link href="/agent" className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors" style={{ textDecoration: 'none' }}>
            Open agent <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
          {greetingLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing your business data...
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={msg.role === 'user'
                    ? { background: 'rgba(37,99,255,0.25)', color: '#F0F2FF', borderBottomRightRadius: '4px' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#E8EEF8', borderBottomLeftRadius: '4px' }}
                >
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: '4px' }}>
                <div className="flex items-center gap-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything..."
              disabled={sending}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: input.trim() && !sending ? '#2563FF' : 'rgba(255,255,255,0.08)' }}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
            </button>
          </div>
        </div>

        <div className="px-5 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a}
              onClick={() => sendMessage(a)}
              disabled={sending}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full disabled:opacity-50 whitespace-nowrap transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#C9D3E8' }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Task panel */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">What needs you</h2>
            <p className="text-xs text-gray-400">Surfaced by AI · you approve</p>
          </div>
          {urgentCount > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">{urgentCount} urgent</span>}
        </div>
        {tasks.length === 0 ? (
          <div className="px-5 py-4 text-sm text-gray-400">No urgent actions right now.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tasks.map((task: any) => {
              const Icon = TASK_ICONS[task.type] || AlertCircle
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      {task.crmStage && (
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${CRM_STAGE_COLORS[task.crmStage] || 'bg-gray-100 text-gray-600'}`}>
                          {CRM_STAGE_LABELS[task.crmStage] || task.crmStage}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{task.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleDismiss(task)} className="text-gray-300 hover:text-gray-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleAction(task)} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors" style={{ background: '#0A0F1E' }}>
                      {task.action}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
          <input
            value={outcomeNote}
            onChange={e => setOutcomeNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogOutcome() }}
            placeholder="Report an outcome (e.g. chased 12 payments, 8 converted)"
            disabled={loggingOutcome}
            className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <button
            onClick={handleLogOutcome}
            disabled={!outcomeNote.trim() || loggingOutcome}
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5"
            style={{ background: outcomeLogged ? '#16a34a' : '#0A0F1E' }}
          >
            {loggingOutcome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : outcomeLogged ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {outcomeLogged ? 'Logged' : 'Log'}
          </button>
        </div>
      </div>

      {messageTask && (
        <AgentMessageModal
          task={messageTask}
          onClose={() => setMessageTask(null)}
          onSent={handleMessageSent}
        />
      )}
    </div>
  )
}
