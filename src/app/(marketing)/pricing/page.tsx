// @ts-nocheck
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — BookdIn",
  description:
    "CRM pipeline, revenue analytics, room-based pricing, staff portal, recurring jobs and more — all in one platform.",
};

const FEATURE_SECTIONS = [
  {
    tag: "Growth",
    title: "Features that grow your revenue",
    desc: "Most booking tools manage your existing jobs. These features help you win more of them.",
    features: [
      {
        exclusive: true,
        icon: "🧲",
        title: "CRM lead pipeline",
        body: "A full kanban-style pipeline from first enquiry to won job. Track every lead, add notes, log calls, and move prospects through stages — Lead → Contacted → Quoted → Won → Lost. Stop losing revenue to poor follow-up.",
      },
      {
        exclusive: true,
        icon: "📊",
        title: "Revenue analytics",
        body: "See your revenue by week, month, and service type. Track which providers are most profitable, which services have the best margins, and where your bookings are coming from. Make decisions based on data, not gut feel.",
      },
      {
        exclusive: true,
        icon: "🔁",
        title: "Automated follow-ups",
        body: "Automated daily jobs handle follow-up emails, payment capture, and recurring job creation — without you touching anything. Set it up once, and BookdIn handles the rest.",
      },
      {
        exclusive: true,
        icon: "🏠",
        title: "Room-based dynamic pricing",
        body: "Configure pricing by number of bedrooms, bathrooms, and add-ons. When customers book online, the price updates live as they configure their clean. No manual quoting, no back-and-forth.",
      },
    ],
  },
  {
    tag: "Operations",
    title: "Everything you need to run the day",
    desc: "Bookings, staff, payments — the operational core that keeps your business moving.",
    features: [
      {
        icon: "📅",
        title: "Smart scheduling & calendar",
        body: "A full calendar view of all jobs, with drag-and-drop to reschedule. Assign providers to jobs, see availability at a glance, and manage your whole team's day from one screen.",
      },
      {
        icon: "👥",
        title: "Staff portal",
        body: "Every provider gets their own login. They see their assigned jobs for the day, can update job status, and manage their schedule — all from any device, no app download needed.",
      },
      {
        icon: "🌐",
        title: "Public booking page",
        body: "A branded booking page at your own domain. Customers pick their service, configure options, enter their details, and pay — all automatically. Confirmation emails go out instantly.",
      },
      {
        icon: "💳",
        title: "Stripe payments & card holds",
        body: "Capture card details at booking and charge automatically on completion. Full invoice and quote management, payment history per customer, and outstanding invoice tracking.",
      },
    ],
  },
  {
    tag: "Retention",
    title: "Keep customers coming back",
    desc: "Tools to turn one-off bookings into long-term recurring revenue.",
    features: [
      {
        icon: "🔄",
        title: "Recurring jobs",
        body: "Set up weekly, fortnightly, or monthly recurring services. BookdIn automatically generates the next job, sends reminders, and charges the saved card. Hands-free recurring revenue.",
      },
      {
        icon: "🎁",
        title: "Gift cards",
        body: "Issue gift cards directly from your dashboard. Customers can purchase them as presents, and recipients redeem at booking. A passive revenue stream that also brings in new customers.",
      },
      {
        icon: "🏷️",
        title: "Discount codes",
        body: "Create and manage promo codes for seasonal campaigns, first-time customer offers, or loyalty rewards. Set expiry dates, usage limits, and percentage or fixed-amount discounts.",
      },
      {
        icon: "🤝",
        title: "Referral tracking",
        body: "Track which customers are referring others and reward them automatically. Word-of-mouth is your most powerful growth channel — BookdIn makes it measurable.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <MarketingNav />

      {/* HEADER */}
      <div
        style={{
          textAlign: "center",
          padding: "10rem 2rem 5rem",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <div style={tag}>Features</div>
        <h1
          style={{
            fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)",
            fontWeight: 700,
            letterSpacing: "-1.2px",
            lineHeight: 1.08,
            marginBottom: "1.2rem",
            color: "#F0F2FF",
          }}
        >
          Everything you need.
          <br />
          <em style={{ fontStyle: "normal", color: "#2563FF" }}>
            Nothing you don&apos;t.
          </em>
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#8892A4", lineHeight: 1.7 }}>
          BookdIn is purpose-built for service businesses. Every feature earns
          its place — nothing is here just to fill a feature list.
        </p>
      </div>

      {/* FEATURE SECTIONS */}
      {FEATURE_SECTIONS.map((section, si) => (
        <div key={section.tag}>
          {si > 0 && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
          )}
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "5rem 2rem" }}>
            <div style={tag}>{section.tag}</div>
            <h2
              style={{
                fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
                fontWeight: 700,
                letterSpacing: "-0.6px",
                marginBottom: "0.6rem",
                color: "#F0F2FF",
              }}
            >
              {section.title}
            </h2>
            <p
              style={{
                fontSize: "1rem",
                color: "#8892A4",
                marginBottom: "2.5rem",
                maxWidth: 500,
                lineHeight: 1.65,
              }}
            >
              {section.desc}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.2rem",
              }}
            >
              {section.features.map((f) => (
                <div
                  key={f.title}
                  style={{
                    background: f.exclusive
                      ? "rgba(37,99,255,0.05)"
                      : "rgba(255,255,255,0.03)",
                    border: f.exclusive
                      ? "1px solid rgba(37,99,255,0.25)"
                      : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: "1.6rem",
                  }}
                >
                  {f.exclusive && (
                    <div
                      style={{
                        display: "inline-block",
                        background: "rgba(37,99,255,0.15)",
                        color: "#4D8CFF",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 100,
                        marginBottom: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.3px",
                      }}
                    >
                      BookdIn exclusive
                    </div>
                  )}
                  <div style={{ fontSize: "1.4rem", marginBottom: "0.7rem" }}>
                    {f.icon}
                  </div>
                  <h3
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "#F0F2FF",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{ fontSize: "0.87rem", color: "#8892A4", lineHeight: 1.65 }}
                  >
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* UPTIME */}
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "5rem 2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚡</div>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 700,
            letterSpacing: "-0.6px",
            marginBottom: "1rem",
            color: "#F0F2FF",
          }}
        >
          99.9% uptime guaranteed
        </h2>
        <p
          style={{
            fontSize: "1rem",
            color: "#8892A4",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}
        >
          BookdIn runs on Vercel and Supabase — the same enterprise-grade
          infrastructure trusted by thousands of companies worldwide. Your
          booking page stays live 24/7, even during peak traffic, so you never
          miss a booking because of downtime.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 100,
            padding: "0.5rem 1.2rem",
            fontSize: "0.88rem",
            color: "#22c55e",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22c55e",
              display: "block",
            }}
          />
          All systems operational
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "0 2rem 5rem", maxWidth: 1040, margin: "0 auto" }}>
        <div
          style={{
            borderRadius: 20,
            background:
              "linear-gradient(135deg, rgba(37,99,255,0.18), rgba(37,99,255,0.04))",
            border: "1px solid rgba(37,99,255,0.3)",
            padding: "4rem 2rem",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              fontWeight: 700,
              letterSpacing: "-0.6px",
              marginBottom: "0.8rem",
              color: "#F0F2FF",
            }}
          >
            See it for yourself
          </h2>
          <p style={{ color: "#8892A4", marginBottom: "2rem" }}>
            14-day free trial. No credit card. Up and running in under 24 hours.
          </p>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/register"
              style={{
                background: "#2563FF",
                color: "#fff",
                padding: "0.85rem 2.2rem",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1rem",
                display: "inline-block",
                boxShadow: "0 0 36px rgba(37,99,255,0.3)",
              }}
            >
              Start free trial
            </Link>
            <Link
              href="/pricing"
              style={{
                background: "transparent",
                color: "#F0F2FF",
                padding: "0.85rem 2.2rem",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1rem",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "inline-block",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

const tag: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  color: "#2563FF",
  marginBottom: "0.8rem",
};
