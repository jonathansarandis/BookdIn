// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Phone, Mail, Clock, Users, Trash2 } from 'lucide-react'
import LostReasonModal from '@/components/crm/LostReasonModal'
import ConfirmDeleteModal from '@/components/crm/ConfirmDeleteModal'

const STAGES = [
  { key: 'lead',      label: 'Lead',      color: '#6b7280' },
  { key: 'contacted', label: 'Contacted', color: '#2563FF' },
  { key: 'quoted',    label: 'Quoted',    color: '#7c3aed' },
  { key: 'won',       label: 'Won',       color: '#16a34a' },
  { key: 'lost',      label: 'Lost',      color: '#dc2626' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function getInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lostModalContact, setLostModalContact] = useState<any>(null)
  const [deleteModalContact, setDeleteModalContact] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => { fetchContacts() }, [])

  async function fetchContacts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('business_id', profile?.business_id)
      .order('last_activity_at', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }

  async function moveStage(contactId: string, newStage: string, lostReason?: string, lostReasonNotes?: string) {
    await supabase.from('crm_contacts').update({
      stage: newStage,
      last_activity_at: new Date().toISOString(),
      ...(newStage === 'lost' ? { lost_reason: lostReason || null, lost_reason_notes: lostReasonNotes || null } : {}),
    }).eq('id', contactId)
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, stage: newStage } : c))
  }

  function handleStageButtonClick(contact: any, newStage: string) {
    if (newStage === 'lost') { setLostModalContact(contact); return }
    moveStage(contact.id, newStage)
  }

  async function deleteContact(contactId: string) {
    // Only the CRM record — the linked customer row (if any) is untouched.
    await supabase.from('crm_activities').delete().eq('contact_id', contactId)
    await supabase.from('crm_contacts').delete().eq('id', contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const contactsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.key] = contacts.filter(c => c.stage === stage.key)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reports/leads" className="text-sm text-gray-500 hover:text-brand-600 transition-colors">
            Leads report →
          </Link>
          <Link href="/crm/new" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#2563FF', textDecoration: 'none' }}>
            <Plus className="w-4 h-4" /> Add contact
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(37,99,255,0.08)' }}>
            <Users className="w-7 h-7" style={{ color: '#2563FF' }} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No contacts yet</h3>
          <p className="text-sm text-gray-400 mb-5">Add leads and track them through your pipeline</p>
          <Link href="/crm/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#2563FF', textDecoration: 'none' }}>
            <Plus className="w-4 h-4" /> Add first contact
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {STAGES.map(stage => {
            const stageContacts = contactsByStage[stage.key] || []
            return (
              <div key={stage.key} className="flex-shrink-0 w-68" style={{ width: '272px' }}>
                {/* Sticky so the stage name/count/add-contact stay visible while scrolling
                    down a long column of leads — was scrolling away with everything else,
                    making it hard to tell which stage you were looking at. */}
                <div className="sticky top-0 z-10 bg-gray-100 flex items-center justify-between mb-3 px-1 py-1.5 -mx-1">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-sm font-semibold text-gray-900">{stage.label}</span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{stageContacts.length}</span>
                  </div>
                  <Link href={`/crm/new?stage=${stage.key}`} className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 transition-all" style={{ textDecoration: 'none' }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {stageContacts.map(contact => (
                    <div key={contact.id} className="relative group/card bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-all">
                      <button
                        onClick={() => setDeleteModalContact(contact)}
                        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/card:opacity-100 transition-all"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link href={`/crm/${contact.id}`} style={{ textDecoration: 'none' }}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: stage.color }}>
                            {getInitials(contact.full_name)}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <p className="text-sm font-semibold text-gray-900 truncate">{contact.full_name}</p>
                            {contact.company && <p className="text-xs text-gray-400 truncate">{contact.company}</p>}
                          </div>
                        </div>
                        <div className="space-y-1 mb-3">
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="w-3 h-3 text-gray-400" />{contact.phone}
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Mail className="w-3 h-3 text-gray-300" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {contact.last_activity_at ? timeAgo(contact.last_activity_at) : 'No activity'}
                          </div>
                          {contact.next_followup_at && new Date(contact.next_followup_at) < new Date() && (
                            <span className="text-xs text-amber-600 font-medium">Follow up due</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex gap-1 mt-2 pt-2 border-t border-gray-50">
                        {STAGES.filter(s => s.key !== stage.key).map(s => (
                          <button key={s.key} onClick={() => handleStageButtonClick(contact, s.key)}
                            className="flex-1 text-[10px] py-1 rounded-md font-medium transition-all"
                            style={{ background: `${s.color}15`, color: s.color }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageContacts.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-300">No contacts</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lostModalContact && (
        <LostReasonModal
          contactName={lostModalContact.full_name}
          onCancel={() => setLostModalContact(null)}
          onConfirm={async (reason, notes) => {
            await moveStage(lostModalContact.id, 'lost', reason, notes)
            setLostModalContact(null)
          }}
        />
      )}

      {deleteModalContact && (
        <ConfirmDeleteModal
          title="Delete contact?"
          message={`This permanently deletes ${deleteModalContact.full_name} and their activity history from the CRM. This does not affect any linked customer record.`}
          onCancel={() => setDeleteModalContact(null)}
          onConfirm={async () => {
            await deleteContact(deleteModalContact.id)
            setDeleteModalContact(null)
          }}
        />
      )}
    </div>
  )
}
