"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function CursorTrailToggle() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sup = fineHover.matches && !reducedMotion.matches;
    setSupported(sup);
    let initial = true;
    try {
      const stored = localStorage.getItem("cursorTrail");
      if (stored === "off") initial = false;
    } catch {}
    setEnabled(initial);
  }, []);

  // Lab'in alt sayfalarında (oyun/deney ekranları) toggle gizli — Lab
  // index sayfasında kalır. Aynı kural CursorTrailLoader içinde de geçerli.
  if (pathname && /^\/lab\/[^/]/.test(pathname)) return null;
  if (!supported) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem("cursorTrail", next ? "on" : "off");
    } catch {}
    window.dispatchEvent(
      new CustomEvent("cursortrailchange", { detail: next ? "on" : "off" }),
    );
  };

  if (enabled === null) {
    return (
      <button
        type="button"
        aria-label="İmleç izi"
        className="fixed top-5 right-[108px] z-40 w-9 h-9 rounded-full cursor-pointer"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "İmleç izini kapat" : "İmleç izini aç"}
      title={enabled ? "İmleç izini kapat" : "İmleç izini aç"}
      aria-pressed={enabled}
      className="fixed top-5 right-[108px] z-40 w-9 h-9 rounded-full cursor-pointer flex items-center justify-center text-faint hover:text-fg hover:bg-line-soft transition-colors"
    >
      {enabled ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.8 11 Q 4.4 6.4, 7.6 8 T 11.6 5" />
          <circle cx="11.6" cy="5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.8 11 Q 4.4 6.4, 7.6 8 T 11.6 5" opacity="0.55" />
          <circle
            cx="11.6"
            cy="5"
            r="1.2"
            fill="currentColor"
            stroke="none"
            opacity="0.55"
          />
          <path d="M2 2 L 12 12" />
        </svg>
      )}
    </button>
  );
}
