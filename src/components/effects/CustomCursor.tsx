"use client";

import { useEffect, useRef } from "react";

const interactiveSelector = [
  "a[href]",
  "button:not(:disabled)",
  "summary",
  "[role='button']",
  "[data-cursor-hover='true']",
  ".btn",
].join(", ");

const quietSelector = [
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[data-cursor-quiet='true']",
  ".html5-qrcode-element",
].join(", ");

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canEnhanceCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canEnhanceCursor || prefersReducedMotion) return;

    const dot = dotRef.current;
    const halo = haloRef.current;
    if (!dot || !halo) return;

    const body = document.body;
    body.classList.add("lux-cursor-soft");

    const updateTargetState = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      const shouldQuiet = Boolean(element?.closest(quietSelector));
      const isInteractive = Boolean(element?.closest(interactiveSelector));

      body.classList.toggle("lux-cursor-quiet", shouldQuiet);
      halo.classList.toggle("is-hovering", !shouldQuiet && isInteractive);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;

      body.classList.add("lux-cursor-ready");
      body.classList.remove("lux-cursor-left");
      updateTargetState(event.target);

      dot.style.transform = `translate3d(${event.clientX - 2}px, ${event.clientY - 2}px, 0)`;
      halo.style.transform = `translate3d(${event.clientX - 13}px, ${event.clientY - 13}px, 0)`;
    };

    const handlePointerOver = (event: PointerEvent) => updateTargetState(event.target);
    const handlePointerDown = () => body.classList.add("lux-cursor-pressed");
    const handlePointerUp = () => body.classList.remove("lux-cursor-pressed");
    const handlePointerLeave = () => body.classList.add("lux-cursor-left");
    const handlePointerEnter = () => body.classList.remove("lux-cursor-left");

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerover", handlePointerOver, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave, { passive: true });
    document.documentElement.addEventListener("mouseenter", handlePointerEnter, { passive: true });

    return () => {
      body.classList.remove(
        "lux-cursor-soft",
        "lux-cursor-ready",
        "lux-cursor-quiet",
        "lux-cursor-pressed",
        "lux-cursor-left",
      );
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerover", handlePointerOver);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      document.documentElement.removeEventListener("mouseenter", handlePointerEnter);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} aria-hidden="true" className="lux-cursor-dot" />
      <div ref={haloRef} aria-hidden="true" className="lux-cursor-ring" />
    </>
  );
}
