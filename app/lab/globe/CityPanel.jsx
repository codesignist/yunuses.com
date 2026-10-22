"use client";
import { useEffect, useRef, useState } from "react";
import {
  ESTIMATE_YEAR,
  FIRST_YEAR,
  LAST_YEAR,
  RANK_FLOOR,
  countryName,
  firstYearOf,
  formatPop,
  growthSentence,
  popAt,
} from "./data";
import { GLASS, SERIES } from "./ui";

const TICKS = [1975, 2000, 2025, 2050];

// Secili sehrin ayrintisi. Uzerine gelince cikan kucuk kartin aksine sabit
// duruyor; ikinci bir sehirle karsilastirma da burada.
export default function CityPanel({
  compact,
  data,
  i,
  year,
  rank,
  compare,
  compareRank,
  comparing,
  onClose,
  onStartCompare,
  onClearCompare,
}) {
  const [hoverYear, setHoverYear] = useState(null);
  const shownYear = hoverYear ?? year;
  const pop = popAt(data, i, shownYear);
  const country = countryName(data.countries[i]);
  const growth = growthSentence(data, i, shownYear);
  const first = firstYearOf(data, i);
  const series = compare >= 0 ? [i, compare] : [i];

  return (
    <section
      aria-label={`${data.names[i]} ayrıntıları`}
      className={`${GLASS} bg-black/65 ${compact ? "p-3.5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-medium leading-tight tracking-tight text-white">
            {data.names[i]}
          </h2>
          <p className="mt-0.5 text-[12px] text-white/55">
            {data.capital[i] ? `${country}, başkent` : country}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="-mr-1.5 -mt-1 grid size-7 shrink-0 place-items-center rounded text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={`${compact ? "mt-2" : "mt-3"} flex items-baseline justify-between gap-3`}>
        <div className="text-[26px] font-light leading-none tracking-tight tabular-nums text-white">
          {pop > 0 ? formatPop(pop) : "Veri yok"}
        </div>
        <div className="text-[12px] tabular-nums text-white/55">
          {hoverYear ? hoverYear : pop >= RANK_FLOOR ? `Dünyada ${rank}.` : ""}
        </div>
      </div>
      <p className="mt-1.5 min-h-[1.4em] text-[12px] leading-snug text-white/60">
        {pop > 0 ? (growth ? `${growth}.` : "") : first ? `${first} öncesi için BM verisi yok.` : ""}
      </p>

      {/* Dar ekranda panel kurenin ustunu kapatiyor; grafik kisa. */}
      <Chart
        data={data}
        series={series}
        year={year}
        height={compact ? 64 : 92}
        hoverYear={hoverYear}
        onHoverYear={setHoverYear}
      />

      {compare >= 0 ? (
        <ul className="mt-2 space-y-1">
          {series.map((c, k) => {
            const v = popAt(data, c, shownYear);
            return (
              <li key={c} className="flex items-center gap-2 text-[12px]">
                <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: SERIES[k] }} />
                <span className="min-w-0 flex-1 truncate text-white/85">
                  {data.names[c]}
                  {k === 1 && !hoverYear && v >= RANK_FLOOR && (
                    <span className="ml-1.5 text-[11px] text-white/45">Dünyada {compareRank}.</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-white/70">{v > 0 ? formatPop(v) : "veri yok"}</span>
                {k === 1 ? (
                  <button
                    type="button"
                    onClick={onClearCompare}
                    aria-label={`${data.names[c]} karşılaştırmasını kaldır`}
                    className="grid size-5 shrink-0 place-items-center rounded text-white/45 transition hover:bg-white/10 hover:text-white"
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : (
                  <span className="size-5 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      ) : comparing ? (
        <p className="mt-2 text-[12px] leading-snug text-white/60">
          Karşılaştırmak için bir şehir ara ya da küreden seç.
        </p>
      ) : (
        <button
          type="button"
          onClick={onStartCompare}
          className="mt-2 -ml-1 rounded px-1 py-0.5 text-[12px] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Başka bir şehirle karşılaştır
        </button>
      )}

      <details className={`${compact ? "mt-2 pt-2" : "mt-3 pt-2.5"} border-t border-white/10`}>
        <summary className="cursor-pointer list-none text-[11px] text-white/45 transition hover:text-white/75 [&::-webkit-details-marker]:hidden">
          Şehir nasıl sayıldı?
        </summary>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
          BM burada şehri belediye sınırına göre değil, birbirine bitişik yoğun yerleşime göre
          sayıyor. Bu yüzden rakamlar resmi nüfustan farklı olabilir; bazı büyük şehirlerin
          çevresindeki yerleşimler ayrı şehir olarak görünebilir.
        </p>
      </details>
    </section>
  );
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// Ust deger yuvarlak bir sayi olsun (1, 2, 5 x 10^n), cizgi etiketiyle okunsun.
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// 1975-2050 egrileri. Taban sifirda; tahmin yilindan sonrasi kesikli, zaman
// cubugundaki ayrimla ayni dil. Uzerinde gezinince o yilin degerleri.
function Chart({ data, series, year, height, hoverYear, onHoverYear }) {
  const wrapRef = useRef(null);
  const W = useWidth(wrapRef);
  const H = height;
  const top = 14;
  const bottom = 16;
  const plotH = H - top - bottom;

  let max = 0;
  for (const c of series) {
    for (let s = 0; s < data.stride; s++) max = Math.max(max, data.pops[c * data.stride + s]);
  }
  const yMax = niceMax(Math.max(1, max));
  const x = (y) => ((y - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * W;
  const yy = (v) => top + plotH - (v / yMax) * plotH;

  // Veri olmayan yillarda cizgi kesiliyor; parcalar tahmin yilinda ikiye
  // ayriliyor (gecmis duz, gelecek kesikli).
  function paths(c) {
    const past = [];
    const future = [];
    let seg = null;
    let segF = null;
    data.years.forEach((y, s) => {
      const v = data.pops[c * data.stride + s];
      if (v <= 0) {
        seg = segF = null;
        return;
      }
      const pt = `${x(y).toFixed(1)},${yy(v).toFixed(1)}`;
      if (y <= ESTIMATE_YEAR) {
        if (!seg) past.push((seg = []));
        seg.push(pt);
      }
      if (y >= ESTIMATE_YEAR) {
        if (!segF) future.push((segF = []));
        segF.push(pt);
      }
    });
    return { past, future };
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - rect.left) / rect.width;
    onHoverYear(Math.round(FIRST_YEAR + Math.min(1, Math.max(0, f)) * (LAST_YEAR - FIRST_YEAR)));
  }

  const marks = hoverYear ?? year;
  const yMaxLabel = formatPop(yMax);

  return (
    <div ref={wrapRef} className="mt-3 select-none">
      {W > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none overflow-visible"
          role="img"
          aria-label="1975'ten 2050'ye nüfus eğrisi"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => onHoverYear(null)}
        >
          <line x1="0" x2={W} y1={top} y2={top} stroke="rgba(255,255,255,0.08)" />
          <text x="0" y={top - 4} fontSize="10" fill="rgba(255,255,255,0.4)">
            {yMaxLabel}
          </text>
          <line x1="0" x2={W} y1={top + plotH} y2={top + plotH} stroke="rgba(255,255,255,0.16)" />
          <line
            x1={x(marks)}
            x2={x(marks)}
            y1={top}
            y2={top + plotH}
            stroke={hoverYear ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)"}
          />
          {series.map((c, k) => {
            const { past, future } = paths(c);
            return (
              <g key={c}>
                {past.map((p, j) =>
                  p.length > 1 ? (
                    <polyline key={`p${j}`} points={p.join(" ")} fill="none" stroke={SERIES[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  ) : null,
                )}
                {future.map((p, j) =>
                  p.length > 1 ? (
                    <polyline key={`f${j}`} points={p.join(" ")} fill="none" stroke={SERIES[k]} strokeOpacity="0.8" strokeWidth="2" strokeDasharray="3 3" strokeLinejoin="round" />
                  ) : null,
                )}
              </g>
            );
          })}
          {series.map((c, k) => {
            const v = popAt(data, c, marks);
            return v > 0 ? (
              <circle key={c} cx={x(marks)} cy={yy(v)} r="4" fill={SERIES[k]} stroke="#07090d" strokeWidth="2" />
            ) : null;
          })}
          {TICKS.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - 2}
              fontSize="10"
              fill="rgba(255,255,255,0.4)"
              textAnchor={t === FIRST_YEAR ? "start" : t === LAST_YEAR ? "end" : "middle"}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
