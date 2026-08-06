// @ts-nocheck
"use client";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import BrowserFrame from "@/components/marketing/BrowserFrame";
import PhoneFrame from "@/components/marketing/PhoneFrame";

const dark = {
  bg: "#0A0F1E",
  headline: "#F5F6FB",
  body: "#93A0B4",
  bullet: "#D3DAE6",
  faint: "#5B6578",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.07)",
  chipBg: "rgba(255,255,255,0.05)",
  chipBorder: "rgba(255,255,255,0.1)",
};
const light = {
  bg: "#F8F9FA",
  headline: "#0A0F1E",
  body: "#57616F",
  bullet: "#33394A",
  faint: "#94A0AF",
  cardBg: "#FFFFFF",
  cardBorder: "rgba(10,15,30,0.08)",
  divider: "rgba(10,15,30,0.08)",
  chipBg: "rgba(10,15,30,0.04)",
  chipBorder: "rgba(10,15,30,0.1)",
};

const BLUE = "#2563FF";
const BLUE_LIGHT = "#4D8CFF";
const PURPLE = "#7c3aed";
const PURPLE_LIGHT = "#a78bfa";

function h2(theme: typeof dark, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    fontSize: "clamp(2.5rem, 4vw, 3rem)", fontWeight: 700,
    letterSpacing: "-1px", lineHeight: 1.1, marginBottom: "1.1rem", color: theme.headline,
    ...extra,
  };
}
function bodyText(theme: typeof dark, extra: React.CSSProperties = {}): React.CSSProperties {
  return { fontSize: "1.125rem", color: theme.body, lineHeight: 1.75, marginBottom: "2rem", ...extra };
}
function eyebrow(color: string): React.CSSProperties {
  return {
    fontSize: "0.78rem", fontWeight: 700, letterSpacing: "1.4px",
    textTransform: "uppercase", color, marginBottom: "0.9rem", display: "block",
  };
}
function pill(theme: typeof dark, color: string, bg: string, border: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
    background: bg, color, border: `1px solid ${border}`,
    fontSize: "0.7rem", fontWeight: 700, padding: "0.3rem 0.9rem", borderRadius: 100,
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "1rem",
  };
}

function BulletList({ items, theme, accent = BLUE }: { items: string[]; theme: typeof dark; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {items.map(f => (
        <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
          <span style={{
            color: accent, fontWeight: 700, fontSize: "0.85rem", lineHeight: "1.6rem",
            width: 20, height: 20, borderRadius: "50%",
            background: theme === dark ? "rgba(37,99,255,0.12)" : "rgba(37,99,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
          }}>✓</span>
          <span style={{ fontSize: "1.02rem", color: theme.bullet, lineHeight: 1.6 }}>{f}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared two-column feature layout: copy ~44%, screenshot ~56%, generous gap. */
function FeatureSection({
  theme, eyebrowColor = BLUE, badge, tag, title, body, bullets, visual, imageSide = "right",
}: {
  theme: typeof dark; eyebrowColor?: string; badge?: string;
  tag: string; title: string; body: React.ReactNode; bullets: string[];
  visual: React.ReactNode; imageSide?: "left" | "right";
}) {
  const copy = (
    <div>
      {badge && <div style={pill(theme, eyebrowColor === PURPLE ? PURPLE_LIGHT : BLUE_LIGHT, theme === dark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)", theme === dark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.2)")}>{badge}</div>}
      <div style={eyebrow(eyebrowColor)}>{tag}</div>
      <h2 style={h2(theme)}>{title}</h2>
      <div style={bodyText(theme)}>{body}</div>
      <BulletList items={bullets} theme={theme} accent={eyebrowColor} />
    </div>
  );
  const visualCol = <div>{visual}</div>;
  return (
    <section style={{
      background: theme.bg, padding: "clamp(4rem, 9vw, 9rem) 2rem",
    }}>
      <div className="bd-feature-grid" style={{
        maxWidth: 1240, margin: "0 auto",
        display: "grid", gridTemplateColumns: imageSide === "right" ? "5fr 6fr" : "6fr 5fr",
        gap: "clamp(2.5rem, 6vw, 5.5rem)", alignItems: "center",
      }}>
        {imageSide === "right" ? <>{copy}{visualCol}</> : <>{visualCol}{copy}</>}
      </div>
    </section>
  );
}

export default function HomePageContent() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden", background: dark.bg }}>
      <style>{`
        @keyframes bdFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .bd-anim { animation: bdFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .bd-anim { animation: none; opacity: 1; transform: none; }
        }
        @media (max-width: 900px) {
          .bd-feature-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <MarketingNav />

      {/* ── HERO ── */}
      <section style={{
        background: dark.bg, position: "relative", overflow: "hidden",
        paddingTop: "10rem", paddingBottom: "clamp(4rem, 8vw, 7rem)",
      }}>
        <div style={{
          position: "absolute", width: 900, height: 900, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 65%)",
          top: -220, left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 2rem", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="bd-anim" style={{ ...pill(dark, "#86efac", "rgba(34,197,94,0.08)", "rgba(34,197,94,0.25)"), animationDelay: "0ms" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "block" }} />
            Built for cleaning, gardening, pest control & trades
          </div>

          <h1 className="bd-anim" style={{
            fontSize: "clamp(3rem, 6.4vw, 5rem)", fontWeight: 700,
            letterSpacing: "-2.5px", lineHeight: 1.04, marginBottom: "1.6rem",
            color: dark.headline, animationDelay: "70ms",
          }}>
            The booking platform with a built-in{" "}
            <span style={{ color: PURPLE_LIGHT }}>AI business manager</span>
          </h1>

          <p className="bd-anim" style={{
            fontSize: "1.3rem", color: dark.body, lineHeight: 1.6,
            maxWidth: 620, margin: "0 auto 2.6rem", animationDelay: "140ms",
          }}>
            Bookings, CRM, payroll, and an AI Agent that tells you exactly what to do — all in one platform built for service businesses.
          </p>

          <div className="bd-anim" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.2rem", animationDelay: "200ms" }}>
            <Link href="/auth/signup" style={{
              background: BLUE, color: "#fff", padding: "1.05rem 2.2rem",
              borderRadius: 11, textDecoration: "none", fontWeight: 700,
              fontSize: "1.02rem", whiteSpace: "nowrap",
              boxShadow: "0 0 44px rgba(37,99,255,0.4)", display: "inline-block",
            }}>
              Start free trial →
            </Link>
            <Link href="/api/demo/login" style={{
              background: "rgba(255,255,255,0.05)", color: dark.headline, padding: "1.05rem 2.2rem",
              borderRadius: 11, textDecoration: "none", fontWeight: 600, fontSize: "1.02rem",
              border: "1px solid rgba(255,255,255,0.14)", display: "inline-block",
            }}>
              Explore live demo
            </Link>
          </div>
          <p className="bd-anim" style={{ fontSize: "0.85rem", color: dark.faint, animationDelay: "260ms" }}>
            No credit card required · <strong style={{ color: dark.body }}>14-day free trial</strong> · Cancel anytime
          </p>
        </div>

        {/* Massive hero screenshot */}
        <div className="bd-anim" style={{ marginTop: "clamp(3.5rem, 7vw, 5.5rem)", padding: "0 2rem", position: "relative", zIndex: 1, animationDelay: "340ms" }}>
          <div style={{ width: "80vw", maxWidth: 1320, margin: "0 auto" }}>
            <BrowserFrame src="/screenshots/dashboard.png" alt="BookdIn dashboard with AI Agent brief, revenue, and today's schedule" glow tilt />
          </div>
        </div>
      </section>

      {/* ── TRUST + STATS (light breathing band) ── */}
      <section style={{ background: light.bg, padding: "clamp(3rem, 6vw, 5rem) 2rem clamp(4rem, 7vw, 6rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "1.5rem", paddingBottom: "clamp(2.5rem, 5vw, 4rem)",
            borderBottom: `1px solid ${light.divider}`, marginBottom: "clamp(2.5rem, 5vw, 4rem)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
              <span style={{ fontSize: "0.9rem", color: light.headline, fontWeight: 500 }}>
                All systems operational ·{" "}
                <span style={{ color: "#16a34a", fontWeight: 700 }}>99.9% uptime guaranteed</span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap" }}>
              {["Stripe", "Supabase", "Vercel", "Resend", "Claude"].map(name => (
                <span key={name} style={{ fontSize: "0.88rem", color: light.faint, fontWeight: 700, letterSpacing: "0.4px" }}>
                  {name}
                </span>
              ))}
            </div>
            <div style={{
              background: "rgba(37,99,255,0.08)", border: "1px solid rgba(37,99,255,0.22)",
              borderRadius: 6, padding: "0.3rem 0.8rem",
              fontSize: "0.7rem", fontWeight: 700, color: "#1d4ed8", letterSpacing: "0.5px",
            }}>
              STRIPE VERIFIED PARTNER
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "clamp(2.5rem, 6vw, 6rem)", flexWrap: "wrap" }}>
            {[
              { val: "AI", label: "Daily business coaching", sub: "No competitor has this" },
              { val: "99.9%", label: "Uptime guaranteed", sub: "Enterprise infrastructure" },
              { val: "14", label: "Day free trial", sub: "No credit card needed" },
              { val: "$49", label: "Starting price /mo", sub: "No per-booking fees" },
            ].map(s => (
              <div key={s.val} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", fontWeight: 700, color: light.headline, letterSpacing: "-1.5px", lineHeight: 1 }}>
                  {s.val}
                </div>
                <div style={{ fontSize: "0.95rem", color: light.bullet, fontWeight: 600, marginTop: "0.5rem" }}>{s.label}</div>
                <div style={{ fontSize: "0.82rem", color: light.faint, marginTop: "0.2rem" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI AGENT — hero feature ── */}
      <FeatureSection
        theme={dark}
        badge="BookdIn exclusive"
        eyebrowColor={PURPLE_LIGHT}
        tag="AI Business Agent"
        title="The only booking platform with a built-in AI Agent"
        body={<>Every morning, your agent reads your live bookings, payments, leads and ad spend, and tells you exactly what needs attention today.{" "}<strong style={{ color: dark.headline }}>Powered by Claude</strong> — not a chatbot bolted on after the fact.</>}
        bullets={[
          "Daily AI-generated morning brief, in plain English",
          "Surfaces unpaid invoices, unassigned jobs & stale leads",
          "Ask it anything — \"how busy are we next week?\"",
          "Drafts payment chases and follow-ups for you to approve",
        ]}
        imageSide="right"
        visual={<BrowserFrame src="/screenshots/agent.png" alt="BookdIn AI Agent daily brief and task list" glow />}
      />

      {/* ── BOOKINGS & CALENDAR (white, overlapping screenshots) ── */}
      <section style={{ background: light.bg, padding: "clamp(4rem, 9vw, 9rem) 2rem" }}>
        <div className="bd-feature-grid" style={{
          maxWidth: 1240, margin: "0 auto",
          display: "grid", gridTemplateColumns: "6fr 5fr",
          gap: "clamp(2.5rem, 6vw, 5.5rem)", alignItems: "center",
        }}>
          <div style={{ position: "relative", paddingBottom: "4rem" }}>
            <BrowserFrame src="/screenshots/bookings.png" alt="BookdIn bookings list" />
            <div style={{
              position: "absolute", bottom: 0, right: "-8%", width: "60%",
              filter: "drop-shadow(0 24px 50px rgba(10,15,30,0.22))",
            }}>
              <BrowserFrame src="/screenshots/calendar.png" alt="BookdIn calendar view" />
            </div>
          </div>
          <div>
            <div style={eyebrow(BLUE)}>Bookings & Calendar</div>
            <h2 style={h2(light)}>Run your whole schedule from one screen</h2>
            <p style={bodyText(light)}>
              Every booking and every day in one place. Filter by status, assign providers, track payments, and see your whole month at a glance.
            </p>
            <BulletList theme={light} items={[
              "Full calendar — day, week & month views",
              "Recurring bookings — set once, run forever",
              "Assign providers with one click",
              "Auto credit card holds on every job",
            ]} />
          </div>
        </div>
      </section>

      {/* ── CRM ── */}
      <FeatureSection
        theme={dark}
        badge="BookdIn exclusive"
        eyebrowColor={BLUE_LIGHT}
        tag="CRM & Pipeline"
        title="Stop losing leads to poor follow-up"
        body={<>Most booking tools only manage existing customers. BookdIn's CRM tracks every lead from first enquiry to won job.{" "}<strong style={{ color: dark.headline }}>Most businesses lose 30–40% of leads just from poor follow-up.</strong>{" "}BookdIn fixes that.</>}
        bullets={[
          "Pipeline: Lead → Contacted → Quoted → Won",
          "Log calls, emails, and notes per contact",
          "Automated follow-up reminders",
          "Convert quotes directly to bookings",
        ]}
        imageSide="left"
        visual={<BrowserFrame src="/screenshots/crm.png" alt="BookdIn CRM lead pipeline board" />}
      />

      {/* ── TESTIMONIAL ── */}
      <section style={{ background: dark.bg, padding: "clamp(4rem, 9vw, 8rem) 2rem" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: "2.2rem" }}>
            {"★★★★★".split("").map((s, i) => (
              <span key={i} style={{ color: "#eab308", fontSize: "1.7rem" }}>{s}</span>
            ))}
          </div>
          <blockquote style={{
            fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 600,
            color: dark.headline, lineHeight: 1.4, letterSpacing: "-0.4px",
            marginBottom: "2.8rem",
          }}>
            "BookdIn's AI Agent tells us exactly what to chase every morning — it's like having an ops manager who never sleeps. It replaced three separate tools we were using."
          </blockquote>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", justifyContent: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `linear-gradient(135deg, ${BLUE}, ${PURPLE})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", border: "2px solid rgba(124,58,237,0.3)",
            }}>🧽</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, color: dark.headline, fontSize: "1.05rem" }}>Cleaning business owner</div>
              <div style={{ color: dark.body, fontSize: "0.9rem" }}>Melbourne, Australia</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINANCIAL REPORTS (white) ── */}
      <section style={{ background: light.bg, padding: "clamp(4rem, 9vw, 9rem) 2rem" }}>
        <div className="bd-feature-grid" style={{
          maxWidth: 1240, margin: "0 auto",
          display: "grid", gridTemplateColumns: "5fr 6fr",
          gap: "clamp(2.5rem, 6vw, 5.5rem)", alignItems: "center",
        }}>
          <div>
            <div style={eyebrow(BLUE)}>Financial Reports</div>
            <h2 style={h2(light)}>Know your profit down to the location</h2>
            <p style={bodyText(light)}>
              Real profit, not just revenue — subcontractor pay, GST, and every cost line already subtracted, broken down per location every week.
            </p>
            <BulletList theme={light} items={[
              "Weekly profit by location — revenue minus subcontractor pay, GST & costs",
              "Google Ads spend & cost-per-conversion, synced automatically",
              "Track admin pay, subscriptions, refunds & ad spend in one place",
              "The same numbers your AI Agent uses to coach you",
            ]} />
          </div>
          <BrowserFrame src="/screenshots/profit.png" alt="BookdIn weekly profit report by location" />
        </div>
      </section>

      {/* ── MORE FEATURES (incl. Payroll, white) ── */}
      <section style={{ background: light.bg, padding: "0 2rem clamp(4rem, 9vw, 9rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
            <div style={eyebrow(BLUE)}>And everything else</div>
            <h2 style={h2(light, { fontSize: "clamp(2rem, 4vw, 2.8rem)", maxWidth: 640, margin: "0 auto 1rem" })}>
              More than a booking tool —{" "}
              <span style={{ color: BLUE }}>a growth engine</span>
            </h2>
            <p style={{ fontSize: "1.1rem", color: light.body, maxWidth: 480, margin: "0 auto" }}>
              The operational details that keep a service business running, all built in.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.4rem" }}>
            {[
              { icon: "💷", title: "Payroll, done automatically", desc: "Subcontractor pay is calculated per job from each provider's payout rate, tracked weekly and ready to export.", highlight: true },
              { icon: "💸", title: "Charge what you're worth", desc: "Room-based dynamic pricing calculates quotes instantly as customers configure bedrooms, bathrooms, and extras." },
              { icon: "🔁", title: "Recurring revenue on autopilot", desc: "Automated recurring job creation and daily payment capture run in the background. Set once, get paid forever.", highlight: true },
              { icon: "🎁", title: "Gift cards & referrals", desc: "Sell gift cards, run discount codes, and track referrals back to the customer who sent them." },
            ].map(c => (
              <div key={c.title} style={{
                background: c.highlight ? "rgba(37,99,255,0.05)" : light.cardBg,
                border: c.highlight ? "1px solid rgba(37,99,255,0.18)" : `1px solid ${light.cardBorder}`,
                borderRadius: 16, padding: "2rem",
                boxShadow: "0 2px 10px rgba(10,15,30,0.03)",
              }}>
                <div style={{ fontSize: "1.7rem", marginBottom: "1rem" }}>{c.icon}</div>
                <h3 style={{ fontSize: "1.08rem", fontWeight: 700, color: light.headline, marginBottom: "0.6rem" }}>{c.title}</h3>
                <p style={{ fontSize: "0.94rem", color: light.body, lineHeight: 1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MOBILE APP — live (dark) ── */}
      <section style={{ background: dark.bg, padding: "clamp(4rem, 9vw, 9rem) 2rem" }}>
        <div className="bd-feature-grid" style={{
          maxWidth: 1240, margin: "0 auto",
          display: "grid", gridTemplateColumns: "5fr 6fr",
          gap: "clamp(2.5rem, 6vw, 5.5rem)", alignItems: "center",
        }}>
          <div>
            <div style={pill(dark, "#86efac", "rgba(34,197,94,0.1)", "rgba(34,197,94,0.28)")}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "block" }} />
              Live now
            </div>
            <div style={eyebrow(BLUE_LIGHT)}>Mobile app</div>
            <h2 style={h2(dark)}>Manage your business from anywhere</h2>
            <p style={bodyText(dark)}>
              The BookdIn mobile app is live for iOS and Android. Your team sees their assigned jobs, updates status from the field, and you get real-time notifications on every new booking.
            </p>
            <div style={{ marginBottom: "2rem" }}>
              <BulletList theme={dark} items={[
                "Providers see and manage their assigned jobs",
                "Real-time push notifications for new bookings",
                "Dashboard snapshot — revenue & bookings today",
                "Update job status from the field",
              ]} />
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {[
                { icon: "🍎", label: "TestFlight (iOS beta)" },
                { icon: "▶", label: "Google Play" },
              ].map(store => (
                <div key={store.label} style={{
                  background: dark.chipBg, border: `1px solid ${dark.chipBorder}`,
                  borderRadius: 10, padding: "0.7rem 1.3rem",
                  display: "flex", alignItems: "center", gap: "0.6rem",
                }}>
                  <span style={{ fontSize: "1.2rem" }}>{store.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.65rem", color: "#4ade80" }}>Live now on</div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: dark.headline }}>{store.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Large phone mockup */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PhoneFrame width={320} glow>
              <div style={{ padding: "3.2rem 1.1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.7rem", height: "100%" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: BLUE_LIGHT, marginBottom: "0.3rem" }}>
                  My Jobs Today
                </div>
                {[["Sarah M.", "General Clean", "9:00 AM", "#22c55e"],
                  ["James T.", "Deep Clean", "12:00 PM", "#eab308"],
                  ["Kim R.", "Move In", "3:00 PM", BLUE_LIGHT]].map(([n, s, t, c]) => (
                  <div key={n} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "0.9rem", border: `1px solid ${c}33` }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: dark.headline }}>{n}</div>
                    <div style={{ fontSize: "0.75rem", color: dark.body }}>{s}</div>
                    <div style={{ fontSize: "0.75rem", color: c, marginTop: 3 }}>{t}</div>
                  </div>
                ))}
                <div style={{
                  marginTop: "auto", background: "rgba(37,99,255,0.12)", borderRadius: 12,
                  padding: "1rem", border: "1px solid rgba(37,99,255,0.25)",
                }}>
                  <div style={{ fontSize: "0.72rem", color: dark.body }}>Revenue today</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: dark.headline }}>$1,840</div>
                  <div style={{ fontSize: "0.72rem", color: "#4ade80" }}>↑ 12% vs yesterday</div>
                </div>
              </div>
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* ── FEATURE COMPARISON (white) ── */}
      <section id="compare" style={{ background: light.bg, padding: "clamp(4rem, 9vw, 9rem) 2rem" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
            <div style={eyebrow(BLUE)}>Full feature breakdown</div>
            <h2 style={h2(light, { fontSize: "clamp(2rem, 3.5vw, 2.8rem)" })}>Everything you need, nothing you don't</h2>
            <p style={{ color: light.body, fontSize: "1.05rem", marginTop: "0.6rem" }}>See exactly how BookdIn compares to other booking tools</p>
          </div>
          <div style={{ overflowX: "auto", background: light.cardBg, borderRadius: 18, border: `1px solid ${light.cardBorder}`, boxShadow: "0 4px 24px rgba(10,15,30,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.94rem" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle(light), textAlign: "left", width: "55%" }}>Feature</th>
                  <th style={{ ...thStyle(light), textAlign: "center", color: "#1d4ed8", background: "rgba(37,99,255,0.06)" }}>BookdIn</th>
                  <th style={{ ...thStyle(light), textAlign: "center" }}>Others</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Online booking & scheduling", bi: true, o: true },
                  { label: "Stripe payments & card holds", bi: true, o: true },
                  { label: "Invoicing & quotes", bi: true, o: true },
                  { label: "Staff / provider portal", bi: true, o: true },
                  { label: "Recurring bookings", bi: true, o: true },
                  { label: "Gift cards & discount codes", bi: true, o: true },
                  { label: "Referral tracking", bi: true, o: true },
                  { label: "99.9% uptime guarantee", bi: true, o: true },
                  { label: "AI Business Agent", note: "Daily briefings, task surfacing & Q&A powered by Claude", bi: true, o: false, ex: true },
                  { label: "CRM lead pipeline", note: "Track leads from first enquiry to won job", bi: true, o: false, ex: true },
                  { label: "Revenue & profit analytics", note: "Weekly profit by location, Google Ads CPA tracking", bi: true, o: false, ex: true },
                  { label: "Payroll & subcontractor pay", note: "Calculated automatically per job", bi: true, o: false, ex: true },
                  { label: "Automated follow-ups", note: "Daily automated payment capture & follow-ups", bi: true, o: false, ex: true },
                  { label: "Room-based dynamic pricing", note: "Auto-calculate quotes by bedrooms & extras", bi: true, o: false, ex: true },
                  { label: "Free trial", biVal: "14 days", oVal: "7 days" },
                  { label: "Starting price", biVal: "$49/mo", oVal: "$67/mo" },
                ].map((row, i) => (
                  <tr key={i} style={{ background: row.ex ? "rgba(37,99,255,0.035)" : "transparent" }}>
                    <td style={{ padding: "1rem 1.4rem", borderBottom: `1px solid ${light.divider}` }}>
                      <span style={{ fontWeight: 500, color: light.headline }}>{row.label}</span>
                      {row.ex && <span style={{ background: "rgba(37,99,255,0.12)", color: "#1d4ed8", fontSize: "0.63rem", fontWeight: 700, padding: "1px 7px", borderRadius: 100, marginLeft: "0.5rem" }}>BookdIn only</span>}
                      {row.note && <span style={{ display: "block", fontSize: "0.78rem", color: light.faint, marginTop: "0.25rem" }}>{row.note}</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "1rem 1.4rem", borderBottom: `1px solid ${light.divider}`, background: "rgba(37,99,255,0.03)" }}>
                      {row.biVal ? <span style={{ color: "#16a34a", fontWeight: 700 }}>{row.biVal}</span> : row.bi ? <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#dc2626" }}>✗</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "1rem 1.4rem", borderBottom: `1px solid ${light.divider}` }}>
                      {row.oVal ? <span style={{ color: light.faint }}>{row.oVal}</span> : row.o ? <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#dc2626" }}>✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PRICING (white) ── */}
      <section style={{ background: light.bg, padding: "0 2rem clamp(4rem, 9vw, 9rem)", textAlign: "center" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={eyebrow(BLUE)}>Pricing</div>
          <h2 style={h2(light, { fontSize: "clamp(2rem, 3.5vw, 2.8rem)" })}>Simple, transparent pricing</h2>
          <p style={{ fontSize: "1.05rem", color: light.body, marginBottom: "3.5rem" }}>
            No per-booking fees. No hidden charges. Start free for 14 days.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.4rem", maxWidth: 900, margin: "0 auto 2rem", textAlign: "left" }}>
            {[
              { name: "Starter", price: "$49", period: "/mo", desc: "Up to 3 staff, unlimited bookings, invoicing, public booking page, room-based pricing", featured: false },
              { name: "Growth", price: "$99", period: "/mo", desc: "Everything in Starter, plus the AI Business Agent, CRM pipeline, profit reports, payroll & recurring automation", featured: true },
              { name: "Enterprise", price: "Custom", period: "", desc: "Multi-location, custom integrations, dedicated onboarding & support", featured: false },
            ].map(p => (
              <div key={p.name} style={{
                background: p.featured ? "#0A0F1E" : light.cardBg,
                border: p.featured ? "1px solid rgba(124,58,237,0.4)" : `1px solid ${light.cardBorder}`,
                borderRadius: 18, padding: "2.2rem", position: "relative",
                boxShadow: p.featured ? "0 24px 60px rgba(37,99,255,0.18)" : "0 2px 10px rgba(10,15,30,0.03)",
              }}>
                {p.featured && <div style={{ position: "absolute", top: "1.4rem", right: "1.4rem", background: BLUE, color: "#fff", fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: 100 }}>Most popular</div>}
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: p.featured ? dark.faint : light.faint, marginBottom: "0.8rem" }}>{p.name}</div>
                <div style={{ fontSize: "3rem", fontWeight: 700, color: p.featured ? "#fff" : light.headline, letterSpacing: "-1.5px", lineHeight: 1 }}>
                  {p.price}<span style={{ fontSize: "0.95rem", fontWeight: 400, color: p.featured ? dark.faint : light.faint }}>{p.period}</span>
                </div>
                <p style={{ fontSize: "0.9rem", color: p.featured ? dark.body : light.body, margin: "0.9rem 0 1.7rem", lineHeight: 1.65 }}>{p.desc}</p>
                <Link href="/auth/signup" style={{
                  display: "block", textAlign: "center", padding: "0.85rem",
                  borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "0.95rem",
                  background: p.featured ? BLUE : "transparent",
                  color: p.featured ? "#fff" : light.headline,
                  border: p.featured ? "none" : `1px solid ${light.cardBorder}`,
                }}>
                  {p.price === "Custom" ? "Contact us" : "Start 14-day trial"}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.85rem", color: light.faint }}>
            No credit card required · 14-day free trial on all plans · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FINAL CTA (dark gradient) ── */}
      <section style={{ background: dark.bg, padding: "0 2rem clamp(5rem, 9vw, 8rem)" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", borderRadius: 28,
          background: "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(37,99,255,0.08))",
          border: "1px solid rgba(124,58,237,0.32)",
          padding: "clamp(4rem, 9vw, 7rem) 2rem", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: 560, height: 560, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none",
          }} />
          <h2 style={h2(dark, { fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)", marginBottom: "1rem", position: "relative" })}>
            Ready to get{" "}
            <span style={{ color: BLUE_LIGHT }}>booked in</span>?
          </h2>
          <p style={{ color: dark.body, marginBottom: "2.8rem", fontSize: "1.15rem", position: "relative" }}>
            14-day free trial. No credit card. Your AI Agent is live from day one.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
            <Link href="/auth/signup" style={{
              background: BLUE, color: "#fff", padding: "1rem 2.3rem",
              borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: "1.05rem",
              boxShadow: "0 0 48px rgba(37,99,255,0.4)", display: "inline-block",
            }}>
              Start free trial — no card needed
            </Link>
            <Link href="/api/demo/login" style={{
              background: "transparent", color: dark.headline, padding: "1rem 2.3rem",
              borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: "1.05rem",
              border: "1px solid rgba(255,255,255,0.16)", display: "inline-block",
            }}>
              Explore live demo →
            </Link>
          </div>
          <p style={{ fontSize: "0.82rem", color: dark.faint, marginTop: "1.6rem", position: "relative" }}>
            Or explore the{" "}
            <Link href="/api/demo/login" style={{ color: BLUE_LIGHT, textDecoration: "none" }}>live demo</Link>
            {" "}— no sign-up needed
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function thStyle(theme: typeof dark): React.CSSProperties {
  return {
    padding: "1.1rem 1.4rem", fontWeight: 600, fontSize: "0.75rem",
    textTransform: "uppercase", letterSpacing: "0.5px", color: theme.faint,
    borderBottom: `1px solid ${theme.divider}`,
  };
}
