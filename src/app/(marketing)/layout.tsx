// @ts-nocheck
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BookdIn — Booking & Operations for Service Businesses",
  description:
    "BookdIn goes beyond taking bookings. CRM pipeline, revenue analytics, staff management, and automated follow-ups — all in one place.",
  openGraph: {
    title: "BookdIn — Booking & Operations for Service Businesses",
    description:
      "CRM pipeline, revenue analytics, staff management, and automated follow-ups for service businesses.",
    url: "https://bookdin.co",
    siteName: "BookdIn",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ background: "#0A0F1E", minHeight: "100vh", color: "#F0F2FF" }}
    >
      {children}
    </div>
  );
}
