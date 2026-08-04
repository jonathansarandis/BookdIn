'use client'
import { useState, useEffect } from 'react'
import { BarChart2, MessageSquare, DollarSign, ListChecks } from 'lucide-react'

export default function AgentDailySummary() {
  const [log, setLog] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agent/daily-log')
      .then(r => r.ok ? r.json() : null)
      .then(data => setLog(data?.log || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 animate-pulse">
        <div className="h-4 w-40 bg-gray-100 rounded" />
      </div>
    )
  }

  const messagesSent = log?.messages_sent?.length || 0
  const tasksActioned = log?.tasks_actioned?.length || 0
  const hasEodSummary = !!log?.notes

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Today's performance</h2>
        </div>
        {!hasEodSummary && <span className="text-xs text-gray-400">Full summary after 6pm</span>}
      </div>

      {hasEodSummary ? (
        <div className="px-5 py-4 text-sm text-gray-700 leading-relaxed">{log.notes}</div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <ListChecks className="w-3.5 h-3.5" />
              <span className="text-xs">Tasks actioned</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{tasksActioned}</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-xs">Messages sent</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{messagesSent}</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 text-gray-400 mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs">Revenue recovered</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {log?.revenue_recovered ? `$${Number(log.revenue_recovered).toFixed(0)}` : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
