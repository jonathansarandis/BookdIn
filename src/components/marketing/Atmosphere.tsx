const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

/** Large blurred color blob for ambient depth behind a section. Purely decorative. */
export function GradientOrb({
  color = "#7c3aed", size = 420, top, left, right, bottom, opacity = 0.28, blur = 100,
}: {
  color?: string; size?: number;
  top?: number | string; left?: number | string; right?: number | string; bottom?: number | string;
  opacity?: number; blur?: number;
}) {
  // Deterministic per-orb variation so multiple orbs don't float in lockstep.
  const duration = 6 + (size % 5) * 0.4;
  const delay = -((size % 7) * 0.5);

  return (
    <div className="bd-orb-float" style={{
      position: "absolute", width: size, height: size, borderRadius: "50%",
      background: color, opacity, filter: `blur(${blur}px)`,
      top, left, right, bottom, pointerEvents: "none", zIndex: 0,
      animationDuration: `${duration}s`, animationDelay: `${delay}s`,
    }} />
  );
}

/** Faint film-grain overlay for texture on dark sections. Parent needs position:relative + overflow:hidden. */
export function Grain({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <div style={{
      position: "absolute", inset: 0, backgroundImage: NOISE_URL,
      opacity, pointerEvents: "none", zIndex: 0, mixBlendMode: "overlay",
    }} />
  );
}

/** Gentle wave divider that overlaps the bottom of a section, painted in the color of the section below it. */
export function CurveDivider({ fill }: { fill: string }) {
  return (
    <div style={{ position: "relative", lineHeight: 0, marginBottom: -1 }} aria-hidden>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: "100%", height: 70, display: "block" }}>
        <path d="M0,45 C360,95 1080,-15 1440,45 L1440,90 L0,90 Z" fill={fill} />
      </svg>
    </div>
  );
}
