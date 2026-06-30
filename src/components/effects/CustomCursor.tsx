"use client";

import { useEffect, useRef } from "react";

const hoverSelector = "a, button, summary, input, select, textarea, [data-cursor-hover='true'], [data-magnetic]";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const frame = useRef(0);

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!supportsFinePointer || prefersReducedMotion) return;

    const dot = dotRef.current;
    const ringEl = ringRef.current;
    if (!dot || !ringEl) return;

    document.body.classList.add("lux-cursor-active");

    const render = () => {
      ring.current.x += (pointer.current.x - ring.current.x) * 0.18;
      ring.current.y += (pointer.current.y - ring.current.y) * 0.18;
      dot.style.transform = `translate3d(${pointer.current.x - 4}px, ${pointer.current.y - 4}px, 0)`;
      ringEl.style.transform = `translate3d(${ring.current.x - 22}px, ${ring.current.y - 22}px, 0)`;
      frame.current = window.requestAnimationFrame(render);
    };

    const handleMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };

    const handleOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const hovering = Boolean(target?.closest(hoverSelector));
      ringEl.classList.toggle("is-hovering", hovering);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerover", handleOver, { passive: true });
    frame.current = window.requestAnimationFrame(render);

    return () => {
      document.body.classList.remove("lux-cursor-active");
      window.cancelAnimationFrame(frame.current);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerover", handleOver);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} aria-hidden="true" className="lux-cursor-dot" />
      <div ref={ringRef} aria-hidden="true" className="lux-cursor-ring" />
    </>
  );
}
