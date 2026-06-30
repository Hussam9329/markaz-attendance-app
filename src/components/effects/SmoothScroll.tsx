"use client";

import { useEffect } from "react";

export default function SmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !supportsFinePointer) return;

    let target = window.scrollY;
    let current = window.scrollY;
    let raf = 0;
    let isAnimating = false;

    const clampTarget = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      target = Math.max(0, Math.min(target, max));
    };

    const animate = () => {
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.35) {
        current = target;
        isAnimating = false;
        window.scrollTo(0, current);
        return;
      }
      window.scrollTo(0, current);
      raf = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (isAnimating) return;
      isAnimating = true;
      raf = window.requestAnimationFrame(animate);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      const targetElement = event.target as HTMLElement | null;
      if (targetElement?.closest("textarea, select, [data-native-scroll='true'], .table-wrap, .qr-box")) return;
      event.preventDefault();
      target += event.deltaY * 0.88;
      clampTarget();
      start();
    };

    const onResize = () => {
      target = window.scrollY;
      current = window.scrollY;
      clampTarget();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
