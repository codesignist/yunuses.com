// Yedek veri dosyasinin sikistirilmis bicimi. Her seri [ilk ay, adim (ay),
// degerler] olarak tutuluyor; aradaki eksik donemler null. [ay, deger]
// ciftleriyle 164 il serisi dosyayi iki katina cikariyordu.

import { addMonths, monthDiff } from "./stats.js";

export function encodeSeries(rows, step) {
  if (!rows.length) return [null, step, []];
  const first = rows[0][0];
  const values = [];
  for (const [k, v] of rows) values[monthDiff(first, k) / step] = v;
  return [first, step, Array.from(values, (v) => v ?? null)];
}

export function decodeSeries([first, step, values]) {
  if (!first) return [];
  const out = [];
  values.forEach((v, i) => {
    if (v != null) out.push([addMonths(first, i * step), v]);
  });
  return out;
}

export function encodeSnapshot({ monthly, quarterly, fetchedAt }) {
  const enc = (obj, step) => Object.fromEntries(Object.entries(obj).map(([k, rows]) => [k, encodeSeries(rows, step)]));
  return { fetchedAt, monthly: enc(monthly, 1), quarterly: enc(quarterly, 3) };
}

export function decodeSnapshot(s) {
  const dec = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decodeSeries(v)]));
  return { fetchedAt: s.fetchedAt, monthly: dec(s.monthly), quarterly: dec(s.quarterly) };
}
