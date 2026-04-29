"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CursorTrail = dynamic(() => import("./CursorTrail"), { ssr: false });

export default function CursorTrailLoader() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setEnabled(fineHover.matches && !reducedMotion.matches);
  }, []);

  if (!enabled) return null;
  return <CursorTrail />;
}
