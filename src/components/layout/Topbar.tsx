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
  '/jobs':         'Jobs',
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
  const notifsRef = useRef<HTMLDivElement>(null)

  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname === path || (path !== '/dashboard' && pathname.startsWith(path)))?.[1] || 'BookdIn'

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
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
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function markAllAsRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    setNotifications([])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const unreadCount = notifications.length

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 flex-shrink-0">
      <h1 className="text-base font-semibold text-gray-900 flex-1">{title}</h1>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-400 cursor-pointer hover:bg-gray-200 transition-colors">
        <Search className="w-3.5 h-3.5" />
        <span className="text-xs">Search...</span>
        <kbd className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-mono ml-8">⌘K</kbd>
      </div>

      {/* New booking */}
      <a href="/booking"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
        <Plus className="w-4 h-4" />
        New booking
      </a>

      {/* Notifications */}
      <div className="relative" ref={notifsRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {notifications.map(notif => {
                  const Icon = NOTIF_ICONS[notif.type] || Bell
                  const isCallPrompt = notif.type === 'call_prompt' || notif.type === 'follow_up'
                  return (
                    <div key={notif.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isCallPrompt ? 'bg-red-100' : 'bg-blue-50'
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${isCallPrompt ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 leading-snug">{notif.title}</p>
                          {notif.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                          )}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-gray-400">{timeAgo(notif.created_at)}</span>
                            <div className="flex items-center gap-2">
                              {notif.action_url && (
                                <Link
                                  href={notif.action_url}
                                  onClick={() => { markAsRead(notif.id); setShowNotifs(false) }}
                                  className="text-[10px] text-brand-600 font-medium hover:underline"
                                >
                                  View →
                                </Link>
                              )}
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
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

      {/* Avatar + sign out */}
      <div className="flex items-center gap-2 group relative">
        <button className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center hover:ring-2 hover:ring-brand-300 transition-all">
          {profile?.full_name ? getInitials(profile.full_name) : 'U'}
        </button>
        <div className="absolute top-10 right-0 hidden group-hover:block z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-1 w-48">
          <div className="px-3 py-2 border-b border-gray-100 mb-1">
            <p className="text-xs font-medium text-gray-900 truncate">{profile?.full_name}</p>
            <p className="text-[10px] text-gray-400 truncate">{profile?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
