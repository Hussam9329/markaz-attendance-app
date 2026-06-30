"use client";

import CustomCursor from "./CustomCursor";
import MagneticInteractions from "./MagneticInteractions";
import SmoothScroll from "./SmoothScroll";

export default function VisualEffects() {
  return (
    <>
      <SmoothScroll />
      <MagneticInteractions />
      <CustomCursor />
    </>
  );
}
