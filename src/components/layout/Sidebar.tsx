// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getInitials } from '@/lib/utils'
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
          style={{ textDecoration: 'none' }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: '#2563FF', fontSize: '11px', fontWeight: 700, color: '#fff' }}
          >
            {business?.name ? getInitials(business.name) : 'B'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {business?.name || 'My Business'}
            </div>
            <div style={{ fontSize: '10px', color: '#8BAAC8' }}>
              {profile?.role === 'owner' ? 'Owner' : profile?.role || 'Member'}
            </div>
          </div>
          <ChevronRight style={{ width: '14px', height: '14px', color: '#7A9DC0', flexShrink: 0 }} />
        </Link>
      </div>
    </aside>
  )
}
