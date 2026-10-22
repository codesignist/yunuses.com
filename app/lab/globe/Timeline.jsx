"use client";
import {
  ESTIMATE_YEAR,
  FIRST_YEAR,
  LAST_YEAR,
  centroidSentence,
  cityCountAt,
  formatBillions,
  formatCount,
  totalAt,
} from "./data";
import { GLASS, SODIUM } from "./ui";

const THUMB = 14;

// Basparmagin merkezi araligin iki ucundan THUMB/2 iceride; cubuk ve
// etiketler ayni hesapla hizalaniyor.
const at = (p) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${p})`;

export default function Timeline({ data, year, playing, onYear, onTogglePlay }) {
  const span = LAST_YEAR - FIRST_YEAR;
  const p = (year - FIRST_YEAR) / span;
  const est = (ESTIMATE_YEAR - FIRST_YEAR) / span;
  const verb = year < ESTIMATE_YEAR ? "yaşıyordu" : year === ESTIMATE_YEAR ? "yaşıyor" : "yaşayacak";
  const dashed = (color) => `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`;
  const drift = centroidSentence(data, year);

  return (
    <div data-chrome className={`${GLASS} w-full p-3.5 pointer-events-auto md:w-[300px] md:p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[36px] font-light leading-none tracking-tight tabular-nums text-white md:text-[44px]">
          {year}
        </div>
        {year > ESTIMATE_YEAR && (
          <span className="rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-white/60">
            Projeksiyon
          </span>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-white/60">
        Dünyada {formatCount(cityCountAt(data, year))} şehirde {formatBillions(totalAt(data, year))}{" "}
        kişi {verb}.
      </p>
      {/* Kuredeki beyaz iz ve halka bu cumlenin gorseli; renk ipucu onlari baglıyor. */}
      <p className="mt-1 flex min-h-[2.8em] gap-2 text-[12px] leading-snug text-white/60">
        <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 rounded-full border border-[#dfe9ff]" />
        <span>{drift ?? "Halka, bütün şehirlilerin ağırlık merkezi. Yılları oynatınca nereye kaydığını izle."}</span>
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          {playing ? (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <rect x="0" y="0" width="3" height="12" rx="1" fill="currentColor" />
              <rect x="7" y="0" width="3" height="12" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <path d="M1 1.2v9.6a.7.7 0 0 0 1.06.6l7.6-4.8a.7.7 0 0 0 0-1.2L2.06.6A.7.7 0 0 0 1 1.2Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="relative h-6">
            <div className="absolute top-1/2 h-px bg-white/25" style={{ left: at(0), width: `calc((100% - ${THUMB}px) * ${est})` }} />
            <div
              className="absolute top-1/2 h-px"
              style={{ left: at(est), right: THUMB / 2, backgroundImage: dashed("rgba(255,255,255,0.3)") }}
            />
            <div
              className="absolute top-1/2 -mt-px h-[2px] rounded-full"
              style={{ left: at(0), width: `calc((100% - ${THUMB}px) * ${Math.min(p, est)})`, background: SODIUM }}
            />
            {p > est && (
              <div
                className="absolute top-1/2 -mt-px h-[2px]"
                style={{ left: at(est), width: `calc((100% - ${THUMB}px) * ${p - est})`, backgroundImage: dashed(SODIUM) }}
              />
            )}
            <input
              type="range"
              min={FIRST_YEAR}
              max={LAST_YEAR}
              step={1}
              value={year}
              onChange={(e) => onYear(Number(e.target.value))}
              aria-label="Yıl"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#ffe9c8] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(243,154,61,0.3)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ffe9c8] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(243,154,61,0.3)]"
            />
          </div>
          <div className="relative mt-0.5 h-3 text-[10px] tabular-nums text-white/40">
            <span className="absolute -translate-x-1/2" style={{ left: at(0) }}>
              {FIRST_YEAR}
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: at(est) }}>
              {ESTIMATE_YEAR}
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: at(1) }}>
              {LAST_YEAR}
            </span>
          </div>
        </div>
      </div>

      <a
        href="https://population.un.org/wup/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-[11px] text-white/40 transition hover:text-white/75"
      >
        Veri: BM, World Urbanization Prospects 2025
      </a>
    </div>
  );
}
