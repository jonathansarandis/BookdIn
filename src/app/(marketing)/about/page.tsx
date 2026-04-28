// @ts-nocheck
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const FEATURES = [
  {
    exclusive: true,
    icon: "🧲",
    title: "CRM & lead pipeline",
    desc: "Kanban board to move prospects from first enquiry → quoted → won. See your entire sales funnel, not just existing customers.",
  },
  {
    exclusive: true,
    icon: "📊",
    title: "Revenue analytics",
    desc: "Weekly and monthly revenue charts, booking trends, outstanding invoices at a glance, and provider-level performance tracking.",
  },
  {
    exclusive: true,
    icon: "🏠",
    title: "Room-based dynamic pricing",
    desc: "Automatically calculate quotes based on bedrooms, bathrooms, and add-ons. Customers get an instant price on your booking form.",
  },
  {
    icon: "📅",
    title: "Smart scheduling",
    desc: "Calendar-based booking with provider assignment, drag-and-drop, and recurring job management built in.",
  },
  {
    icon: "💳",
    title: "Stripe payments & card holds",
    desc: "Card capture at booking, auto-charge on completion, invoices, quotes, and full payment history — all in one place.",
  },
  {
    icon: "👥",
    title: "Staff portal",
    desc: "Providers log in to see their assigned jobs, update status, and manage their day — no app download needed.",
  },
  {
    icon: "🌐",
    title: "Public booking page",
    desc: "Your own branded page at your domain. Customers book, pay, and receive confirmation — fully automated.",
  },
  {
    icon: "🎁",
    title: "Gift cards, discounts & referrals",
    desc: "Issue gift cards, run promo codes, and track referrals to grow your customer base without extra ad spend.",
  },
  {
    icon: "⚡",
    title: "99.9% uptime guaranteed",
    desc: "Built on Vercel and Supabase — enterprise-grade infrastructure so your booking page is always live when customers need it.",
  },
];

const COMPARE_ROWS = [
  { label: "Online booking & scheduling", bookdin: true, others: true },
  { label: "Invoicing & quotes", bookdin: true, others: true },
  { label: "Stripe payments & card holds", bookdin: true, others: true },
  { label: "Staff / provider portal", bookdin: true, others: true },
  { label: "Recurring jobs", bookdin: true, others: true },
  { label: "Gift cards & discount codes", bookdin: true, others: true },
  { label: "Referral tracking", bookdin: true, others: true },
  { label: "99.9% uptime guarantee", bookdin: true, others: true },
  {
    label: "CRM lead pipeline",
    note: "Kanban board: lead → contacted → quoted → won. Track every prospect, not just booked customers.",
    bookdin: true,
    others: false,
    exclusive: true,
  },
  {
    label: "Revenue analytics & reporting",
    note: "Weekly/monthly revenue trends, provider performance, customer lifetime value.",
    bookdin: true,
    others: false,
    exclusive: true,
  },
  {
    label: "Automated follow-ups & payment capture",
    note: "Daily automated follow-ups, payment capture, and recurring job creation — no manual work.",
    bookdin: true,
    others: false,
    exclusive: true,
  },
  {
    label: "Room-based dynamic pricing",
    note: "Auto-calculate quotes by bedrooms, bathrooms, and extras on your booking form.",
    bookdin: true,
    others: false,
    exclusive: true,
  },
  {
    label: "Multi-location / multi-tenant",
    note: "Fully isolated data per business. Built to scale to a franchise from day one.",
    bookdin: true,
    others: false,
    exclusive: true,
  },
  { label: "Free trial length", bookdinVal: "14 days", othersVal: "7 days" },
];

const REVENUE_CARDS = [
  {
    icon: "🧲",
    title: "Never lose a lead again",
    desc: "The CRM pipeline tracks every enquiry from first contact to booked job.",
    highlight: "Most businesses lose 30–40% of leads just from poor follow-up.",
  },
  {
    icon: "📊",
    title: "Know exactly what's working",
    desc: "Revenue charts, booking trends, and provider performance — so you can double down on what drives growth instead of guessing.",
  },
  {
    icon: "🔁",
    title: "Recurring revenue on autopilot",
    desc: "Automated recurring job creation, follow-up emails, and payment capture run daily.",
    highlight: "Set it once, get paid forever.",
  },
  {
    icon: "💸",
    title: "Charge what you're worth",
    desc: "Room-based dynamic pricing means your quote updates automatically as customers add bedrooms, bathrooms, and extras.",
  },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <MarketingNav />

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "9rem 2rem 4rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* glow */}
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37,99,255,0.16) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            pointerEvents: "none",
          }}
        />

        {/* pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(37,99,255,0.1)",
            border: "1px solid rgba(37,99,255,0.25)",
            color: "#4D8CFF",
            padding: "0.35rem 1rem",
            borderRadius: 100,
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.3px",
            marginBottom: "1.8rem",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              display: "block",
            }}
          />
          Built for service businesses that want to grow
        </div>

        <h1
          style={{
            fontSize: "clamp(2.6rem, 5.5vw, 4.5rem)",
            fontWeight: 700,
            letterSpacing: "-1.5px",
            lineHeight: 1.07,
            maxWidth: 780,
            marginBottom: "1.4rem",
            color: "#F0F2FF",
          }}
        >
          The booking platform that{" "}
          <em style={{ fontStyle: "normal", color: "#2563FF" }}>
            actually grows your revenue
          </em>
        </h1>

        <p
          style={{
            fontSize: "1.1rem",
            color: "#8892A4",
            maxWidth: 500,
            lineHeight: 1.7,
            marginBottom: "2.2rem",
          }}
        >
          BookdIn goes beyond taking bookings. CRM pipeline, revenue analytics,
          staff management, and automated follow-ups — all in one place.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "1.5rem",
          }}
        >
          <Link href="/register" style={btnPrimary}>
            Start free trial — 14 days
          </Link>
          <Link href="#compare" style={btnGhost}>
            See all features
          </Link>
        </div>

        <p style={{ color: "#8892A4", fontSize: "0.82rem" }}>
          No credit card required ·{" "}
          <strong style={{ color: "#F0F2FF" }}>14-day free trial</strong> ·
          Cancel anytime
        </p>
      </section>

      {/* ── UPTIME BADGE ── */}
      <div
        style={{ padding: "0 2rem 2rem", display: "flex", justifyContent: "center" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "1.5rem",
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 12,
            padding: "0.9rem 2rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "0.88rem", color: "#F0F2FF", fontWeight: 500 }}>
            All systems operational ·{" "}
            <span style={{ color: "#22c55e", fontWeight: 700 }}>
              99.9% uptime guaranteed
            </span>
          </span>
          <div
            style={{
              width: 1,
              height: 24,
              background: "rgba(255,255,255,0.1)",
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "#8892A4" }}>
            Powered by Vercel &amp; Supabase infrastructure
          </span>
        </div>
      </div>

      {/* ── PROOF STATS ── */}
      <div style={{ padding: "1rem 2rem 4rem", textAlign: "center" }}>
        <p
          style={{
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "#8892A4",
            marginBottom: "1.5rem",
          }}
        >
          Why service businesses choose BookdIn
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "4rem",
            flexWrap: "wrap",
          }}
        >
          {[
            { val: "99.9%", lbl: "Uptime guaranteed" },
            { val: "14", lbl: "Day free trial, no card needed" },
            { val: "CRM", lbl: "Built-in lead pipeline" },
            { val: "∞", lbl: "Bookings on every plan" },
          ].map((s) => (
            <div key={s.val} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 700,
                  color: "#F0F2FF",
                  letterSpacing: "-1px",
                }}
              >
                {s.val}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#8892A4", marginTop: "0.2rem" }}>
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={divider} />

      {/* ── COMPARISON TABLE ── */}
      <section id="compare" style={section}>
        <div style={tag}>Full feature breakdown</div>
        <h2 style={h2}>More than just bookings</h2>
        <p style={sub}>
          Most booking tools stop at scheduling. BookdIn gives you the full
          stack — from first enquiry to repeat revenue.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr>
                <th style={{ ...th, width: "55%", textAlign: "left" }}>Feature</th>
                <th
                  style={{
                    ...th,
                    width: "22%",
                    textAlign: "center",
                    color: "#4D8CFF",
                    background: "rgba(37,99,255,0.08)",
                    borderLeft: "1px solid rgba(37,99,255,0.15)",
                    borderRight: "1px solid rgba(37,99,255,0.15)",
                    borderRadius: "10px 10px 0 0",
                  }}
                >
                  BookdIn
                </th>
                <th style={{ ...th, width: "23%", textAlign: "center" }}>Others</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: row.exclusive
                      ? "rgba(37,99,255,0.04)"
                      : "transparent",
                  }}
                >
                  <td
                    style={{
                      padding: "0.85rem 1.2rem",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#F0F2FF" }}>
                      {row.label}
                      {row.exclusive && (
                        <span
                          style={{
                            background: "rgba(37,99,255,0.15)",
                            color: "#4D8CFF",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 100,
                            marginLeft: "0.4rem",
                          }}
                        >
                          BookdIn
                        </span>
                      )}
                    </span>
                    {row.note && (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "#8892A4",
                          display: "block",
                          marginTop: "0.15rem",
                        }}
                      >
                        {row.note}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "0.85rem 1.2rem",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                      background: "rgba(37,99,255,0.04)",
                      borderLeft: "1px solid rgba(37,99,255,0.15)",
                      borderRight: "1px solid rgba(37,99,255,0.15)",
                    }}
                  >
                    {row.bookdinVal ? (
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>
                        {row.bookdinVal}
                      </span>
                    ) : row.bookdin ? (
                      <span style={{ color: "#22c55e", fontSize: "1.1rem" }}>✓</span>
                    ) : (
                      <span style={{ color: "#ef4444", fontSize: "1.1rem" }}>✗</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "0.85rem 1.2rem",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {row.othersVal ? (
                      <span style={{ color: "#8892A4" }}>{row.othersVal}</span>
                    ) : row.others ? (
                      <span style={{ color: "#22c55e", fontSize: "1.1rem" }}>✓</span>
                    ) : (
                      <span style={{ color: "#ef4444", fontSize: "1.1rem" }}>✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={divider} />

      {/* ── REVENUE ── */}
      <section id="revenue" style={section}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          <div>
            <div style={tag}>Revenue growth</div>
            <h2 style={h2}>More than a booking tool — a growth engine</h2>
            <p style={{ ...sub, marginBottom: 0 }}>
              Most booking platforms keep your operation running. BookdIn helps
              you win more jobs, convert more leads, and keep customers longer.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {REVENUE_CARDS.map((c) => (
              <div
                key={c.title}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: "1.2rem 1.4rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: 2 }}>
                  {c.icon}
                </span>
                <div>
                  <h4
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#F0F2FF",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {c.title}
                  </h4>
                  <p style={{ fontSize: "0.83rem", color: "#8892A4", lineHeight: 1.5 }}>
                    {c.desc}{" "}
                    {c.highlight && (
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>
                        {c.highlight}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={divider} />

      {/* ── FEATURES GRID ── */}
      <section id="features" style={section}>
        <div style={tag}>Features</div>
        <h2 style={h2}>Everything you need, built right</h2>
        <p style={sub}>
          The features marked below are built into BookdIn — you won&apos;t
          find them bundled together anywhere else.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {FEATURES.map((f) => (
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
                    marginBottom: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  BookdIn exclusive
                </div>
              )}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9,
                  background: "rgba(37,99,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  marginBottom: "0.4rem",
                  color: "#F0F2FF",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: "0.87rem", color: "#8892A4", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── PRICING PREVIEW ── */}
      <section style={{ ...section, textAlign: "center" }}>
        <div style={tag}>Pricing</div>
        <h2 style={h2}>Simple, transparent pricing</h2>
        <p style={{ ...sub, margin: "0 auto 2rem" }}>
          No per-booking fees. No hidden charges. Start free for 14 days.
        </p>
        <Link href="/pricing" style={btnPrimary}>
          See pricing plans
        </Link>
      </section>

      {/* ── CTA BAND ── */}
      <div
        style={{
          margin: "2rem auto",
          maxWidth: 1040,
          padding: "0 2rem 4rem",
        }}
      >
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
          <h2 style={{ ...h2, marginBottom: "0.8rem" }}>
            Ready to get{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>booked in</em>?
          </h2>
          <p style={{ color: "#8892A4", marginBottom: "2rem", fontSize: "0.97rem" }}>
            Join service businesses already running smarter with BookdIn. We&apos;ll
            have you live in under 24 hours.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/register" style={btnPrimary}>
              Start free trial — no card needed
            </Link>
            <Link href="/book-demo" style={btnGhost}>
              Book a demo
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

// ── Shared styles ──
const section: React.CSSProperties = {
  padding: "5rem 2rem",
  maxWidth: 1080,
  margin: "0 auto",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.07)",
};

const tag: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  color: "#2563FF",
  marginBottom: "0.8rem",
};

const h2: React.CSSProperties = {
  fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
  fontWeight: 700,
  letterSpacing: "-0.8px",
  lineHeight: 1.12,
  marginBottom: "0.8rem",
  color: "#F0F2FF",
};

const sub: React.CSSProperties = {
  fontSize: "1rem",
  color: "#8892A4",
  maxWidth: 460,
  lineHeight: 1.65,
  marginBottom: "2.8rem",
};

const th: React.CSSProperties = {
  padding: "1rem 1.2rem",
  fontWeight: 600,
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#8892A4",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const btnPrimary: React.CSSProperties = {
  background: "#2563FF",
  color: "#fff",
  padding: "0.8rem 2rem",
  borderRadius: 10,
  textDecoration: "none",
  fontSize: "0.97rem",
  fontWeight: 600,
  display: "inline-block",
  boxShadow: "0 0 36px rgba(37,99,255,0.3)",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#F0F2FF",
  padding: "0.8rem 2rem",
  borderRadius: 10,
  textDecoration: "none",
  fontSize: "0.97rem",
  fontWeight: 600,
  border: "1px solid rgba(255,255,255,0.15)",
  display: "inline-block",
};
