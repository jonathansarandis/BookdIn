'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, Search, LogOut, Plus } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile, Business } from '@/types/database'

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
}

interface TopbarProps {
  profile: Profile | null
  business: Business | null
}

export default function Topbar({ profile, business }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const title = PAGE_TITLES[pathname] || 'Cleanly'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

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
      <button className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell className="w-4.5 h-4.5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

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
