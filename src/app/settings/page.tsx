import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, businesses(*)')
    .eq('id', user.id)
    .single()

  const business = Array.isArray(profile?.businesses)
    ? profile.businesses[0]
    : profile?.businesses

  const stripeConnected = !!process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.includes('YOUR_KEY')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

            {/* Business info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Business info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Business name</p>
                  <p className="font-medium text-gray-900">{business?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Industry</p>
                  <p className="font-medium text-gray-900 capitalize">{business?.industry?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Currency</p>
                  <p className="font-medium text-gray-900">{business?.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Timezone</p>
                  <p className="font-medium text-gray-900">{business?.timezone}</p>
                </div>
              </div>
            </div>

            {/* Stripe */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Stripe payments</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Accept credit card payments from customers</p>
                </div>
                {stripeConnected ? (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Not connected
                  </div>
                )}
              </div>

              {!stripeConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-amber-800 font-medium">To connect Stripe:</p>
                  <ol className="text-xs text-amber-700 space-y-2 list-decimal list-inside">
                    <li>Go to <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">dashboard.stripe.com</a> and sign in</li>
                    <li>Click <strong>Developers → API keys</strong></li>
                    <li>Copy your <strong>Publishable key</strong> and <strong>Secret key</strong></li>
                    <li>Open your <code className="bg-amber-100 px-1 rounded">.env.local</code> file and paste them in</li>
                    <li>Restart your server with <code className="bg-amber-100 px-1 rounded">npm run dev</code></li>
                  </ol>
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900">
                    Open Stripe API keys <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {stripeConnected && (
                <div className="text-xs text-gray-500 space-y-1">
                  <p>✅ Secret key configured</p>
                  <p>✅ Publishable key configured</p>
                  <p className="mt-3 text-gray-400">
                    To set up webhooks for automatic payment confirmation, add your webhook secret to .env.local.
                    <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer"
                      className="ml-1 text-brand-600 hover:underline">
                      Manage webhooks →
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Account */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Your account</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Name</p>
                  <p className="font-medium text-gray-900">{profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-medium text-gray-900">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Role</p>
                  <p className="font-medium text-gray-900 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>

            {/* Booking link */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-brand-700 mb-2">Your booking link</h3>
              <p className="text-xs text-brand-600 mb-3">Share this link with customers to let them book online</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-brand-200 px-3 py-2 rounded-lg font-mono text-brand-700 truncate">
                  {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/book/{business?.booking_url_slug}
                </code>
                <a href={`/book/${business?.booking_url_slug}`} target="_blank"
                  className="text-xs px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                  Open
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
