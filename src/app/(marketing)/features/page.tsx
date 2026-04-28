// @ts-nocheck
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — BookdIn",
  description:
    "Simple, transparent pricing. No per-booking fees. Start free for 14 days.",
};

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Solo operators and small teams getting started.",
    features: [
      "Up to 3 staff",
      "Unlimited bookings",
      "Invoicing & payments",
      "Public booking page",
      "Room-based pricing",
      "Basic reports",
      "99.9% uptime",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/register",
    featured: false,
  },
  {
    name: "Growth",
    price: "$99",
    period: "/mo",
    desc: "Growing businesses that need the full revenue engine.",
    features: [
      "Unlimited staff",
      "Unlimited bookings",
      "CRM lead pipeline",
      "Revenue analytics",
      "Recurring automation",
      "Gift cards & discounts",
      "Referral tracking",
      "99.9% uptime",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/register",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Multi-location, franchise, or high-volume operations.",
    features: [
      "Everything in Growth",
      "Multi-location support",
      "Custom integrations",
      "Dedicated onboarding",
      "SLA & dedicated support",
    ],
    cta: "Contact us",
    ctaHref: "/contact",
    featured: false,
  },
];

const FAQ = [
  {
    q: "Do I need a credit card to start?",
    a: "No. Your 14-day free trial starts immediately with no credit card required. You only enter payment details when you're ready to upgrade.",
  },
  {
    q: "Can I switch plans anytime?",
    a: "Yes. You can upgrade or downgrade your plan at any time. Changes take effect immediately and are prorated.",
  },
  {
    q: "Are there per-booking fees?",
    a: "Never. BookdIn charges a flat monthly fee — no per-booking charges, no commission on payments, no hidden fees.",
  },
  {
    q: "What payment methods does BookdIn support?",
    a: "BookdIn uses Stripe for payments, which supports all major credit and debit cards, Apple Pay, Google Pay, and more.",
  },
  {
    q: "Can I import my existing bookings?",
    a: "Yes. We support CSV import and can migrate data from most booking platforms. We'll have your full history live inside BookdIn in under a day.",
  },
  {
    q: "What is the 99.9% uptime guarantee?",
    a: "BookdIn is built on Vercel and Supabase — enterprise-grade infrastructure used by thousands of companies worldwide. Your booking page stays live even during peak traffic.",
  },
];

export default function PricingPage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <MarketingNav />

      {/* HEADER */}
      <div
        style={{
          textAlign: "center",
          padding: "10rem 2rem 4rem",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <div style={tag}>Pricing</div>
        <h1
          style={{
            fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "-1px",
            lineHeight: 1.1,
            marginBottom: "1rem",
            color: "#F0F2FF",
          }}
        >
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: "1.05rem", color: "#8892A4", lineHeight: 1.7 }}>
          No per-booking fees. No hidden charges. Start free for 14 days —
          no credit card required.
        </p>
      </div>

      {/* PRICING GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.2rem",
          maxWidth: 900,
          margin: "0 auto 3rem",
          padding: "0 2rem",
        }}
      >
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: plan.featured
                ? "rgba(37,99,255,0.08)"
                : "rgba(255,255,255,0.03)",
              border: plan.featured
                ? "1px solid rgba(37,99,255,0.45)"
                : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: "2rem",
              position: "relative",
              boxShadow: plan.featured ? "0 0 48px rgba(37,99,255,0.1)" : "none",
            }}
          >
            {plan.featured && (
              <div
                style={{
                  position: "absolute",
                  top: "1.2rem",
                  right: "1.2rem",
                  background: "#2563FF",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 100,
                }}
              >
                Most popular
              </div>
            )}
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#8892A4",
                marginBottom: "0.7rem",
              }}
            >
              {plan.name}
            </div>
            <div
              style={{
                fontSize: "2.8rem",
                fontWeight: 700,
                letterSpacing: "-1px",
                lineHeight: 1,
                color: "#F0F2FF",
              }}
            >
              {plan.price}
              <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "#8892A4" }}>
                {plan.period}
              </span>
            </div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#8892A4",
                margin: "0.6rem 0 1.4rem",
                lineHeight: 1.5,
              }}
            >
              {plan.desc}
            </p>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                marginBottom: "1.8rem",
              }}
            >
              {plan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: "0.87rem",
                    color: "#F0F2FF",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <span style={{ color: "#4D8CFF", fontWeight: 700 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.ctaHref}
              style={{
                display: "block",
                textAlign: "center",
                padding: "0.7rem",
                borderRadius: 9,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.92rem",
                background: plan.featured ? "#2563FF" : "transparent",
                color: plan.featured ? "#fff" : "#F0F2FF",
                border: plan.featured ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.82rem",
          color: "#8892A4",
          marginBottom: "5rem",
        }}
      >
        No credit card required to start.{" "}
        <strong style={{ color: "#22c55e" }}>14-day free trial</strong> on all
        plans. Cancel anytime.
      </p>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* FAQ */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "5rem 2rem" }}>
        <div style={{ ...tag, textAlign: "center" }}>FAQ</div>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 700,
            letterSpacing: "-0.6px",
            textAlign: "center",
            marginBottom: "3rem",
            color: "#F0F2FF",
          }}
        >
          Common questions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {FAQ.map((item) => (
            <div
              key={item.q}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "1.4rem",
              }}
            >
              <h3
                style={{
                  fontSize: "0.97rem",
                  fontWeight: 600,
                  color: "#F0F2FF",
                  marginBottom: "0.5rem",
                }}
              >
                {item.q}
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#8892A4", lineHeight: 1.65 }}>
                {item.a}
              </p>
            </div>
          ))}
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
            Ready to get{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>booked in</em>?
          </h2>
          <p style={{ color: "#8892A4", marginBottom: "2rem" }}>
            14-day free trial. No credit card. Up and running in under 24 hours.
          </p>
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
            Start free trial — no card needed
          </Link>
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
