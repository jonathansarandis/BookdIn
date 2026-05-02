// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'

type Message = {
  id: string
  created_at: string
  sender_name: string
  sender_role: string
  content: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function JobMessages({
  jobId,
  businessId,
  senderName,
  initialMessages = [],
}: {
  jobId: string
  businessId: string
  senderName: string
  initialMessages?: Message[]
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `job_id=eq.${jobId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      job_id:      jobId,
      business_id: businessId,
      sender_id:   (await supabase.auth.getUser()).data.user?.id,
      sender_name: senderName,
      sender_role: 'owner',
      content:     text.trim(),
    })
    setText('')
    setSending(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Messages</h2>

      {/* Message log */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No messages yet</p>
        ) : messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.sender_role === 'owner' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${msg.sender_role === 'owner' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
              <div className={`text-xs font-semibold mb-0.5 ${msg.sender_role === 'owner' ? 'text-blue-100' : 'text-gray-500'}`}>
                {msg.sender_name} · {fmtDate(msg.created_at)} {fmtTime(msg.created_at)}
              </div>
              <p className="text-sm leading-snug">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Send input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Type a message…"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  )
}
