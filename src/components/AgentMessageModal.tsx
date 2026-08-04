'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, MessageSquare, Mail, CheckCircle2, AlertCircle, Send } from 'lucide-react'

export interface AgentMessageTask {
  id: string
  type: string
  title: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerId?: string
  contactId?: string
  amount?: number
  jobDate?: string
  quoteTotal?: number
  quoteSentAt?: string
  daysSinceCreated?: number
}

interface Props {
  task: AgentMessageTask
  onClose: () => void
  onSent?: (contactId: string | null) => void
}

export default function AgentMessageModal({ task, onClose, onSent }: Props) {
  const [draftLoading, setDraftLoading] = useState(true)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [sms, setSms] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const [smsState, setSmsState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [smsError, setSmsError] = useState<string | null>(null)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDraftLoading(true)
    setDraftError(null)
    fetch('/api/agent/draft-message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: task.type,
        context: {
          customerName: task.customerName,
          amount: task.amount,
          jobDate: task.jobDate,
          quoteTotal: task.quoteTotal,
          quoteSentAt: task.quoteSentAt,
          daysSinceCreated: task.daysSinceCreated,
        },
      }),
    })
      .then(r => { if (!r.ok) throw new Error(`Draft request failed: ${r.status}`); return r.json() })
      .then(data => {
        if (cancelled) return
        setSms(data.sms || '')
        setEmailSubject(data.emailSubject || '')
        setEmailBody(data.emailBody || '')
      })
      .catch(err => { if (!cancelled) setDraftError(err.message || 'Failed to draft message') })
      .finally(() => { if (!cancelled) setDraftLoading(false) })
    return () => { cancelled = true }
  }, [task.id])

  async function sendChannel(channel: 'sms' | 'email') {
    const setState = channel === 'sms' ? setSmsState : setEmailState
    const setError = channel === 'sms' ? setSmsError : setEmailError
    setState('sending')
    setError(null)
    try {
      const res = await fetch('/api/agent/send-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          taskId: task.id,
          taskType: task.type,
          taskTitle: task.title,
          amount: task.amount,
          contactId: task.contactId,
          customerId: task.customerId,
          customerName: task.customerName,
          customerPhone: task.customerPhone,
          customerEmail: task.customerEmail,
          to: channel === 'sms' ? task.customerPhone : task.customerEmail,
          text: channel === 'sms' ? sms : undefined,
          emailSubject: channel === 'email' ? emailSubject : undefined,
          emailBody: channel === 'email' ? emailBody : undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`)
      setState('sent')
      onSent?.(data?.contactId ?? null)
    } catch (err: any) {
      setState('error')
      setError(err.message || 'Send failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Drafted by AI · review before sending</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {draftLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Drafting message...
            </div>
          ) : draftError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {draftError}
            </div>
          ) : (
            <>
              {/* SMS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    <MessageSquare className="w-3.5 h-3.5" /> SMS
                  </label>
                  <span className="text-xs text-gray-400">{task.customerPhone || 'No phone on file'}</span>
                </div>
                <textarea
                  value={sms}
                  onChange={e => setSms(e.target.value)}
                  rows={3}
                  disabled={smsState === 'sending' || smsState === 'sent'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{sms.length} characters</span>
                  <button
                    onClick={() => sendChannel('sms')}
                    disabled={!task.customerPhone || !sms.trim() || smsState === 'sending' || smsState === 'sent'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background: smsState === 'sent' ? '#16a34a' : '#0A0F1E' }}
                  >
                    {smsState === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {smsState === 'sent' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {smsState === 'idle' || smsState === 'error' ? <Send className="w-3.5 h-3.5" /> : null}
                    {smsState === 'sent' ? 'Sent' : smsState === 'sending' ? 'Sending...' : 'Send SMS'}
                  </button>
                </div>
                {!task.customerPhone && <p className="text-xs text-amber-600">No phone number on file for this contact.</p>}
                {smsState === 'error' && <p className="text-xs text-red-600">{smsError}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <span className="text-xs text-gray-400">{task.customerEmail || 'No email on file'}</span>
                </div>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  disabled={emailState === 'sending' || emailState === 'sent'}
                  placeholder="Subject"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={6}
                  disabled={emailState === 'sending' || emailState === 'sent'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                />
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => sendChannel('email')}
                    disabled={!task.customerEmail || !emailBody.trim() || emailState === 'sending' || emailState === 'sent'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background: emailState === 'sent' ? '#16a34a' : '#0A0F1E' }}
                  >
                    {emailState === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {emailState === 'sent' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {emailState === 'idle' || emailState === 'error' ? <Send className="w-3.5 h-3.5" /> : null}
                    {emailState === 'sent' ? 'Sent' : emailState === 'sending' ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
                {!task.customerEmail && <p className="text-xs text-amber-600">No email address on file for this contact.</p>}
                {emailState === 'error' && <p className="text-xs text-red-600">{emailError}</p>}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            {smsState === 'sent' || emailState === 'sent' ? 'Done' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  )
}
