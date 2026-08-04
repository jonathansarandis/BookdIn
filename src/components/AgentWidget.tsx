'use client'
import { useState, useEffect } from 'react'
import { Bot, X, CreditCard, UserX, PhoneCall, Calendar, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const TASK_ICONS: Record<string, any> = { chase_payment: CreditCard, assign_provider: UserX, follow_up_lead: PhoneCall, fill_calendar: Calendar }
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400' }

export default function AgentWidget() {
  const [brief, setBrief] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/agent/brief')
      .then(r => {
        if (!r.ok) throw new Error(`Agent brief request failed: ${r.status}`)
        return r.json()
      })
      .then(setBrief)
      .catch(err => {
        console.error('AgentWidget: failed to load brief', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #0A0F1E, #1a1f3e)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.3)' }}>
            <Bot className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Agent</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <p className="text-xs text-gray-400">
                {urgentCount > 0 ? `${urgentCount} urgent action${urgentCount > 1 ? 's' : ''}` : 'All clear'}
              </p>
            </div>
          </div>
        </div>
        <Link href="/agent" className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors" style={{ textDecoration: 'none' }}>
          Open agent <ChevronRight className="w-3.5 h-3.5" />
        </Link>
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
  )
}
