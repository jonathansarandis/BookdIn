// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'
import {
  LayoutDashboard, Calendar, ClipboardList, Users,
  DollarSign, FileText, BarChart2, Settings, Zap,
  Tag, Gift, Share2, ChevronRight, MessageSquare, Briefcase, UserCog, RefreshCw
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
  { section: 'Growth' },
  { href: '/gift-cards',   label: 'Gift Cards',   icon: Gift },
  { href: '/referrals',    label: 'Referrals',    icon: Share2 },
  { section: 'System' },
  { href: '/settings',     label: 'Settings',     icon: Settings },
  { href: '/integrations', label: 'Integrations', icon: Zap },
]

interface SidebarProps {
  profile: Profile | null
  business: Business | null
}

export default function Sidebar({ profile, business }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0"
      style={{ background: '#0A0F1E', borderRight: '1px solid rgba(37,99,255,0.15)' }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(37,99,255,0.15)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#2563FF' }}>
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
            <path d="M11 12h18M11 20h12M11 28h15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="30" cy="27" r="5" fill="#4D8CFF"/>
            <path d="M28 27l1.5 1.5L32 25" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '15px', color: '#F0F2FF', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            bookd<span style={{ color: '#2563FF' }}>In</span>
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(77,140,255,0.6)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 500 }}>
            Pro Plan
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: 'none' }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} style={{ paddingTop: '16px', paddingBottom: '6px', paddingLeft: '10px' }}>
                <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(77,140,255,0.4)', textTransform: 'uppercase', letterSpacing: '2.5px' }}>
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
                color: isActive ? '#F0F2FF' : 'rgba(200,212,240,0.55)',
                textDecoration: 'none',
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: isActive ? '#4D8CFF' : 'rgba(200,212,240,0.35)' }}
              />
              <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, flex: 1 }}>
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
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(37,99,255,0.15)' }}>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all"
          style={{ textDecoration: 'none', background: 'transparent' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: '#2563FF', fontSize: '11px', fontWeight: 700, color: '#fff' }}
          >
            {business?.name ? getInitials(business.name) : 'B'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {business?.name || 'My Business'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(200,212,240,0.4)' }}>
              {profile?.role === 'owner' ? 'Owner' : profile?.role || 'Member'}
            </div>
          </div>
          <ChevronRight style={{ width: '14px', height: '14px', color: 'rgba(200,212,240,0.25)', flexShrink: 0 }} />
        </Link>
      </div>
    </aside>
  )
}
