// @ts-nocheck
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — BookdIn",
  description:
    "Built by operators, for operators. BookdIn was born out of frustration with tools that weren't built for how service businesses actually work.",
};

const STATS = [
  { val: "14", lbl: "Day free trial, no card needed" },
  { val: "99.9%", lbl: "Uptime guaranteed" },
  { val: "24h", lbl: "Average setup time" },
  { val: "∞", lbl: "Bookings on all plans" },
];

export default function AboutPage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <MarketingNav />

      {/* HEADER */}
      <div
        style={{
          textAlign: "center",
          padding: "10rem 2rem 5rem",
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <div style={tag}>About BookdIn</div>
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
          Built by operators,
          <br />
          for operators
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#8892A4",
            lineHeight: 1.7,
          }}
        >
          BookdIn was born out of frustration with tools that were either too
          complicated, too expensive, or just not built for how service
          businesses actually work.
        </p>
      </div>

      {/* STATS */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "3rem",
          flexWrap: "wrap",
          padding: "0 2rem 5rem",
        }}
      >
        {STATS.map((s) => (
          <div key={s.val} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "2.8rem",
                fontWeight: 700,
                color: "#4D8CFF",
                letterSpacing: "-1px",
              }}
            >
              {s.val}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#8892A4", marginTop: "0.3rem" }}>
              {s.lbl}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* STORY */}
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "5rem 2rem",
        }}
      >
        <div style={tag}>Our story</div>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 700,
            letterSpacing: "-0.6px",
            marginBottom: "1.5rem",
            color: "#F0F2FF",
          }}
        >
          Started with one cleaning company
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
            fontSize: "0.97rem",
            color: "#8892A4",
            lineHeight: 1.75,
          }}
        >
          <p>
            We started BookdIn by building the platform a single cleaning
            company needed from scratch — real bookings, real payments, real
            staff management. No bloat, no features they&apos;d never use, no
            $300/mo enterprise pricing for a 5-person team.
          </p>
          <p>
            The more we built, the more we realised the tools available to
            service businesses were either designed for solo freelancers with no
            room to grow, or massive enterprise systems with learning curves that
            take months to climb.
          </p>
          <p>
            So we built the middle ground — a platform that&apos;s simple enough
            to be live in 24 hours, powerful enough to run a serious operation,
            and priced fairly for businesses that are still growing.
          </p>
          <p>
            BookdIn is a small team that moves fast, ships constantly, and
            listens to customers. If something&apos;s not working for you, we
            want to know.
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* VALUES */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "5rem 2rem" }}>
        <div style={{ ...tag, textAlign: "center" }}>What we stand for</div>
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
          Our principles
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {[
            {
              icon: "⚡",
              title: "Ship fast, fix fast",
              desc: "We release new features constantly. When something breaks, we fix it the same day — not next sprint.",
            },
            {
              icon: "💰",
              title: "Fair pricing, always",
              desc: "Flat monthly fees. No per-booking charges. No commission on your payments. You keep what you earn.",
            },
            {
              icon: "🔒",
              title: "Your data is yours",
              desc: "Every tenant's data is completely isolated. We'll never share, sell, or use your customer data.",
            },
            {
              icon: "🎯",
              title: "Built for growth",
              desc: "Features like CRM and analytics aren't add-ons. They're core to the product because we believe operations and growth belong together.",
            },
            {
              icon: "🛠️",
              title: "Operator-first design",
              desc: "Every feature is designed by thinking about the person running the business — not a product manager who's never cleaned a house.",
            },
            {
              icon: "📞",
              title: "Real support",
              desc: "You talk to the people who built the product. Fast responses, real answers — not a help-centre rabbit hole.",
            },
          ].map((v) => (
            <div
              key={v.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "1.6rem",
              }}
            >
              <div
                style={{
                  fontSize: "1.4rem",
                  marginBottom: "0.8rem",
                }}
              >
                {v.icon}
              </div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#F0F2FF",
                  marginBottom: "0.4rem",
                }}
              >
                {v.title}
              </h3>
              <p style={{ fontSize: "0.87rem", color: "#8892A4", lineHeight: 1.6 }}>
                {v.desc}
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
              href="/contact"
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
              Get in touch
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
