// @ts-nocheck
import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import DemoWrapper from '@/components/demo/DemoWrapper'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: "BookdIn — Run your business. We'll handle the bookings.",
  description: 'Booking, scheduling and CRM software for service businesses.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={dmSans.className} style={{ background: '#0A0F1E', color: '#F0F2FF' }}>
        <DemoWrapper>{children}</DemoWrapper>
      </body>
    </html>
  )
}
