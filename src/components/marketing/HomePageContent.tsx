// @ts-nocheck
"use client";
import Link from "next/link";
import { useState } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export default function HomePageContent() {
  const [email, setEmail] = useState("");

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <MarketingNav />

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        padding: "8rem 3rem 4rem", maxWidth: 1200, margin: "0 auto",
        gap: "4rem", position: "relative",
      }}>
        {/* glow */}
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,255,0.14) 0%, transparent 70%)",
          top: "40%", left: "20%", transform: "translate(-50%,-50%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* Left */}
        <div style={{ flex: "0 0 480px", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "rgba(37,99,255,0.1)", border: "1px solid rgba(37,99,255,0.25)",
            color: "#4D8CFF", padding: "0.35rem 1rem", borderRadius: 100,
            fontSize: "0.75rem", fontWeight: 600, marginBottom: "1.5rem",
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "block" }} />
            Now in early access
          </div>

          <h1 style={{
            fontSize: "clamp(2.8rem, 4.5vw, 4rem)", fontWeight: 700,
            letterSpacing: "-1.5px", lineHeight: 1.07, marginBottom: "1.2rem",
            color: "#F0F2FF",
          }}>
            The booking platform that{" "}
            <em style={{ fontStyle: "normal", color: "#2563FF" }}>grows your revenue</em>
          </h1>

          <p style={{ fontSize: "1.05rem", color: "#8892A4", lineHeight: 1.7, marginBottom: "2rem", maxWidth: 420 }}>
            BookdIn goes beyond scheduling. CRM pipeline, revenue analytics, staff management, and automated follow-ups — everything you need to run and grow a service business.
          </p>

          {/* Email capture */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              style={{
                flex: "1 1 220px", padding: "0.85rem 1.2rem",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)", color: "#F0F2FF",
                fontSize: "0.95rem", outline: "none",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <Link
              href={email ? `/auth/signup?email=${encodeURIComponent(email)}` : "/auth/signup"}
              style={{
                background: "#2563FF", color: "#fff", padding: "0.85rem 1.8rem",
                borderRadius: 10, textDecoration: "none", fontWeight: 600,
                fontSize: "0.95rem", whiteSpace: "nowrap",
                boxShadow: "0 0 32px rgba(37,99,255,0.35)",
              }}
            >
              Start free trial →
            </Link>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#8892A4" }}>
            No credit card required · <strong style={{ color: "#F0F2FF" }}>14-day free trial</strong> · Cancel anytime
          </p>

          {/* Mini social proof */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
            <div style={{ display: "flex" }}>
              {["#2563FF","#4D8CFF","#1d4ed8","#3b82f6"].map((c,i) => (
                <div key={i} style={{
                  width: 32, height: 32, borderRadius: "50%", background: c,
                  border: "2px solid #0A0F1E", marginLeft: i > 0 ? -8 : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                }}>
                  {["JM","SR","AL","KW"][i]}
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                {"★★★★★".split("").map((s,i) => <span key={i} style={{ color: "#eab308", fontSize: "0.8rem" }}>{s}</span>)}
              </div>
              <span style={{ fontSize: "0.78rem", color: "#8892A4" }}>Loved by service businesses</span>
            </div>
          </div>
        </div>

        {/* Right - dashboard screenshot */}
        <div style={{ flex: 1, position: "relative", zIndex: 1, minWidth: 0 }}>
          <div style={{
            borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.5), 0 0 60px rgba(37,99,255,0.08)",
          }}>
            <div style={{
              background: "#0d1424", padding: "0.7rem 1rem",
              display: "flex", alignItems: "center", gap: "0.4rem",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              {["#FF5F57","#FEBC2E","#28C840"].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <img
              src="/screenshots/dashboard.png"
              alt="BookdIn dashboard"
              style={{ width: "100%", display: "block" }}
            />
          </div>
          {/* Floating badge */}
          <div style={{
            position: "absolute", bottom: -16, left: -20,
            background: "#111827", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "0.8rem 1.2rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", gap: "0.7rem",
          }}>
            <div style={{ fontSize: "1.2rem" }}>📈</div>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#F0F2FF" }}>$54,448 this month</div>
              <div style={{ fontSize: "0.68rem", color: "#22c55e" }}>↑ 100% vs last period</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── UPTIME + TRUST BAR ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "1.5rem 3rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: "0.85rem", color: "#F0F2FF", fontWeight: 500 }}>
              All systems operational · <span style={{ color: "#22c55e", fontWeight: 700 }}>99.9% uptime guaranteed</span>
            </span>
          </div>
          {/* Integration logos text */}
          <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
            {["Stripe", "Supabase", "Vercel", "Resend"].map(name => (
              <span key={name} style={{ fontSize: "0.82rem", color: "#8892A4", fontWeight: 600, letterSpacing: "0.3px" }}>{name}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              background: "rgba(37,99,255,0.15)", border: "1px solid rgba(37,99,255,0.3)",
              borderRadius: 6, padding: "0.3rem 0.7rem",
              fontSize: "0.72rem", fontWeight: 700, color: "#4D8CFF", letterSpacing: "0.5px",
            }}>
              STRIPE VERIFIED PARTNER
            </div>
          </div>
        </div>
      </div>

      {/* ── PROOF STATS ── */}
      <div style={{ padding: "4rem 3rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: 1, color: "#8892A4", marginBottom: "2rem" }}>
          Why service businesses choose BookdIn
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "5rem", flexWrap: "wrap" }}>
          {[
            { val: "99.9%", lbl: "Uptime guaranteed" },
            { val: "14", lbl: "Day free trial — no card" },
            { val: "CRM", lbl: "Built-in lead pipeline" },
            { val: "∞", lbl: "Bookings on every plan" },
          ].map(s => (
            <div key={s.val} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#F0F2FF", letterSpacing: "-1px" }}>{s.val}</div>
              <div style={{ fontSize: "0.8rem", color: "#8892A4", marginTop: "0.3rem" }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── BOOKINGS SCREENSHOT FEATURE ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
        <div>
          <div style={tag}>Bookings</div>
          <h2 style={h2}>Manage bookings like a pro</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Every booking in one place. Filter by status, assign providers, track payments, and manage your whole schedule from a single screen.
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {["Recurring jobs — set once, run forever", "Auto credit card holds on every booking", "Assign providers with one click", "Filter by today, this week, unassigned"].map(f => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.7rem", fontSize: "0.92rem", color: "#F0F2FF" }}>
                <span style={{ color: "#2563FF", fontWeight: 700 }}>✓</span>{f}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
          <img src="/screenshots/bookings.png" alt="BookdIn bookings" style={{ width: "100%", display: "block" }} />
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── CRM SECTION ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 3rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
        <div style={{
          borderRadius: 14, background: "rgba(37,99,255,0.05)",
          border: "1px solid rgba(37,99,255,0.2)",
          padding: "2rem",
        }}>
          {/* CRM pipeline illustration */}
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4D8CFF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "1.2rem" }}>Lead Pipeline</div>
          {[
            { stage: "New Lead", count: 4, color: "#8892A4" },
            { stage: "Contacted", count: 7, color: "#eab308" },
            { stage: "Quoted", count: 5, color: "#4D8CFF" },
            { stage: "Won", count: 12, color: "#22c55e" },
          ].map(col => (
            <div key={col.stage} style={{ marginBottom: "0.8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", color: col.color, fontWeight: 600 }}>{col.stage}</span>
                <span style={{ fontSize: "0.78rem", color: "#8892A4" }}>{col.count} contacts</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(col.count / 12) * 100}%`, background: col.color, borderRadius: 3, opacity: 0.7 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: "1.5rem", padding: "0.8rem", background: "rgba(34,197,94,0.08)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }}>
            <div style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 600 }}>12 leads won this month</div>
            <div style={{ fontSize: "0.72rem", color: "#8892A4", marginTop: "0.2rem" }}>$8,340 pipeline value</div>
          </div>
        </div>
        <div>
          <div style={{ display: "inline-block", background: "rgba(37,99,255,0.15)", color: "#4D8CFF", fontSize: "0.68rem", fontWeight: 700, padding: "2px 10px", borderRadius: 100, marginBottom: "0.8rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>
            BookdIn exclusive
          </div>
          <div style={tag}>CRM & Pipeline</div>
          <h2 style={h2}>Stop losing leads to poor follow-up</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Most booking tools only manage existing customers. BookdIn's CRM tracks every lead from first enquiry to won job — so you capture revenue that would otherwise slip through the cracks.
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {["Kanban pipeline: Lead → Contacted → Quoted → Won", "Log calls, emails, and notes per contact", "Automated follow-up reminders", "Convert quotes directly to bookings"].map(f => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.7rem", fontSize: "0.92rem", color: "#F0F2FF" }}>
                <span style={{ color: "#2563FF", fontWeight: 700 }}>✓</span>{f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── TESTIMONIAL ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "6rem 3rem", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: "1.5rem" }}>
          {"★★★★★".split("").map((s,i) => <span key={i} style={{ color: "#eab308", fontSize: "1.4rem" }}>{s}</span>)}
        </div>
        <blockquote style={{
          fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)", fontWeight: 600,
          color: "#F0F2FF", lineHeight: 1.4, letterSpacing: "-0.3px",
          marginBottom: "2rem", fontStyle: "normal",
        }}>
          "BookdIn replaced three separate tools we were using. The CRM alone has helped us convert enquiries we used to just lose track of."
        </blockquote>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "linear-gradient(135deg, #2563FF, #4D8CFF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.9rem", fontWeight: 700, color: "#fff",
          }}>CF</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, color: "#F0F2FF", fontSize: "0.95rem" }}>Clean Freaks</div>
            <div style={{ color: "#8892A4", fontSize: "0.82rem" }}>Cleaning company, Australia</div>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── REVENUE SECTION ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 3rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <div style={tag}>Revenue growth</div>
          <h2 style={{ ...h2, maxWidth: 600, margin: "0 auto 1rem" }}>More than a booking tool — a growth engine</h2>
          <p style={{ fontSize: "1rem", color: "#8892A4", maxWidth: 480, margin: "0 auto", lineHeight: 1.65 }}>
            Most booking platforms keep your operation running. BookdIn helps you win more jobs, convert more leads, and keep customers longer.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.2rem" }}>
          {[
            { icon: "🧲", title: "Never lose a lead", desc: "CRM pipeline tracks every enquiry. Most businesses lose 30–40% of leads to poor follow-up.", highlight: true },
            { icon: "📊", title: "Know what's working", desc: "Revenue charts, booking trends, and provider performance — make decisions based on data." },
            { icon: "🔁", title: "Recurring on autopilot", desc: "Auto-create recurring jobs, send reminders, capture payment. Set once, get paid forever.", highlight: true },
            { icon: "💸", title: "Dynamic pricing", desc: "Room-based pricing calculates quotes instantly as customers configure their booking." },
          ].map(c => (
            <div key={c.title} style={{
              background: c.highlight ? "rgba(37,99,255,0.06)" : "rgba(255,255,255,0.03)",
              border: c.highlight ? "1px solid rgba(37,99,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "1.6rem",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.8rem" }}>{c.icon}</div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#F0F2FF", marginBottom: "0.4rem" }}>{c.title}</h3>
              <p style={{ fontSize: "0.87rem", color: "#8892A4", lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── FEATURE COMPARISON ── */}
      <section id="compare" style={{ maxWidth: 1000, margin: "0 auto", padding: "6rem 3rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={tag}>Full feature breakdown</div>
          <h2 style={h2}>Everything you need, nothing you don't</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left", width: "55%" }}>Feature</th>
                <th style={{ ...thStyle, textAlign: "center", color: "#4D8CFF", background: "rgba(37,99,255,0.08)", borderLeft: "1px solid rgba(37,99,255,0.15)", borderRight: "1px solid rgba(37,99,255,0.15)" }}>BookdIn</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Others</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Online booking & scheduling", bi: true, o: true },
                { label: "Stripe payments & card holds", bi: true, o: true },
                { label: "Invoicing & quotes", bi: true, o: true },
                { label: "Staff / provider portal", bi: true, o: true },
                { label: "Recurring jobs", bi: true, o: true },
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
                  <td style={{ padding: "0.85rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontWeight: 500, color: "#F0F2FF" }}>{row.label}</span>
                    {row.ex && <span style={{ background: "rgba(37,99,255,0.15)", color: "#4D8CFF", fontSize: "0.65rem", fontWeight: 700, padding: "1px 7px", borderRadius: 100, marginLeft: "0.5rem" }}>BookdIn</span>}
                    {row.note && <span style={{ display: "block", fontSize: "0.75rem", color: "#8892A4", marginTop: "0.1rem" }}>{row.note}</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.85rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(37,99,255,0.04)", borderLeft: "1px solid rgba(37,99,255,0.12)", borderRight: "1px solid rgba(37,99,255,0.12)" }}>
                    {row.biVal ? <span style={{ color: "#22c55e", fontWeight: 600 }}>{row.biVal}</span> : row.bi ? <span style={{ color: "#22c55e" }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.85rem 1.2rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {row.oVal ? <span style={{ color: "#8892A4" }}>{row.oVal}</span> : row.o ? <span style={{ color: "#22c55e" }}>✓</span> : <span style={{ color: "#ef4444" }}>✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* ── PRICING TEASER ── */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "6rem 3rem", textAlign: "center" }}>
        <div style={tag}>Pricing</div>
        <h2 style={h2}>Simple, transparent pricing</h2>
        <p style={{ fontSize: "1rem", color: "#8892A4", marginBottom: "3rem" }}>No per-booking fees. No hidden charges. Start free for 14 days.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.2rem", maxWidth: 800, margin: "0 auto 2rem", textAlign: "left" }}>
          {[
            { name: "Starter", price: "$49", desc: "Up to 3 staff, unlimited bookings, invoicing, public booking page", featured: false },
            { name: "Growth", price: "$99", desc: "Unlimited staff, CRM pipeline, revenue analytics, full automation", featured: true },
            { name: "Enterprise", price: "Custom", desc: "Multi-location, custom integrations, dedicated support", featured: false },
          ].map(p => (
            <div key={p.name} style={{
              background: p.featured ? "rgba(37,99,255,0.08)" : "rgba(255,255,255,0.03)",
              border: p.featured ? "1px solid rgba(37,99,255,0.4)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "1.6rem", position: "relative",
            }}>
              {p.featured && <div style={{ position: "absolute", top: "1rem", right: "1rem", background: "#2563FF", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>Most popular</div>}
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#8892A4", marginBottom: "0.5rem" }}>{p.name}</div>
              <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#F0F2FF", letterSpacing: "-1px", marginBottom: "0.5rem" }}>{p.price}<span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#8892A4" }}>{p.price !== "Custom" ? "/mo" : ""}</span></div>
              <p style={{ fontSize: "0.83rem", color: "#8892A4", lineHeight: 1.55 }}>{p.desc}</p>
            </div>
          ))}
        </div>
        <Link href="/pricing" style={{ ...btnPrimary, display: "inline-block" }}>See full pricing & features</Link>
      </section>

      {/* ── CTA BAND ── */}
      <div style={{ padding: "0 2rem 5rem", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(37,99,255,0.18), rgba(37,99,255,0.04))",
          border: "1px solid rgba(37,99,255,0.3)",
          padding: "5rem 2rem", textAlign: "center",
        }}>
          <h2 style={{ ...h2, marginBottom: "0.8rem" }}>
            Ready to get <em style={{ fontStyle: "normal", color: "#2563FF" }}>booked in</em>?
          </h2>
          <p style={{ color: "#8892A4", marginBottom: "2rem", fontSize: "1rem" }}>
            14-day free trial. No credit card. Up and running in under 24 hours.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/signup" style={btnPrimary}>Start free trial — no card needed</Link>
            <Link href="/pricing" style={btnGhost}>See pricing</Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

const tag: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 700, letterSpacing: "1.2px",
  textTransform: "uppercase", color: "#2563FF", marginBottom: "0.8rem",
};
const h2: React.CSSProperties = {
  fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 700,
  letterSpacing: "-0.8px", lineHeight: 1.12, marginBottom: "0.8rem", color: "#F0F2FF",
};
const thStyle: React.CSSProperties = {
  padding: "1rem 1.2rem", fontWeight: 600, fontSize: "0.78rem",
  textTransform: "uppercase", letterSpacing: "0.5px", color: "#8892A4",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};
const btnPrimary: React.CSSProperties = {
  background: "#2563FF", color: "#fff", padding: "0.85rem 2rem",
  borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "1rem",
  boxShadow: "0 0 36px rgba(37,99,255,0.3)",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", color: "#F0F2FF", padding: "0.85rem 2rem",
  borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "1rem",
  border: "1px solid rgba(255,255,255,0.15)",
};
