// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Phone, Mail, Clock } from 'lucide-react'

const STAGES = [
  { key: 'lead',      label: 'Lead',      color: 'bg-gray-100 text-gray-600' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700' },
  { key: 'quoted',    label: 'Quoted',    color: 'bg-purple-50 text-purple-700' },
  { key: 'won',       label: 'Won',       color: 'bg-green-50 text-green-700' },
  { key: 'lost',      label: 'Lost',      color: 'bg-red-50 text-red-700' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date()
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchContacts() }, [])

  async function fetchContacts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()

    setBusinessId(profile?.business_id)

    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('business_id', profile?.business_id)
      .order('last_activity_at', { ascending: false })

    setContacts(data || [])
    setLoading(false)
  }

  const contactsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.key] = contacts.filter(c => c.stage === stage.key)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
        </div>
        <Link
          href="/crm/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add contact
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="grid grid-cols-5 gap-4 min-h-[600px]">
          {STAGES.map(stage => (
            <div key={stage.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {contactsByStage[stage.key]?.length || 0}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {contactsByStage[stage.key]?.map(contact => (
                  <Link
                    key={contact.id}
                    href={`/crm/${contact.id}`}
                    className="bg-white rounded-lg border border-gray-200 p-3 hover:border-brand-300 hover:shadow-sm transition-all space-y-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate">{contact.full_name}</p>
                      {contact.source && (
                        <p className="text-xs text-gray-400 capitalize">{contact.source}</p>
                      )}
                    </div>

                    {(contact.email || contact.phone) && (
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {timeAgo(contact.last_activity_at)}
                      </span>
                      {contact.next_followup_at && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${
                          isOverdue(contact.next_followup_at) ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {isOverdue(contact.next_followup_at) ? 'Overdue' : 'Follow up'}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}

                {contactsByStage[stage.key]?.length === 0 && (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400">No contacts</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
