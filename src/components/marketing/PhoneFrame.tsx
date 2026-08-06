"use client";
import { useTilt } from "@/hooks/useTilt";

export default function PhoneFrame({
  children, width = 340, glow = false,
}: {
  children: React.ReactNode; width?: number; glow?: boolean;
}) {
  const height = Math.round(width * 2.05);
  const { ref, rotateX, rotateY, scale } = useTilt<HTMLDivElement>(8, 1.02);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      {glow && (
        <div style={{
          position: "absolute", inset: "-14%",
          background: "radial-gradient(55% 55% at 50% 40%, rgba(124,58,237,0.32), transparent 70%)",
          filter: "blur(50px)", zIndex: 0, pointerEvents: "none",
        }} />
      )}
      <div
        ref={ref}
        style={{
          position: "relative", zIndex: 1, width: "100%", height: "100%",
          borderRadius: width * 0.15,
          background: "#050810", border: "2px solid rgba(255,255,255,0.14)",
          boxShadow: "0 50px 120px rgba(0,0,0,0.6), 0 0 60px rgba(0,0,0,0.3)",
          padding: width * 0.035,
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformOrigin: "center",
          willChange: "transform",
        }}>
        {/* Dynamic-island notch */}
        <div style={{
          position: "absolute", top: width * 0.045, left: "50%", transform: "translateX(-50%)",
          width: width * 0.3, height: width * 0.065, borderRadius: width * 0.06,
          background: "#000", zIndex: 2,
        }} />
        <div style={{
          width: "100%", height: "100%", borderRadius: width * 0.12,
          background: "#0A0F1E", overflow: "hidden", position: "relative",
        }}>
          {children}
        </div>
        {/* Side button details */}
        <div style={{ position: "absolute", right: -2, top: width * 0.28, width: 2, height: width * 0.1, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: -2, top: width * 0.22, width: 2, height: width * 0.06, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: -2, top: width * 0.32, width: 2, height: width * 0.1, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
      </div>
    </div>
  );
}
