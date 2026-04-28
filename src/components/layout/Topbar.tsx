// @ts-nocheck
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Search, LogOut, Plus, Phone, FileText, Calendar, CheckCircle2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'
import Link from 'next/link'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/calendar':     'Calendar',
  '/jobs':         'Bookings',
  '/customers':    'Customers',
  '/invoices':     'Invoices',
  '/quotes':       'Quotes',
  '/discounts':    'Discounts',
  '/reports':      'Reports',
  '/settings':     'Settings',
  '/integrations': 'Integrations',
  '/gift-cards':   'Gift Cards',
  '/referrals':    'Referrals',
  '/crm':          'CRM',
  '/services':     'Services',
  '/providers':    'Providers',
  '/recurring':    'Recurring',
  '/import':       'Import',
}

const NOTIF_ICONS: Record<string, any> = {
  call_prompt: Phone,
  follow_up:   Phone,
  booking:     Calendar,
  quote:       FileText,
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface TopbarProps {
  profile: Profile | null
  business: Business | null
}

export default function Topbar({ profile, business }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
  )?.[1] || 'bookdIn'

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchNotifications() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllAsRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
    setNotifications([])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const unreadCount = notifications.length

  return (
    <header
      className="h-16 flex items-center gap-3 px-5 flex-shrink-0"
      style={{ background: '#111827', borderBottom: '1px solid rgba(37,99,255,0.12)' }}
    >
      {/* Page title */}
      <h1 className="flex-1" style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '16px', color: '#F0F2FF', letterSpacing: '-0.2px' }}>
        {title}
      </h1>

      {/* Search */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.15)' }}
      >
        <Search style={{ width: '14px', height: '14px', color: 'rgba(200,212,240,0.4)' }} />
        <span style={{ fontSize: '12px', color: 'rgba(200,212,240,0.4)' }}>Search...</span>
        <kbd style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: 'rgba(200,212,240,0.3)', padding: '2px 6px', borderRadius: '4px', marginLeft: '24px', fontFamily: 'monospace' }}>⌘K</kbd>
      </div>

      {/* New booking */}
      <a
        href="/booking"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm font-medium"
        style={{ background: '#2563FF', color: '#fff', textDecoration: 'none' }}
      >
        <Plus style={{ width: '14px', height: '14px' }} />
        New booking
      </a>

      {/* Notifications */}
      <div className="relative" ref={notifsRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ background: showNotifs ? 'rgba(37,99,255,0.15)' : 'transparent', border: '1px solid rgba(37,99,255,0.15)' }}
        >
          <Bell style={{ width: '15px', height: '15px', color: 'rgba(200,212,240,0.6)' }} />
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center"
              style={{ top: '-4px', right: '-4px', width: '16px', height: '16px', background: '#2563FF', borderRadius: '50%', fontSize: '9px', color: '#fff', fontWeight: 700 }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div
            className="absolute right-0 top-11 z-50 overflow-hidden"
            style={{ width: '300px', background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(37,99,255,0.1)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0F2FF' }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} style={{ fontSize: '11px', color: '#4D8CFF', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 style={{ width: '28px', height: '28px', color: 'rgba(200,212,240,0.2)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', color: 'rgba(200,212,240,0.4)' }}>All caught up</p>
              </div>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.map(notif => {
                  const Icon = NOTIF_ICONS[notif.type] || Bell
                  const isCall = notif.type === 'call_prompt' || notif.type === 'follow_up'
                  return (
                    <div key={notif.id} className="px-4 py-3" style={{ borderBottom: '1px solid rgba(37,99,255,0.07)' }}>
                      <div className="flex gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: isCall ? 'rgba(245,158,11,0.15)' : 'rgba(37,99,255,0.15)', marginTop: '2px' }}
                        >
                          <Icon style={{ width: '13px', height: '13px', color: isCall ? '#F59E0B' : '#4D8CFF' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 500, color: '#F0F2FF', lineHeight: 1.4 }}>{notif.title}</p>
                          {notif.body && <p style={{ fontSize: '11px', color: 'rgba(200,212,240,0.5)', marginTop: '2px' }}>{notif.body}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span style={{ fontSize: '10px', color: 'rgba(200,212,240,0.35)' }}>{timeAgo(notif.created_at)}</span>
                            <div className="flex gap-2">
                              {notif.action_url && (
                                <Link href={notif.action_url} onClick={() => { markAsRead(notif.id); setShowNotifs(false) }}
                                  style={{ fontSize: '10px', color: '#4D8CFF', textDecoration: 'none' }}>
                                  View →
                                </Link>
                              )}
                              <button onClick={() => markAsRead(notif.id)}
                                style={{ fontSize: '10px', color: 'rgba(200,212,240,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setShowUser(!showUser)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all"
          style={{ background: '#2563FF', fontSize: '12px', fontWeight: 700, border: '2px solid rgba(37,99,255,0.4)' }}
        >
          {profile?.full_name ? getInitials(profile.full_name) : 'U'}
        </button>

        {showUser && (
          <div
            className="absolute right-0 top-11 z-50"
            style={{ width: '200px', background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '4px' }}
          >
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(37,99,255,0.1)', marginBottom: '4px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</p>
              <p style={{ fontSize: '10px', color: 'rgba(200,212,240,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b', fontSize: '13px' }}
            >
              <LogOut style={{ width: '13px', height: '13px' }} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
