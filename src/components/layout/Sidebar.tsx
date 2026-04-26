'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'
import {
  LayoutDashboard, Calendar, ClipboardList, Users,
  DollarSign, FileText, BarChart2, Settings, Zap,
  Tag, Gift, Share2, ChevronRight
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/calendar',    label: 'Calendar',   icon: Calendar,       badge: 3 },
  { href: '/jobs',        label: 'Jobs',       icon: ClipboardList,  badge: 5, badgeWarn: true },
  { href: '/customers',   label: 'Customers',  icon: Users },
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
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">Cleanly</div>
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
