"use client";

import { useEffect } from "react";

const selector = "a, button, summary, [data-magnetic]";

export default function MagneticInteractions() {
  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!supportsFinePointer || prefersReducedMotion) return;

    document.body.classList.add("lux-magnetic-ready");
    let frame = 0;

    const getTargets = () =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.closest("[data-no-magnetic='true']") && element.offsetParent !== null
      );

    const resetElement = (element: HTMLElement) => {
      element.style.translate = "0px 0px";
      element.removeAttribute("data-magnetic-active");
    };

    const handlePointerMove = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const pointerX = event.clientX;
        const pointerY = event.clientY;

        getTargets().forEach((element) => {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = pointerX - centerX;
          const dy = pointerY - centerY;
          const distance = Math.hypot(dx, dy);
          const radius = Math.max(rect.width, rect.height) / 2 + 86;

          if (distance < radius) {
            const intensity = 1 - distance / radius;
            element.style.translate = `${(dx * 0.15 * intensity).toFixed(2)}px ${(dy * 0.15 * intensity).toFixed(2)}px`;
            element.setAttribute("data-magnetic-active", "true");
          } else if (element.dataset.magneticActive) {
            resetElement(element);
          }
        });
      });
    };

    const resetAll = () => {
      window.cancelAnimationFrame(frame);
      getTargets().forEach(resetElement);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", resetAll, { passive: true });
    window.addEventListener("blur", resetAll);

    return () => {
      document.body.classList.remove("lux-magnetic-ready");
      resetAll();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", resetAll);
      window.removeEventListener("blur", resetAll);
    };
  }, []);

  return null;
}
