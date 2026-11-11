"use client";

import { usePathname } from "next/navigation";
import { useMediaQuery, useStoredValue, writeStored } from "lib/browserStore";

// İz yalnızca ince imleçli ve hareketi azaltmayan cihazlarda. Tercih
// localStorage'da; CursorTrailLoader aynı değeri okuyor.
export const TRAIL_KEY = "cursorTrail";
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export default function CursorTrailToggle() {
  const pathname = usePathname();
  const fine = useMediaQuery(FINE_POINTER, false);
  const reduced = useMediaQuery(REDUCED_MOTION, true);
  const supported = fine && !reduced;
  const enabled = useStoredValue(TRAIL_KEY) !== "off";

  // Lab'in alt sayfalarında (oyun/deney ekranları) toggle gizli — Lab
  // index sayfasında kalır. Aynı kural CursorTrailLoader içinde de geçerli.
  if (pathname && /^\/lab\/[^/]/.test(pathname)) return null;
  if (!supported) return null;

  const toggle = () => writeStored(TRAIL_KEY, enabled ? "off" : "on");

  return (
    <button
      type="button"
      onClick={toggle}
      // Basılı durumu aria-pressed söylüyor; etiket sabit kalmalı, yoksa
      // ekran okuyucu "İmleç izini aç, basılı değil" gibi çelişkili okuyor.
      aria-label="İmleç izi"
      title={enabled ? "İmleç izini kapat" : "İmleç izini aç"}
      aria-pressed={enabled}
      data-chrome
      className="w-9 h-9 shrink-0 rounded-full cursor-pointer flex items-center justify-center text-faint hover:text-fg hover:bg-line-soft transition-colors"
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
