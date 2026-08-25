'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Send, RefreshCw, AlertCircle, CheckCircle2, Loader2, TrendingUp, TrendingDown, Calendar, CreditCard, UserX, PhoneCall, X } from 'lucide-react'
import AgentMessageModal from '@/components/AgentMessageModal'
import AgentIcon from '@/components/AgentIcon'

interface Task {
  id: string; type: string; priority: 'urgent' | 'high' | 'medium'
  title: string; subtitle: string; action: string
  jobId?: string; quoteId?: string; contactId?: string; crmStage?: string
  customerId?: string; customerName?: string; customerPhone?: string; customerEmail?: string
  amount?: number; jobDate?: string; quoteTotal?: number; quoteSentAt?: string; daysSinceCreated?: number
  date?: string
}
interface Message { role: 'user' | 'assistant'; content: string; timestamp: string }

const PRIORITY_COLORS = {
  urgent: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  high: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  medium: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' },
}
const TASK_ICONS: Record<string, any> = { chase_payment: CreditCard, assign_provider: UserX, follow_up_lead: PhoneCall, fill_calendar: Calendar }
const CRM_STAGE_LABELS: Record<string, string> = { lead: 'Lead', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' }
const CRM_STAGE_COLORS: Record<string, string> = { lead: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-50 text-blue-700', quoted: 'bg-purple-50 text-purple-700', won: 'bg-green-50 text-green-700', lost: 'bg-red-50 text-red-700' }
function formatCurrency(cents: number) { return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 0 })}` }
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mt-3 mb-1 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mt-3 mb-1 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  code: ({ children }: any) => <code className="px-1 py-0.5 rounded bg-black/10 text-[13px]">{children}</code>,
  a: ({ children, href }: any) => <a href={href} target="_blank" rel="noreferrer" className="underline">{children}</a>,
}

const QUICK_ACTIONS = ['How much revenue this week?', 'Who owes payment?', "What's on today?", 'How busy next week?', 'Who needs a follow up?', 'What should I focus on?']

export default function AgentPage() {
  const [brief, setBrief] = useState<any>(null)
  const [loadingBrief, setLoadingBrief] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [briefSent, setBriefSent] = useState(false)
  const [messageTask, setMessageTask] = useState<Task | null>(null)
  const [outcomeNote, setOutcomeNote] = useState('')
  const [loggingOutcome, setLoggingOutcome] = useState(false)
  const [outcomeLogged, setOutcomeLogged] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBrief() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadBrief() {
    setLoadingBrief(true)
    try {
      const res = await fetch('/api/agent/brief')
      const data = await res.json()
      setBrief(data)
      if (!briefSent && data.summary) {
        setBriefSent(true)
        await sendMsg('Give me my morning brief based on the current data.', data.summary, true)
      }
    } catch (e) { console.error(e) } finally { setLoadingBrief(false) }
  }

  async function sendMsg(userContent: string, ctx?: any, isInit = false) {
    const newMsg: Message = { role: 'user', content: userContent, timestamp: new Date().toISOString() }
    const history = isInit ? [newMsg] : [...messages, newMsg]
    if (!isInit) setMessages(history)
    setSending(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, briefContext: ctx || brief?.summary }),
      })
      const data = await res.json()
      const reply: Message = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }
      setMessages(isInit ? [reply] : [...history, reply])
    } catch (e) { console.error(e) } finally { setSending(false) }
  }

  function handleSend() { if (!input.trim() || sending) return; const m = input.trim(); setInput(''); sendMsg(m) }
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }
  function handleAction(task: Task) {
    if (task.type === 'chase_payment' || task.type === 'follow_up_lead') {
      setMessageTask(task)
    } else if (task.jobId) {
      window.open(`/jobs/${task.jobId}`, '_blank')
    } else if (task.type === 'fill_calendar') {
      window.open('/calendar', '_blank')
    }
  }

  function handleMessageSent(contactId: string | null) {
    if (!contactId) return
    setBrief((prev: any) => prev ? { ...prev, tasks: prev.tasks.map((t: any) => t.contactId === contactId ? { ...t, crmStage: 'contacted' } : t) } : prev)
  }

  function handleDismiss(task: Task) {
    setDismissed(p => new Set([...p, task.id]))
    fetch('/api/agent/dismiss-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, taskType: task.type, taskTitle: task.title }),
    }).catch(err => console.error('Agent page: failed to log dismissed task', err))
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
      console.error('Agent page: failed to log outcome', err)
    } finally {
      setLoggingOutcome(false)
    }
  }

  const activeTasks = (brief?.tasks || []).filter((t: Task) => !dismissed.has(t.id))
  const urgentCount = activeTasks.filter((t: Task) => t.priority === 'urgent').length

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-3 p-4 lg:p-6 overflow-hidden">
      <Link href="/dashboard" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0 w-fit">
        <ChevronLeft className="w-3.5 h-3.5" /> Dashboard
      </Link>
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <AgentIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{brief?.businessName ? `${brief.businessName} AI Agent` : 'AI Agent'}</h1>
            <p className="text-xs text-gray-400">Daily operations coach · Powered by Claude</p>
          </div>
        </div>
        <button onClick={loadBrief} disabled={loadingBrief} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loadingBrief ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {brief?.summary?.googleAds?.error && (
        <Link
          href="/settings?tab=integrations"
          className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100 transition-colors flex-shrink-0"
        >
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="flex-1">Google Ads connection lost — no ad data coming through. Reconnect now.</span>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
        </Link>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto">
          {brief?.summary && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Pending Payment', value: brief.summary.pendingPaymentCount, sub: `${formatCurrency(brief.summary.pendingPaymentValue)} at risk`, color: 'text-red-600' },
                { label: 'This Week Revenue', value: formatCurrency(brief.summary.thisWeekRevenue), sub: `${brief.summary.revenueChange >= 0 ? '+' : ''}${brief.summary.revenueChange}% vs last week`, color: 'text-gray-900' },
                { label: "Today's Jobs", value: brief.summary.todayJobCount, sub: `${brief.summary.unassignedCount} unassigned`, color: 'text-gray-900' },
                { label: 'Next 7 Days', value: brief.summary.nextWeekJobCount, sub: 'jobs confirmed', color: 'text-gray-900' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">What needs you</h2>
                <p className="text-xs text-gray-400">Surfaced by AI · you approve</p>
              </div>
              {urgentCount > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">{urgentCount} urgent</span>}
            </div>
            {loadingBrief ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
            ) : activeTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">All clear</p>
                <p className="text-xs text-gray-400 mt-1">No urgent actions right now</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: '400px' }}>
                {activeTasks.map((task: Task) => {
                  const colors = PRIORITY_COLORS[task.priority]
                  const Icon = TASK_ICONS[task.type] || AlertCircle
                  return (
                    <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${colors.bg}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          {task.crmStage && (
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${CRM_STAGE_COLORS[task.crmStage] || 'bg-gray-100 text-gray-600'}`}>
                              {CRM_STAGE_LABELS[task.crmStage] || task.crmStage}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{task.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleDismiss(task)} className="text-gray-300 hover:text-gray-500"><X className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleAction(task)} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg" style={{ background: '#0A0F1E' }}>{task.action}</button>
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
        </div>

        <div className="lg:col-span-3 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <AgentIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{brief?.businessName ? `${brief.businessName} Agent` : 'AI Agent'}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-gray-400">Online · {getGreeting()}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
                  <AgentIcon className="w-7 h-7 text-indigo-600" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Analysing your business data...</p>
                <p className="text-xs text-gray-400">Brief loading from BookdIn</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-1 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                    <AgentIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'}`}>
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                  <p className="text-[10px] mt-1.5 text-gray-400">{new Date(msg.timestamp).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-1 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  <AgentIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a} onClick={() => sendMsg(a)} disabled={sending} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full disabled:opacity-50 whitespace-nowrap">
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask anything or report back results..." className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none" disabled={sending} />
              <button onClick={handleSend} disabled={!input.trim() || sending} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: input.trim() && !sending ? '#0A0F1E' : '#e5e7eb' }}>
                {sending ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
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
