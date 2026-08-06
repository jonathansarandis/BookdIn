export default function BrowserFrame({
  src, alt, glow = false, tilt = false, url = "bookdin.co",
}: {
  src: string; alt: string; glow?: boolean; tilt?: boolean; url?: string;
}) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {glow && (
        <div style={{
          position: "absolute", inset: "-8%",
          background: "radial-gradient(55% 55% at 50% 35%, rgba(124,58,237,0.35), transparent 70%)",
          filter: "blur(50px)", zIndex: 0, pointerEvents: "none",
        }} />
      )}
      <div style={{
        position: "relative", zIndex: 1,
        borderRadius: 16, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: glow
          ? "0 50px 120px rgba(0,0,0,0.55), 0 0 100px rgba(124,58,237,0.18)"
          : "0 40px 100px rgba(0,0,0,0.45)",
        background: "#0d1424",
        transform: tilt ? "perspective(2200px) rotateX(3.5deg)" : undefined,
        transformOrigin: "center bottom",
      }}>
        <div style={{
          padding: "0.7rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d1424",
        }}>
          <div style={{ display: "flex", gap: "0.4rem", flex: "0 0 auto" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              background: "rgba(255,255,255,0.06)", borderRadius: 6,
              padding: "0.3rem 1.2rem", fontSize: "0.75rem", color: "#8892A4",
              maxWidth: 280,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {url}
            </div>
          </div>
          <div style={{ width: 34, flex: "0 0 auto" }} />
        </div>
        <img src={src} alt={alt} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
}
