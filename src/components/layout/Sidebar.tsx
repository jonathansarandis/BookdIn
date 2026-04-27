// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'
import {
  LayoutDashboard, Calendar, ClipboardList, Users,
  DollarSign, FileText, BarChart2, Settings, Zap,
  Tag, Gift, Share2, ChevronRight, MessageSquare, Briefcase
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/calendar',    label: 'Calendar',   icon: Calendar },
  { href: '/jobs',        label: 'Jobs',       icon: ClipboardList },
  { href: '/customers',   label: 'Customers',  icon: Users },
  { href: '/crm',         label: 'CRM',        icon: MessageSquare },
  { href: '/services',    label: 'Services',   icon: Briefcase },
  { section: 'Financials' },
  { href: '/invoices',    label: 'Invoices',   icon: DollarSign },
  { href: '/quotes',      label: 'Quotes',     icon: FileText },
  { href: '/discounts',   label: 'Discounts',  icon: Tag },
  { href: '/reports',     label: 'Reports',    icon: BarChart2 },
  { section: 'Growth' },
  { href: '/gift-cards',  label: 'Gift Cards', icon: Gift },
  { href: '/referrals',   label: 'Referrals',  icon: Share2 },
  { section: 'Settings' },
  { href: '/settings',    label: 'Settings',   icon: Settings },
  { href: '/integrations',label: 'Integrations',icon: Zap },
]

interface SidebarProps {
  profile: Profile | null
  business: Business | null
}

export default function Sidebar({ profile, business }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">BookdIn</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Pro Plan</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-3 space-y-0.5">
        {NAV.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} className="pt-4 pb-1 px-2">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {item.section}
                </span>
              </div>
            )
          }

          const Icon = item.icon!
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href!))

          return (
            <Link key={item.href} href={item.href!}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group',
                isActive
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}>
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  item.badgeWarn ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Business footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {business?.name ? getInitials(business.name) : 'B'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">
              {business?.name || 'My Business'}
            </div>
            <div className="text-[10px] text-gray-400">
              {profile?.role === 'owner' ? 'Owner' : profile?.role}
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
        </div>
      </div>
    </aside>
  )
}
