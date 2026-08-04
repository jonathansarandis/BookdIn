'use client'
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, X, CreditCard, UserX, PhoneCall, Calendar, ChevronRight, AlertCircle, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'

const TASK_ICONS: Record<string, any> = { chase_payment: CreditCard, assign_provider: UserX, follow_up_lead: PhoneCall, fill_calendar: Calendar }
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400' }
const QUICK_ACTIONS = ['Who owes payment?', "What's on today?", 'How busy next week?']

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="whitespace-pre-wrap mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
}

interface Message { role: 'user' | 'assistant'; content: string }

export default function AgentWidget() {
  const [brief, setBrief] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const [messages, setMessages] = useState<Message[]>([])
  const [greetingLoading, setGreetingLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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

  const tasks = (brief.tasks || []).filter((t: any) => !dismissed.has(t.id)).slice(0, 4)
  const urgentCount = (brief.tasks || []).filter((t: any) => t.priority === 'urgent' && !dismissed.has(t.id)).length

  function handleAction(task: any) {
    if (task.jobId) window.open(`/jobs/${task.jobId}`, '_blank')
    else if (task.quoteId) window.open(`/quotes/${task.quoteId}`, '_blank')
    else window.open('/calendar', '_blank')
  }

  return (
    <div className="space-y-3">
      {/* Chat panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#0A0F1E' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.3)' }}>
              <Bot className="w-4 h-4 text-indigo-300" />
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
              const Icon = TASK_ICONS[task.type] || Bot
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 truncate">{task.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setDismissed(p => new Set([...p, task.id]))} className="text-gray-300 hover:text-gray-400">
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
      </div>
    </div>
  )
}
