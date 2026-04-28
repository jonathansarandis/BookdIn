// @ts-nocheck
import type { Metadata } from 'next'
import { DM_Sans, Syne } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
})

export const metadata: Metadata = {
  title: "bookdIn — Run your business. We'll handle the bookings.",
  description: 'Booking, scheduling and CRM software for service businesses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${syne.variable}`}>
      <body className={dmSans.className}>{children}</body>
    </html>
  )
}
