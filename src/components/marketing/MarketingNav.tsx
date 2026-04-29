// @ts-nocheck
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200 }}>

      {/* Announcement bar */}
      <div style={{
        background: "linear-gradient(90deg, #1e3a8a, #2563FF, #1e3a8a)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        fontSize: "0.82rem", color: "#e0f2fe", fontWeight: 500,
        overflow: "hidden",
        maxHeight: scrolled ? 0 : 38,
        opacity: scrolled ? 0 : 1,
        padding: scrolled ? "0 1.5rem" : "0.45rem 1.5rem",
        transition: "max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease",
        whiteSpace: "nowrap",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
          Explore BookdIn in real-time — no sign-up needed
        </span>
        <a href="/api/demo/login" style={{
          background: "#fff", color: "#1d4ed8", padding: "0.2rem 0.85rem",
          borderRadius: 100, fontSize: "0.77rem", fontWeight: 700,
          textDecoration: "none", flexShrink: 0,
        }}>
          Live Demo →
        </a>
      </div>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 2.5rem",
        background: scrolled ? "rgba(10,15,30,0.97)" : "rgba(10,15,30,0.88)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        transition: "background 0.3s",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.3)" : "none",
        gap: "1rem",
      }}>
        <Link href="/" style={{
          fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.5px",
          color: "#F0F2FF", textDecoration: "none", flexShrink: 0,
        }}>
          Bookd<span style={{ color: "#2563FF" }}>I</span>n
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexShrink: 0 }}>
          <Link href="/#compare" style={navLink}>Features</Link>
          <Link href="/#revenue" style={navLink}>Revenue</Link>
          <Link href="/pricing" style={navLink}>Pricing</Link>
          <Link href="/about" style={navLink}>About</Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <a href="/api/demo/login" style={{
            background: "transparent", color: "#F0F2FF",
            padding: "0.45rem 1rem", borderRadius: "8px",
            textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", gap: "0.4rem",
            whiteSpace: "nowrap",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} />
            Live demo
          </a>
          <Link href="/auth/signup" style={{
            background: "#2563FF", color: "#fff",
            padding: "0.45rem 1.1rem", borderRadius: "8px",
            textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
            Start free trial
          </Link>
        </div>
      </nav>
    </div>
  );
}

const navLink: React.CSSProperties = {
  color: "#8892A4", textDecoration: "none",
  fontSize: "0.87rem", transition: "color 0.2s",
  whiteSpace: "nowrap",
};
