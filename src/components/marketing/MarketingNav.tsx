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
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
    }}>
      {/* Announcement bar — slides up and hides on scroll */}
      <div style={{
        background: "linear-gradient(90deg, #1e3a8a, #2563FF, #1e3a8a)",
        padding: "0.5rem 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        fontSize: "0.82rem", color: "#e0f2fe", fontWeight: 500,
        overflow: "hidden",
        maxHeight: scrolled ? 0 : 40,
        opacity: scrolled ? 0 : 1,
        transition: "max-height 0.3s ease, opacity 0.2s ease, padding 0.3s ease",
        paddingTop: scrolled ? 0 : undefined,
        paddingBottom: scrolled ? 0 : undefined,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Explore BookdIn in real-time — no sign-up needed
        </span>
        <a href="/api/demo/login" style={{
          background: "#fff", color: "#1d4ed8", padding: "0.2rem 0.9rem",
          borderRadius: 100, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          Live Demo →
        </a>
      </div>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 3rem",
        background: scrolled ? "rgba(10,15,30,0.97)" : "rgba(10,15,30,0.88)",
        backdropFilter: "blur(16px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.3)" : "none",
      }}>
        <Link href="/" style={{
          fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.5px",
          color: "#F0F2FF", textDecoration: "none", fontFamily: "'DM Sans', sans-serif",
        }}>
          Bookd<span style={{ color: "#2563FF" }}>I</span>n
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <Link href="/#compare" style={navLink}>Features</Link>
          <Link href="/#revenue" style={navLink}>Revenue</Link>
          <Link href="/pricing" style={navLink}>Pricing</Link>
          <Link href="/about" style={navLink}>About</Link>
          <a href="/api/demo/login" style={{
            background: "transparent", color: "#F0F2FF",
            padding: "0.5rem 1.2rem", borderRadius: "8px",
            textDecoration: "none", fontSize: "0.88rem", fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            Live demo
          </a>
          <Link href="/auth/signup" style={{
            background: "#2563FF", color: "#fff", padding: "0.5rem 1.3rem",
            borderRadius: "8px", textDecoration: "none", fontSize: "0.88rem", fontWeight: 600,
          }}>
            Start free trial
          </Link>
        </div>
      </nav>
    </div>
  );
}

const navLink: React.CSSProperties = {
  color: "#8892A4", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s",
};
