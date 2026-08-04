// @ts-nocheck
// Deliberately no Sidebar/Topbar here — this is staff's (VA) default landing
// page and needs to work well on a phone (Reyan accesses it from hers).
// Sidebar.tsx has no responsive/collapse behavior at all, so wrapping this
// page in the normal dashboard shell would eat most of a phone screen with
// a ~25-item nav list. /agent (the AI Agent full page) already sets this
// precedent of being a standalone page without the dashboard chrome.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_complete && !profile?.business_id) {
    redirect('/onboarding')
  }

  return <div style={{ minHeight: '100vh', background: '#F3F4F6' }}>{children}</div>
}
