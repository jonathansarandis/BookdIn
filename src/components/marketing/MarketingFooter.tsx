// @ts-nocheck
import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "2rem 3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: "1080px",
        margin: "0 auto",
        color: "#8892A4",
        fontSize: "0.83rem",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "#F0F2FF",
          textDecoration: "none",
        }}
      >
        Bookd<span style={{ color: "#2563FF" }}>I</span>n
      </Link>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <Link href="/#compare" style={footerLink}>Features</Link>
        <Link href="/pricing" style={footerLink}>Pricing</Link>
        <Link href="/about" style={footerLink}>About</Link>
        <Link href="/privacy" style={footerLink}>Privacy</Link>
        <Link href="/terms" style={footerLink}>Terms</Link>
      </div>

      <span>© {new Date().getFullYear()} BookdIn</span>
    </footer>
  );
}

const footerLink: React.CSSProperties = {
  color: "#8892A4",
  textDecoration: "none",
};
