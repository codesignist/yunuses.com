"use client";

import { useState } from "react";

export function Segmented({ label, value, options, onChange, size = "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-md transition ${size === "sm" ? "px-2.5 py-1 text-meta" : "px-3 py-1.5 text-ui"} ${
              on ? "bg-surface text-fg shadow-sm" : "text-faint hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-xl border border-line px-4 py-3.5">
      <div className="text-meta text-faint">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</div>
      {sub && <div className="mt-1 text-meta text-muted">{sub}</div>}
    </div>
  );
}

// Lejant anahtari isaretin kendisini taklit ediyor: cizgi icin kisa cizgi,
// bant icin dolgu, kesikli tahmin icin kesikli cizgi.
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-muted">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-2">
          <svg width="18" height="10" aria-hidden className="shrink-0">
            {it.kind === "band" ? (
              <rect x="0" y="1" width="18" height="8" rx="2" fill={it.color} fillOpacity={it.opacity ?? 0.2} />
            ) : (
              <line
                x1="1"
                x2="17"
                y1="5"
                y2="5"
                stroke={it.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={it.kind === "dashed" ? "4 3" : undefined}
              />
            )}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// Binlik ayiracli TL girisi. Yazarken bicim bozulmasin diye metin olarak
// tutuluyor, odaktan cikinca yeniden bicimleniyor.
const fmt = (v, d) =>
  Number.isFinite(v) ? new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d }).format(v) : "";
const parse = (s) => {
  const clean = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(clean);
  return clean === "" || !Number.isFinite(n) ? null : n;
};

export function NumberField({ id, label, value, onChange, suffix, decimals = 0, min, max, hint }) {
  // Odaktayken yazilan metin, degilse degerin bicimlenmis hali gorunur.
  const [text, setText] = useState(null);
  const shown = text ?? fmt(value, decimals);

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="text-meta text-muted">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-line bg-bg focus-within:border-faint">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          onFocus={() => setText(fmt(value, decimals))}
          onBlur={() => setText(null)}
          onChange={(e) => {
            setText(e.target.value);
            let n = parse(e.target.value);
            if (n === null) return;
            if (min !== undefined) n = Math.max(min, n);
            if (max !== undefined) n = Math.min(max, n);
            onChange(n);
          }}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-ui text-fg tabular-nums outline-none"
        />
        {suffix && <span className="pr-3 text-meta text-faint">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-label text-faint">{hint}</span>}
    </label>
  );
}

export function Section({ id, eyebrow, title, intro, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-20 max-md:mt-16">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 id={`${id}-title`} className="mt-2 text-xl font-medium tracking-tight text-fg">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-reading text-body text-muted">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
