// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'
import {
  LayoutDashboard, Calendar, ClipboardList, Users,
  DollarSign, FileText, BarChart2, Settings, Zap,
  Tag, Gift, Share2, ChevronUp, MessageSquare, Briefcase, UserCog, RefreshCw, Upload, Target, LogOut
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/calendar',     label: 'Calendar',     icon: Calendar },
  { href: '/jobs',         label: 'Bookings',     icon: ClipboardList },
  { href: '/customers',    label: 'Customers',    icon: Users },
  { href: '/crm',          label: 'CRM',          icon: MessageSquare },
  { href: '/providers',    label: 'Providers',    icon: UserCog },
  { href: '/services',     label: 'Services',     icon: Briefcase },
  { href: '/recurring',    label: 'Recurring',    icon: RefreshCw },
  { section: 'Financials' },
  { href: '/invoices',     label: 'Invoices',     icon: DollarSign },
  { href: '/quotes',       label: 'Quotes',       icon: FileText },
  { href: '/discounts',    label: 'Discounts',    icon: Tag },
  { href: '/reports',      label: 'Reports',      icon: BarChart2 },
  { href: '/reports/attribution', label: 'Attribution',   icon: Target },
  { section: 'Growth' },
  { href: '/gift-cards',   label: 'Gift Cards',   icon: Gift },
  { href: '/referrals',    label: 'Referrals',    icon: Share2 },
  { section: 'System' },
  { href: '/settings',     label: 'Settings',     icon: Settings },
  { href: '/integrations', label: 'Integrations', icon: Zap },
  { href: '/import',       label: 'Import Data',  icon: Upload },
]

interface SidebarProps {
  profile: Profile | null
  business: Business | null
}

export default function Sidebar({ profile, business }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0"
      style={{ background: '#0A0F1E', borderRight: '1px solid rgba(37,99,255,0.15)' }}
    >
      {/* Wordmark logo */}
      <div className="h-16 flex items-center justify-center flex-shrink-0" style={{ borderBottom: '1px solid rgba(37,99,255,0.15)' }}>
        <span style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 800, fontSize: '22px', color: '#F0F2FF', letterSpacing: '-0.5px' }}>
          Bookd<span style={{ color: '#2563FF' }}>In</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: 'none' }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} style={{ paddingTop: '16px', paddingBottom: '6px', paddingLeft: '10px' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(180,210,255,0.8)', textTransform: 'uppercase', letterSpacing: '2.5px' }}>
                  {item.section}
                </span>
              </div>
            )
          }

          const Icon = item.icon!
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href!))

          return (
            <Link
              key={item.href}
              href={item.href!}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all mb-0.5"
              style={{
                background: isActive ? 'rgba(37,99,255,0.12)' : 'transparent',
                color: isActive ? '#FFFFFF' : '#E8EEF8',
                textDecoration: 'none',
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: isActive ? '#4D8CFF' : '#9ABCD8' }}
              />
              <span style={{ fontSize: '14px', fontWeight: isActive ? 600 : 500, flex: 1 }}>
                {item.label}
              </span>
              {isActive && (
                <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: '#2563FF' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Business footer */}
      <div className="p-3 flex-shrink-0 relative" style={{ borderTop: '1px solid rgba(37,99,255,0.15)' }} ref={footerRef}>

        {/* User popup — opens above */}
        {showUserMenu && (
          <div
            className="absolute left-3 right-3 bottom-full mb-2"
            style={{ background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '12px', boxShadow: '0 -8px 32px rgba(0,0,0,0.4)', padding: '4px' }}
          >
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(37,99,255,0.1)', marginBottom: '4px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</p>
              <p style={{ fontSize: '10px', color: '#9ABCD8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</p>
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

        {/* Footer trigger */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all"
          style={{ background: showUserMenu ? 'rgba(37,99,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: '#2563FF', fontSize: '11px', fontWeight: 700, color: '#fff' }}
          >
            {business?.name ? getInitials(business.name) : 'B'}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {business?.name || 'My Business'}
            </div>
            <div style={{ fontSize: '10px', color: '#8BAAC8' }}>
              {profile?.role === 'owner' ? 'Owner' : profile?.role || 'Member'}
            </div>
          </div>
          <ChevronUp style={{ width: '14px', height: '14px', color: showUserMenu ? '#4D8CFF' : '#7A9DC0', flexShrink: 0, transition: 'transform 0.15s', transform: showUserMenu ? 'rotate(0deg)' : 'rotate(180deg)' }} />
        </button>
      </div>
    </aside>
  )
}
