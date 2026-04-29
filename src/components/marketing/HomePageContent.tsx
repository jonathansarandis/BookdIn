// @ts-nocheck
"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// ── Animated counter hook ──
function useCounter(target: number, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

export default function HomePageContent() {
  const [email, setEmail] = useState("");
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden", background: "#0A0F1E" }}>

      {/* ── ANNOUNCEMENT BAR ── */}
      <div style={{
        background: "linear-gradient(90deg, #1e3a8a, #2563FF, #1e3a8a)",
        padding: "0.55rem 1.5rem", textAlign: "center",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        fontSize: "0.82rem", color: "#e0f2fe", fontWeight: 500,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
          Explore BookdIn in real-time — no sign-up needed
        </span>
        <Link href="/api/demo/login" style={{
          background: "#fff", color: "#1d4ed8", padding: "0.2rem 0.9rem",
          borderRadius: 100, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none",
        }}>
          Live Demo →
        </Link>
      </div>

      <MarketingNav />

      {/* ── HERO ── */}
      <section style={{
        minHeight: "calc(100vh - 36px)", display: "flex", alignItems: "center",
        padding: "7rem 3rem 4rem", maxWidth: 1200, margin: "0 auto",
        gap: "5rem", position: "relative",
      }}>
        <div style={{
          position: "absolute", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,255,0.13) 0%, transparent 70%)",
          top: "50%", left: "30%", transform: "translate(-50%,-50%)",
          pointerEvents: "none",
        }} />

        {/* LEFT */}
        <div style={{ flex: "0 0 500px", position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "rgba(37,99,255,0.1)", border: "1px solid rgba(37,99,255,0.25)",
            color: "#4D8CFF", padding: "0.35rem 1rem", borderRadius: 100,
            fontSize: "0.73rem", fontWeight: 600, marginBottom: "1.4rem",
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "block" }} />
            Built for cleaning & service businesses
          </div>

          <h1 style={{
            fontSize: "clamp(2.8rem, 4.8vw, 4.2rem)", fontWeight: 700,
            letterSpacing: "-2px", lineHeight: 1.05, marginBottom: "1.2rem",
            color: "#F0F2FF",
          }}>
            The booking platform that{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>actually grows your revenue</em>
          </h1>

          {/* 3 scannable bullets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
            {[
              "Bookings, CRM & payments — all in one place",
              "Turn enquiries into jobs with a built-in lead pipeline",
              "Automated follow-ups & recurring jobs on autopilot",
            ].map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "rgba(37,99,255,0.15)",
                  border: "1px solid rgba(37,99,255,0.4)", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", color: "#4D8CFF", fontWeight: 700,
                }}>✓</div>
                <span style={{ fontSize: "0.95rem", color: "#c8d4e8" }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Email capture */}
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.8rem", flexWrap: "wrap" }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your work email"
              style={{
                flex: "1 1 200px", padding: "0.9rem 1.2rem",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "#F0F2FF",
                fontSize: "0.95rem", outline: "none", fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <Link
              href={email ? `/auth/signup?email=${encodeURIComponent(email)}` : "/auth/signup"}
              style={{
                background: "#2563FF", color: "#fff", padding: "0.9rem 1.8rem",
                borderRadius: 10, textDecoration: "none", fontWeight: 700,
                fontSize: "0.97rem", whiteSpace: "nowrap",
                boxShadow: "0 0 40px rgba(37,99,255,0.4)",
                display: "inline-block",
              }}
            >
              Start free trial →
            </Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6b7f99", marginBottom: "2rem" }}>
            No credit card required · <strong style={{ color: "#8892A4" }}>14-day free trial</strong> · Cancel anytime
          </p>

          {/* Social proof avatars */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex" }}>
              {["CF","JM","SR","AL"].map((initials, i) => (
                <div key={i} style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: ["#2563FF","#7c3aed","#059669","#d97706"][i],
                  border: "2px solid #0A0F1E", marginLeft: i > 0 ? -10 : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700, color: "#fff", zIndex: 4 - i,
                  position: "relative",
                }}>
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", gap: 1, marginBottom: 2 }}>
                {"★★★★★".split("").map((s, i) => (
                  <span key={i} style={{ color: "#eab308", fontSize: "0.85rem" }}>{s}</span>
                ))}
              </div>
              <span style={{ fontSize: "0.78rem", color: "#8892A4" }}>
                Loved by service businesses
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — dashboard screenshot */}
        <div style={{ flex: 1, position: "relative", zIndex: 1, minWidth: 0 }}>
          <div style={{
            borderRadius: 14, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 48px 140px rgba(0,0,0,0.6), 0 0 80px rgba(37,99,255,0.07)",
          }}>
            <div style={{
              background: "#0d1424", padding: "0.65rem 1rem",
              display: "flex", alignItems: "center", gap: "0.35rem",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              {["#FF5F57","#FEBC2E","#28C840"].map(c => (
                <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
              ))}
              <div style={{
                flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4,
                height: 18, marginLeft: "0.5rem", maxWidth: 220,
              }} />
            </div>
            <img
              src="/screenshots/dashboard.png"
              alt="BookdIn dashboard showing bookings, revenue and CRM"
              style={{ width: "100%", display: "block" }}
            />
          </div>
          {/* Floating revenue badge */}
          <div style={{
            position: "absolute", bottom: -20, left: -24,
            background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "0.9rem 1.3rem",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", gap: "0.8rem",
          }}>
            <div style={{ fontSize: "1.4rem" }}>📈</div>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F0F2FF" }}>$54,448 this month</div>
              <div style={{ fontSize: "0.7rem", color: "#22c55e", marginTop: 1 }}>↑ 23% vs last month</div>
            </div>
          </div>
          {/* Floating booking badge */}
          <div style={{
            position: "absolute", top: 40, right: -20,
            background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "0.8rem 1.2rem",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", gap: "0.7rem",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#F0F2FF" }}>New booking · $394</div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "1.2rem 3rem",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: "0.83rem", color: "#F0F2FF", fontWeight: 500 }}>
              All systems operational ·{" "}
              <span style={{ color: "#22c55e", fontWeight: 700 }}>99.9% uptime guaranteed</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap" }}>
            {["Stripe", "Supabase", "Vercel", "Resend"].map(name => (
              <span key={name} style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: 700, letterSpacing: "0.5px" }}>
                {name}
              </span>
            ))}
          </div>
          <div style={{
            background: "rgba(37,99,255,0.1)", border: "1px solid rgba(37,99,255,0.25)",
            borderRadius: 6, padding: "0.3rem 0.8rem",
            fontSize: "0.7rem", fontWeight: 700, color: "#4D8CFF", letterSpacing: "0.5px",
          }}>
            STRIPE VERIFIED PARTNER
          </div>
        </div>
      </div>

      {/* ── ANIMATED STATS ── */}
      <div ref={statsRef} style={{ padding: "5rem 3rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "1px", color: "#4a5568", marginBottom: "3rem", fontWeight: 600 }}>
          Why service businesses choose BookdIn
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "6rem", flexWrap: "wrap", maxWidth: 900, margin: "0 auto" }}>
          {[
            { val: "99.9%", label: "Uptime guaranteed", sub: "Enterprise infrastructure" },
            { val: "14", label: "Day free trial", sub: "No credit card needed" },
            { val: "CRM", label: "Built-in lead pipeline", sub: "Not available elsewhere" },
            { val: "$49", label: "Starting price /mo", sub: "No per-booking fees" },
          ].map(s => (
            <div key={s.val} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.8rem", fontWeight: 700, color: "#F0F2FF", letterSpacing: "-1.5px", lineHeight: 1 }}>
                {s.val}
              </div>
              <div style={{ fontSize: "0.88rem", color: "#c8d4e8", fontWeight: 600, marginTop: "0.4rem" }}>{s.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#4a5568", marginTop: "0.2rem" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── BOOKINGS FEATURE ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "7rem 3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
        <div>
          <div style={tag}>Bookings</div>
          <h2 style={h2}>Manage bookings like a pro</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", lineHeight: 1.75, marginBottom: "1.8rem" }}>
            Every booking in one place. Filter by status, assign providers, track payments, and manage your whole schedule from a single screen.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {[
              "Recurring bookings — set once, run forever",
              "Auto credit card holds on every job",
              "Assign providers with one click",
              "Filter by today, this week, or unassigned",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <span style={{ color: "#2563FF", fontWeight: 700, fontSize: "0.9rem" }}>✓</span>
                <span style={{ fontSize: "0.93rem", color: "#c8d4e8" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        }}>
          <img src="/screenshots/bookings.png" alt="BookdIn bookings list" style={{ width: "100%", display: "block" }} />
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── CRM SECTION ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "7rem 3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "center" }}>
        {/* CRM pipeline visual */}
        <div style={{
          background: "rgba(37,99,255,0.04)", border: "1px solid rgba(37,99,255,0.15)",
          borderRadius: 16, padding: "2rem",
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4D8CFF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "1.5rem" }}>
            Lead Pipeline
          </div>
          {[
            { stage: "New Lead", count: 4, value: "$4,200", color: "#8892A4", pct: 33 },
            { stage: "Contacted", count: 7, value: "$9,800", color: "#eab308", pct: 58 },
            { stage: "Quoted", count: 5, value: "$14,500", color: "#4D8CFF", pct: 42 },
            { stage: "Won", count: 12, value: "$31,200", color: "#22c55e", pct: 100 },
          ].map(col => (
            <div key={col.stage} style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", color: col.color, fontWeight: 600 }}>{col.stage}</span>
                  <span style={{ fontSize: "0.72rem", color: "#4a5568", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>{col.count}</span>
                </div>
                <span style={{ fontSize: "0.78rem", color: "#4a5568" }}>{col.value}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${col.pct}%`, background: col.color, borderRadius: 3, opacity: 0.7, transition: "width 1s ease" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: "1.5rem", padding: "0.9rem", background: "rgba(34,197,94,0.08)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.15)" }}>
            <div style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: 700 }}>12 leads won this month</div>
            <div style={{ fontSize: "0.73rem", color: "#4a5568", marginTop: "0.2rem" }}>$31,200 pipeline value closed</div>
          </div>
        </div>

        <div>
          <div style={{
            display: "inline-block", background: "rgba(37,99,255,0.12)", color: "#4D8CFF",
            fontSize: "0.68rem", fontWeight: 700, padding: "2px 10px", borderRadius: 100,
            marginBottom: "0.8rem", textTransform: "uppercase", letterSpacing: "0.3px",
          }}>
            BookdIn exclusive
          </div>
          <div style={tag}>CRM & Pipeline</div>
          <h2 style={h2}>Stop losing leads to poor follow-up</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", lineHeight: 1.75, marginBottom: "1.8rem" }}>
            Most booking tools only manage existing customers. BookdIn's CRM tracks every lead from first enquiry to won job.{" "}
            <strong style={{ color: "#F0F2FF" }}>Most businesses lose 30–40% of leads just from poor follow-up.</strong>{" "}
            BookdIn fixes that.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {[
              "Pipeline: Lead → Contacted → Quoted → Won",
              "Log calls, emails, and notes per contact",
              "Automated follow-up reminders",
              "Convert quotes directly to bookings",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <span style={{ color: "#2563FF", fontWeight: 700, fontSize: "0.9rem" }}>✓</span>
                <span style={{ fontSize: "0.93rem", color: "#c8d4e8" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── TESTIMONIAL ── */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "7rem 3rem", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: "2rem" }}>
          {"★★★★★".split("").map((s, i) => (
            <span key={i} style={{ color: "#eab308", fontSize: "1.6rem" }}>{s}</span>
          ))}
        </div>
        <blockquote style={{
          fontSize: "clamp(1.3rem, 2.5vw, 1.9rem)", fontWeight: 600,
          color: "#F0F2FF", lineHeight: 1.45, letterSpacing: "-0.3px",
          marginBottom: "2.5rem", fontStyle: "normal",
          maxWidth: 720, margin: "0 auto 2.5rem",
        }}>
          "BookdIn replaced three separate tools we were using. The CRM alone has helped us convert enquiries we used to just lose track of."
        </blockquote>
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", justifyContent: "center" }}>
          <div style={{
            width: 54, height: 54, borderRadius: "50%",
            background: "linear-gradient(135deg, #2563FF, #4D8CFF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 700, color: "#fff",
            border: "2px solid rgba(37,99,255,0.3)",
          }}>CF</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, color: "#F0F2FF", fontSize: "1rem" }}>Clean Freaks</div>
            <div style={{ color: "#8892A4", fontSize: "0.85rem" }}>Cleaning company · Australia</div>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── REVENUE GROWTH ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "7rem 3rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={tag}>Revenue growth</div>
          <h2 style={{ ...h2, fontSize: "clamp(2rem, 4vw, 3.2rem)", maxWidth: 640, margin: "0 auto 1rem" }}>
            More than a booking tool —{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>a growth engine</em>
          </h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", maxWidth: 480, margin: "0 auto" }}>
            Most booking platforms keep your operation running. BookdIn helps you win more jobs, convert more leads, and keep customers longer.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.2rem" }}>
          {[
            { icon: "🧲", title: "Never lose a lead again", desc: "CRM pipeline tracks every enquiry from first contact to booked job. Stop losing 30–40% of revenue to poor follow-up.", highlight: true },
            { icon: "📊", title: "Know exactly what's working", desc: "Revenue charts, booking trends, and provider performance — make data-driven decisions every week." },
            { icon: "🔁", title: "Recurring revenue on autopilot", desc: "Automated recurring job creation, follow-up emails, and payment capture run daily. Set once, get paid forever.", highlight: true },
            { icon: "💸", title: "Charge what you're worth", desc: "Room-based dynamic pricing calculates quotes instantly as customers configure bedrooms, bathrooms, and extras." },
          ].map(c => (
            <div key={c.title} style={{
              background: c.highlight ? "rgba(37,99,255,0.06)" : "rgba(255,255,255,0.03)",
              border: c.highlight ? "1px solid rgba(37,99,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "1.8rem",
              transition: "transform 0.2s, border-color 0.2s",
            }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.8rem" }}>{c.icon}</div>
              <h3 style={{ fontSize: "1.02rem", fontWeight: 700, color: "#F0F2FF", marginBottom: "0.5rem" }}>{c.title}</h3>
              <p style={{ fontSize: "0.88rem", color: "#8892A4", lineHeight: 1.65 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── MOBILE APP COMING SOON ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "7rem 3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
        <div>
          <div style={{
            display: "inline-block", background: "rgba(37,99,255,0.1)", color: "#4D8CFF",
            fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 100,
            marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            Coming soon
          </div>
          <div style={tag}>Mobile app</div>
          <h2 style={h2}>Manage your business from anywhere</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", lineHeight: 1.75, marginBottom: "1.8rem" }}>
            The BookdIn mobile app is coming for iOS and Android. Your staff will see their assigned jobs, update status from the field, and you'll get real-time notifications on every new booking.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginBottom: "2rem" }}>
            {[
              "Providers see and manage their assigned jobs",
              "Real-time push notifications for new bookings",
              "Dashboard snapshot — revenue & bookings today",
              "Update job status from the field",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <span style={{ color: "#2563FF", fontWeight: 700, fontSize: "0.9rem" }}>✓</span>
                <span style={{ fontSize: "0.93rem", color: "#c8d4e8" }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {["App Store", "Google Play"].map(store => (
              <div key={store} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "0.6rem 1.2rem",
                display: "flex", alignItems: "center", gap: "0.5rem",
                opacity: 0.5,
              }}>
                <span style={{ fontSize: "1.1rem" }}>{store === "App Store" ? "🍎" : "▶"}</span>
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#8892A4" }}>Coming soon on</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F0F2FF" }}>{store}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Phone mockup */}
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", alignItems: "center" }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: 200, height: 380, borderRadius: 28,
              background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
              transform: i === 0 ? "rotate(-4deg) translateY(20px)" : "rotate(2deg)",
              overflow: "hidden", flexShrink: 0,
              display: "flex", flexDirection: "column",
            }}>
              {/* Phone notch */}
              <div style={{ display: "flex", justifyContent: "center", padding: "0.8rem 0 0.4rem" }}>
                <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)" }} />
              </div>
              {/* App content */}
              <div style={{ flex: 1, padding: "0.8rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#4D8CFF", marginBottom: "0.3rem" }}>
                  {i === 0 ? "My Jobs Today" : "Dashboard"}
                </div>
                {i === 0 ? (
                  [["Sarah M.", "General Clean", "9:00 AM", "#22c55e"],
                   ["James T.", "Deep Clean", "12:00 PM", "#eab308"],
                   ["Kim R.", "Move In", "3:00 PM", "#4D8CFF"]].map(([n, s, t, c]) => (
                    <div key={n} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "0.6rem", border: `1px solid ${c}22` }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "#F0F2FF" }}>{n}</div>
                      <div style={{ fontSize: "0.58rem", color: "#8892A4" }}>{s}</div>
                      <div style={{ fontSize: "0.58rem", color: c, marginTop: 2 }}>{t}</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div style={{ background: "rgba(37,99,255,0.1)", borderRadius: 8, padding: "0.8rem", border: "1px solid rgba(37,99,255,0.2)" }}>
                      <div style={{ fontSize: "0.6rem", color: "#8892A4" }}>Revenue today</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#F0F2FF" }}>$1,840</div>
                      <div style={{ fontSize: "0.58rem", color: "#22c55e" }}>↑ 12% vs yesterday</div>
                    </div>
                    {[["Bookings", "8"], ["Providers", "5"], ["Pending", "2"]].map(([l, v]) => (
                      <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.62rem", color: "#8892A4" }}>{l}</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#F0F2FF" }}>{v}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── FEATURE COMPARISON ── */}
      <section id="compare" style={{ maxWidth: 1000, margin: "0 auto", padding: "7rem 3rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <div style={tag}>Full feature breakdown</div>
          <h2 style={{ ...h2, fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>Everything you need, nothing you don't</h2>
          <p style={{ color: "#8892A4", fontSize: "1rem", marginTop: "0.5rem" }}>See exactly how BookdIn compares to other booking tools</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left", width: "55%" }}>Feature</th>
                <th style={{ ...thStyle, textAlign: "center", color: "#4D8CFF", background: "rgba(37,99,255,0.08)", borderLeft: "1px solid rgba(37,99,255,0.15)", borderRight: "1px solid rgba(37,99,255,0.15)", borderRadius: "10px 10px 0 0" }}>BookdIn</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Others</th>
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
                { label: "CRM lead pipeline", note: "Track leads from first enquiry to won job", bi: true, o: false, ex: true },
                { label: "Revenue analytics & reporting", note: "Weekly/monthly trends, provider performance, LTV", bi: true, o: false, ex: true },
                { label: "Automated follow-ups", note: "Daily automated payment capture & follow-ups", bi: true, o: false, ex: true },
                { label: "Room-based dynamic pricing", note: "Auto-calculate quotes by bedrooms & extras", bi: true, o: false, ex: true },
                { label: "Free trial", biVal: "14 days", oVal: "7 days" },
                { label: "Starting price", biVal: "$49/mo", oVal: "$67/mo" },
              ].map((row, i) => (
                <tr key={i} style={{ background: row.ex ? "rgba(37,99,255,0.04)" : "transparent" }}>
                  <td style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontWeight: 500, color: "#F0F2FF" }}>{row.label}</span>
                    {row.ex && <span style={{ background: "rgba(37,99,255,0.15)", color: "#4D8CFF", fontSize: "0.63rem", fontWeight: 700, padding: "1px 7px", borderRadius: 100, marginLeft: "0.5rem" }}>BookdIn only</span>}
                    {row.note && <span style={{ display: "block", fontSize: "0.75rem", color: "#4a5568", marginTop: "0.2rem" }}>{row.note}</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(37,99,255,0.04)", borderLeft: "1px solid rgba(37,99,255,0.1)", borderRight: "1px solid rgba(37,99,255,0.1)" }}>
                    {row.biVal ? <span style={{ color: "#22c55e", fontWeight: 700 }}>{row.biVal}</span> : row.bi ? <span style={{ color: "#22c55e", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {row.oVal ? <span style={{ color: "#6b7f99" }}>{row.oVal}</span> : row.o ? <span style={{ color: "#22c55e", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── PRICING ── */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "7rem 3rem", textAlign: "center" }}>
        <div style={tag}>Pricing</div>
        <h2 style={{ ...h2, fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>Simple, transparent pricing</h2>
        <p style={{ fontSize: "1rem", color: "#8892A4", marginBottom: "3.5rem" }}>
          No per-booking fees. No hidden charges. Start free for 14 days.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.2rem", maxWidth: 820, margin: "0 auto 2rem", textAlign: "left" }}>
          {[
            { name: "Starter", price: "$49", period: "/mo", desc: "Up to 3 staff, unlimited bookings, invoicing, public booking page, room pricing", featured: false },
            { name: "Growth", price: "$99", period: "/mo", desc: "Unlimited staff, CRM pipeline, revenue analytics, recurring automation, gift cards", featured: true },
            { name: "Enterprise", price: "Custom", period: "", desc: "Multi-location, custom integrations, dedicated onboarding & support", featured: false },
          ].map(p => (
            <div key={p.name} style={{
              background: p.featured ? "rgba(37,99,255,0.08)" : "rgba(255,255,255,0.03)",
              border: p.featured ? "1px solid rgba(37,99,255,0.4)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "1.8rem", position: "relative",
              boxShadow: p.featured ? "0 0 50px rgba(37,99,255,0.1)" : "none",
            }}>
              {p.featured && <div style={{ position: "absolute", top: "1.2rem", right: "1.2rem", background: "#2563FF", color: "#fff", fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: 100 }}>Most popular</div>}
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#4a5568", marginBottom: "0.7rem" }}>{p.name}</div>
              <div style={{ fontSize: "2.8rem", fontWeight: 700, color: "#F0F2FF", letterSpacing: "-1.5px", lineHeight: 1 }}>
                {p.price}<span style={{ fontSize: "0.9rem", fontWeight: 400, color: "#4a5568" }}>{p.period}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#6b7f99", margin: "0.7rem 0 1.5rem", lineHeight: 1.6 }}>{p.desc}</p>
              <Link href="/auth/signup" style={{
                display: "block", textAlign: "center", padding: "0.75rem",
                borderRadius: 9, textDecoration: "none", fontWeight: 600, fontSize: "0.92rem",
                background: p.featured ? "#2563FF" : "transparent",
                color: p.featured ? "#fff" : "#F0F2FF",
                border: p.featured ? "none" : "1px solid rgba(255,255,255,0.12)",
              }}>
                {p.price === "Custom" ? "Contact us" : "Start 14-day trial"}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.82rem", color: "#4a5568" }}>
          No credit card required · 14-day free trial on all plans · Cancel anytime
        </p>
      </section>

      {/* ── FINAL CTA ── */}
      <div style={{ padding: "0 2rem 6rem", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{
          borderRadius: 24,
          background: "linear-gradient(135deg, rgba(37,99,255,0.2), rgba(37,99,255,0.05))",
          border: "1px solid rgba(37,99,255,0.3)",
          padding: "6rem 2rem", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,255,0.12) 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }} />
          <h2 style={{ ...h2, fontSize: "clamp(2rem, 4vw, 3.2rem)", marginBottom: "0.8rem", position: "relative" }}>
            Ready to get{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>booked in</em>?
          </h2>
          <p style={{ color: "#8892A4", marginBottom: "2.5rem", fontSize: "1.05rem", position: "relative" }}>
            14-day free trial. No credit card. Up and running in under 24 hours.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
            <Link href="/auth/signup" style={{
              background: "#2563FF", color: "#fff", padding: "0.95rem 2.2rem",
              borderRadius: 11, textDecoration: "none", fontWeight: 700, fontSize: "1.02rem",
              boxShadow: "0 0 48px rgba(37,99,255,0.4)", display: "inline-block",
            }}>
              Start free trial — no card needed
            </Link>
            <Link href="/api/demo/login" style={{
              background: "transparent", color: "#F0F2FF", padding: "0.95rem 2.2rem",
              borderRadius: 11, textDecoration: "none", fontWeight: 600, fontSize: "1.02rem",
              border: "1px solid rgba(255,255,255,0.15)", display: "inline-block",
            }}>
              Explore live demo →
            </Link>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#4a5568", marginTop: "1.5rem" }}>
            Or explore the{" "}
            <Link href="/api/demo/login" style={{ color: "#4D8CFF", textDecoration: "none" }}>live demo</Link>
            {" "}— no sign-up needed
          </p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

const tag: React.CSSProperties = {
  fontSize: "0.73rem", fontWeight: 700, letterSpacing: "1.2px",
  textTransform: "uppercase", color: "#2563FF", marginBottom: "0.7rem",
  display: "block",
};
const h2: React.CSSProperties = {
  fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 700,
  letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: "0.8rem", color: "#F0F2FF",
};
const thStyle: React.CSSProperties = {
  padding: "1rem 1.2rem", fontWeight: 600, fontSize: "0.75rem",
  textTransform: "uppercase", letterSpacing: "0.5px", color: "#4a5568",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};
