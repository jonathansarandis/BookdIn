"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface TiltState {
  rotateX: number;
  rotateY: number;
  scale: number;
}

const LERP = 0.12;
const EPSILON = 0.01;
const SCALE_EPSILON = 0.0005;

/**
 * Cursor-relative 3D tilt. Attach `ref` to the element being tracked and use
 * rotateX/rotateY/scale to build a `transform` string. Values are lerped
 * toward the cursor-derived target every frame so motion feels fluid rather
 * than snapping directly to the mouse position, and ease back to rest
 * (0, 0, 1) once the cursor leaves. No-ops under prefers-reduced-motion.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxTilt = 8, hoverScale = 1.02) {
  const ref = useRef<T | null>(null);
  const target = useRef<TiltState>({ rotateX: 0, rotateY: 0, scale: 1 });
  const current = useRef<TiltState>({ rotateX: 0, rotateY: 0, scale: 1 });
  const rafId = useRef<number | null>(null);
  const [state, setState] = useState<TiltState>({ rotateX: 0, rotateY: 0, scale: 1 });

  const tick = useCallback(() => {
    const c = current.current;
    const t = target.current;
    c.rotateX += (t.rotateX - c.rotateX) * LERP;
    c.rotateY += (t.rotateY - c.rotateY) * LERP;
    c.scale += (t.scale - c.scale) * LERP;
    setState({ rotateX: c.rotateX, rotateY: c.rotateY, scale: c.scale });

    const settled =
      Math.abs(t.rotateX - c.rotateX) < EPSILON &&
      Math.abs(t.rotateY - c.rotateY) < EPSILON &&
      Math.abs(t.scale - c.scale) < SCALE_EPSILON;
    rafId.current = settled ? null : requestAnimationFrame(tick);
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafId.current == null) rafId.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      target.current = {
        rotateX: (0.5 - py) * maxTilt * 2,
        rotateY: (px - 0.5) * maxTilt * 2,
        scale: hoverScale,
      };
      ensureLoop();
    }
    function handleLeave() {
      target.current = { rotateX: 0, rotateY: 0, scale: 1 };
      ensureLoop();
    }

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [ensureLoop, maxTilt, hoverScale]);

  return { ref, rotateX: state.rotateX, rotateY: state.rotateY, scale: state.scale };
}
