"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS_SHORT, monthLabel } from "./format";

// Aylik zaman serisi grafigi. Kutuphane yok; SVG elle kuruluyor.
//
// series: [{ id, label, color, points: [[ay, deger]], dashedFrom?: ay }]
//   dashedFrom verilirse o aydan sonrasi kesikli cizilir (tahmin).
// bands:  [{ id, label, color, opacity, points: [[ay, alt, ust]] }]
// marker: { at: ay, label } dikey ince cizgi, ornegin "Tahmin"
// zero:   true ise 0 cizgisi taban olarak cizilir (yuzde grafikleri)

const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

function monthIndex(key) {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

function indexKey(i) {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

function niceStep(span, count) {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * pow;
}

export default function TimeChart({
  series,
  bands = [],
  marker,
  zero = false,
  height = 300,
  yFormat = (v) => v.toLocaleString("tr-TR"),
  valueFormat = yFormat,
  ariaLabel,
}) {
  const wrapRef = useRef(null);
  // Genislik olculene kadar grafik cizilmiyor, yalnizca yuksekligi ayriliyor.
  // Sabit bir baslangic genisligi sunucu ciktisinda kolondan tasiyor, sonra
  // gercek genislige ziplatiyordu.
  const [width, setWidth] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (w) => setWidth(Math.max(280, Math.round(w)));
    measure(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (!width) return null;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = zero ? 0 : Infinity;
    let y1 = zero ? 0 : -Infinity;
    const take = (key, ...vals) => {
      const i = monthIndex(key);
      if (i < x0) x0 = i;
      if (i > x1) x1 = i;
      for (const v of vals) {
        if (v < y0) y0 = v;
        if (v > y1) y1 = v;
      }
    };
    for (const s of series) for (const [k, v] of s.points) take(k, v);
    for (const b of bands) for (const [k, lo, hi] of b.points) take(k, lo, hi);
    if (!Number.isFinite(x0)) return null;

    const plotH = height - PAD.top - PAD.bottom;
    const plotW = width - PAD.left - PAD.right;
    const step = niceStep(y1 - y0 || 1, plotH < 220 ? 4 : 5);
    const yMin = Math.floor(y0 / step) * step;
    const yMax = Math.ceil(y1 / step) * step;
    const yTicks = [];
    for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(+v.toFixed(10));

    const sx = (i) => PAD.left + ((i - x0) / Math.max(1, x1 - x0)) * plotW;
    const sy = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

    // Yil etiketleri birbirine en az ~56px uzak dursun.
    const years = (x1 - x0) / 12;
    const perYear = plotW / Math.max(1, years);
    const yearStep = [1, 2, 3, 5, 10].find((s) => s * perYear >= 56) ?? 10;
    const xTicks = [];
    const firstYear = Math.ceil(x0 / 12);
    for (let y = firstYear; y * 12 <= x1; y++) {
      if (y % yearStep === 0) xTicks.push(y * 12);
    }
    // Kisa aralikta (2 yildan az) yil yerine ay etiketi.
    const monthTicks = years < 2;
    if (monthTicks) {
      xTicks.length = 0;
      const mStep = perYear / 12 >= 40 ? 1 : perYear / 12 >= 20 ? 3 : 6;
      for (let i = x0; i <= x1; i++) if (i % mStep === 0) xTicks.push(i);
    }

    return { x0, x1, sx, sy, yTicks, xTicks, monthTicks, plotW, plotH };
  }, [series, bands, width, height, zero]);

  // Her ayin degerleri, ipucu ve klavye icin.
  const lookup = useMemo(() => {
    const m = new Map();
    for (const s of series) m.set(s.id, new Map(s.points));
    for (const b of bands) m.set(b.id, new Map(b.points.map(([k, lo, hi]) => [k, [lo, hi]])));
    return m;
  }, [series, bands]);

  if (!geo) return <div ref={wrapRef} style={{ height }} aria-hidden />;
  const { x0, x1, sx, sy, yTicks, xTicks, monthTicks } = geo;

  const pathFor = (pts) =>
    pts
      .map(([k, v], i) => `${i ? "L" : "M"}${sx(monthIndex(k)).toFixed(1)},${sy(v).toFixed(1)}`)
      .join("");

  const bandPath = (pts) => {
    const top = pts.map(([k, , hi]) => `${sx(monthIndex(k)).toFixed(1)},${sy(hi).toFixed(1)}`);
    const bottom = pts
      .slice()
      .reverse()
      .map(([k, lo]) => `${sx(monthIndex(k)).toFixed(1)},${sy(lo).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };

  const onPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const t = (px - PAD.left) / Math.max(1, geo.plotW);
    const i = Math.round(x0 + Math.min(1, Math.max(0, t)) * (x1 - x0));
    setActive(i);
  };

  const onKey = (e) => {
    const cur = active ?? x1;
    const step = e.shiftKey ? 12 : 1;
    if (e.key === "ArrowLeft") setActive(Math.max(x0, cur - step));
    else if (e.key === "ArrowRight") setActive(Math.min(x1, cur + step));
    else if (e.key === "Home") setActive(x0);
    else if (e.key === "End") setActive(x1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const activeKey = active !== null ? indexKey(active) : null;
  const tipRows = activeKey
    ? [
        ...series
          .map((s) => {
            const v = lookup.get(s.id)?.get(activeKey);
            return v === undefined ? null : { id: s.id, label: s.label, color: s.color, value: valueFormat(v) };
          })
          .filter(Boolean),
        ...bands
          .map((b) => {
            const r = lookup.get(b.id)?.get(activeKey);
            return r ? { id: b.id, label: b.label, color: b.color, value: `${valueFormat(r[0])} – ${valueFormat(r[1])}`, band: true } : null;
          })
          .filter(Boolean),
      ]
    : [];
  const tipX = active !== null ? sx(active) : 0;
  const tipLeft = tipX > width * 0.6;

  return (
    <div ref={wrapRef} className="relative select-none">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg rounded"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={sy(v)}
              y2={sy(v)}
              stroke={zero && v === 0 ? "var(--color-faint)" : "var(--color-line)"}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={PAD.left - 8}
              y={sy(v)}
              dy="0.32em"
              textAnchor="end"
              className="fill-faint tabular-nums"
              fontSize={11}
            >
              {yFormat(v)}
            </text>
          </g>
        ))}

        {xTicks.map((i) => (
          <text
            key={i}
            x={sx(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-faint tabular-nums"
            fontSize={11}
          >
            {monthTicks ? `${MONTHS_SHORT[i % 12]} ${String(Math.floor(i / 12)).slice(2)}` : Math.floor(i / 12)}
          </text>
        ))}

        {marker && monthIndex(marker.at) >= x0 && monthIndex(marker.at) <= x1 && (
          <g>
            <line
              x1={sx(monthIndex(marker.at))}
              x2={sx(monthIndex(marker.at))}
              y1={PAD.top}
              y2={height - PAD.bottom}
              stroke="var(--color-faint)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={sx(monthIndex(marker.at)) + 6}
              y={PAD.top + 10}
              className="fill-faint"
              fontSize={11}
            >
              {marker.label}
            </text>
          </g>
        )}

        {bands.map((b) => (
          <path key={b.id} d={bandPath(b.points)} fill={b.color} fillOpacity={b.opacity ?? 0.12} />
        ))}

        {series.map((s) => {
          if (!s.dashedFrom) {
            return (
              <path
                key={s.id}
                d={pathFor(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          }
          const cut = monthIndex(s.dashedFrom);
          const solid = s.points.filter(([k]) => monthIndex(k) <= cut);
          const dashed = s.points.filter(([k]) => monthIndex(k) >= cut);
          return (
            <g key={s.id}>
              <path d={pathFor(solid)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <path d={pathFor(dashed)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Her serinin son noktasi */}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          if (!last || s.noEndDot) return null;
          return (
            <circle
              key={s.id}
              cx={sx(monthIndex(last[0]))}
              cy={sy(last[1])}
              r={4}
              fill={s.color}
              stroke="var(--color-bg)"
              strokeWidth={2}
            />
          );
        })}

        {active !== null && (
          <g pointerEvents="none">
            <line
              x1={tipX}
              x2={tipX}
              y1={PAD.top}
              y2={height - PAD.bottom}
              stroke="var(--color-muted)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            {series.map((s) => {
              const v = lookup.get(s.id)?.get(activeKey);
              if (v === undefined) return null;
              return (
                <circle key={s.id} cx={tipX} cy={sy(v)} r={4} fill={s.color} stroke="var(--color-bg)" strokeWidth={2} />
              );
            })}
          </g>
        )}
      </svg>

      {active !== null && tipRows.length > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-md border border-line bg-bg/95 px-3 py-2 text-meta shadow-lg backdrop-blur-sm"
          style={tipLeft ? { right: width - tipX + 12 } : { left: tipX + 12 }}
        >
          <div className="mb-1 text-label text-faint">{monthLabel(activeKey)}</div>
          {tipRows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 whitespace-nowrap">
              <span
                aria-hidden
                className="inline-block w-3 shrink-0 rounded-full"
                style={{ height: r.band ? 6 : 2, background: r.color, opacity: r.band ? 0.45 : 1 }}
              />
              <span className="font-medium text-fg tabular-nums">{r.value}</span>
              <span className="text-faint">{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
