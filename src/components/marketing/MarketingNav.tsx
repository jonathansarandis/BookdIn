// @ts-nocheck
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 3rem",
        background: scrolled ? "rgba(10,15,30,0.95)" : "rgba(10,15,30,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        transition: "background 0.3s",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "1.45rem",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          color: "#F0F2FF",
          textDecoration: "none",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Bookd<span style={{ color: "#2563FF" }}>I</span>n
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link href="/#compare" style={navLink}>Features</Link>
        <Link href="/#revenue" style={navLink}>Revenue</Link>
        <Link href="/pricing" style={navLink}>Pricing</Link>
        <Link href="/about" style={navLink}>About</Link>

        {/* Live Demo button */}
        <Link
          href="/api/demo/login"
          style={{
            background: "transparent",
            color: "#F0F2FF",
            padding: "0.5rem 1.2rem",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "0.88rem",
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.2)",
            transition: "border-color 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Live demo
        </Link>

        <Link
          href="/auth/signup"
          style={{
            background: "#2563FF",
            color: "#fff",
            padding: "0.5rem 1.3rem",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "0.88rem",
            fontWeight: 600,
            transition: "background 0.2s",
          }}
        >
          Start free trial
        </Link>
      </div>
    </nav>
  );
}

const navLink: React.CSSProperties = {
  color: "#8892A4",
  textDecoration: "none",
  fontSize: "0.88rem",
  transition: "color 0.2s",
};
