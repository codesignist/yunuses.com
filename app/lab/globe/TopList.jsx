"use client";
import { useLayoutEffect, useRef } from "react";
import { countryName, formatPop } from "./data";
import { GLASS } from "./ui";

export default function TopList({ data, ranking, selected, onHover, onPick, onShowAll }) {
  const listRef = useRef(null);
  const prevTops = useRef(new Map());

  // Siralama degisince yer degistiren satirlar eski yerinden kayarak gelsin
  // (FLIP). Oynatma sirasinda sehirlerin birbirini gecisi buradan okunuyor.
  useLayoutEffect(() => {
    const ol = listRef.current;
    if (!ol) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map();
    const first = prevTops.current.size === 0;
    for (const li of ol.children) {
      const key = li.dataset.key;
      const top = li.offsetTop;
      next.set(key, top);
      if (still || first) continue;
      const was = prevTops.current.get(key);
      if (was === undefined) {
        li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
      } else if (was !== top) {
        li.animate(
          [{ transform: `translateY(${was - top}px)` }, { transform: "translateY(0)" }],
          { duration: 380, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
        );
      }
    }
    prevTops.current = next;
  }, [ranking]);

  const max = ranking.vals[ranking.top[0]] || 1;

  return (
    <div data-chrome className={`${GLASS} p-3`}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[12px] text-white/55">En kalabalık şehirler</h2>
        <button
          type="button"
          onClick={onShowAll}
          className="-mr-1 rounded px-1 text-[11px] text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          Tümünü gör
        </button>
      </div>
      <ol ref={listRef} className="mt-1.5">
        {ranking.top.map((i, r) => {
          const isSel = selected === i;
          return (
            // Kisa ekranda ilk 5: liste alttaki zaman cubuguna binmesin;
            // tamami "Tumunu gor"de.
            <li key={i} data-key={i} className="[@media(max-height:820px)]:nth-[n+6]:hidden">
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => onPick(i)}
                onPointerEnter={() => onHover(i)}
                onPointerLeave={() => onHover(-1)}
                // Fareyle tiklayinca odak dugmede kaliyor; odakla vurgu yalniz
                // klavyede, yoksa kart imlec gittikten sonra da asili kaliyordu.
                onFocus={(e) => {
                  if (e.currentTarget.matches(":focus-visible")) onHover(i);
                }}
                onBlur={() => onHover(-1)}
                className={`group relative flex w-full items-baseline gap-2.5 rounded px-1 pt-1.5 pb-2 text-left transition-colors ${
                  isSel ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-white/40">
                  {r + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {data.names[i]}
                  <span className="ml-1.5 text-[11px] text-white/40">
                    {countryName(data.countries[i])}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/70">
                  {formatPop(ranking.vals[i])}
                </span>
                {/* Cubuk birinciye gore orantili, sifirdan basliyor. */}
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0.5 left-[30px] right-1 h-px origin-left transition-[background-color,transform] duration-300 ${
                    isSel ? "bg-[#f39a3d]" : "bg-[#f39a3d]/45 group-hover:bg-[#f39a3d]"
                  }`}
                  style={{ transform: `scaleX(${ranking.vals[i] / max})` }}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
