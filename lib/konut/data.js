// /lab/konut verisi: EVDS'den ham seriler, ustune tahmin, gecmise donuk
// sinama ve degerleme olculeri. Sadece sunucuda calisiyor.
//
// Sayfa Turkiye'yi ve ortak verileri tasiyor; bolgeler /lab/konut/veri/<id>/
// adresinden ayri JSON olarak iniyor. 19 bolgenin tahmini sayfaya gomulse
// ilk yukleme ~300 KB buyuyordu, oysa okur cogu zaman tek il bakiyor.

import snapshotFile from "data/konut-evds.json";
import { fetchMany, FREQUENCY } from "./evds.js";
import { align, backtest, forecast, QUANTILES } from "./model.js";
import { PROVINCES, REGIONS, TURKEY } from "./regions.js";
import { CPI, DEPOSIT, EXPECTATION, MONTHLY, MORTGAGE, QUARTERLY } from "./series.js";
import { decodeSnapshot } from "./snapshot.js";
import { addMonths } from "./stats.js";

export const REVALIDATE = 43200; // 12 saat

let decoded;
const snapshot = () => (decoded ??= decodeSnapshot(snapshotFile));

async function loadRaw() {
  const key = process.env.EVDS_API_KEY?.trim();
  if (key) {
    try {
      const opts = { key, start: "01-01-2010", revalidate: REVALIDATE };
      const [monthly, quarterly] = await Promise.all([
        fetchMany(MONTHLY, { ...opts, frequency: FREQUENCY.month }),
        fetchMany(QUARTERLY, { ...opts, frequency: FREQUENCY.quarter }),
      ]);
      // Aylik serilerden biri bos gelirse yedekle tamamla. Ceyreklik il
      // serilerinde bos donmek normal (TCMB bazi iller icin yayimlamiyor).
      for (const code of MONTHLY) if (!monthly[code]?.length) monthly[code] = snapshot().monthly[code] ?? [];
      return { monthly, quarterly, source: "live", fetchedAt: new Date().toISOString() };
    } catch (err) {
      // Calisirken yenileme basarisiz olursa hatayi firlat: Next son saglam
      // sayfayi sunmaya devam edip sonra tekrar dener. Yedege dusmek, canli
      // veriyle uretilmis sayfayi repodaki daha eski veriyle ezerdi. Derleme
      // sirasinda ise yedek kullanilir ki EVDS kesintisi dagitimi durdurmasin.
      if (process.env.NEXT_PHASE !== "phase-production-build") throw err;
      console.error("[konut] EVDS'ye ulasilamadi, yedek veri kullaniliyor:", err.message);
    }
  }
  return { ...snapshot(), source: "snapshot" };
}

const last = (rows) => rows[rows.length - 1];
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

// Yillik degisim dizisi: [ay, oran]
function yoy(rows) {
  const m = new Map(rows);
  return rows
    .map(([k, v]) => {
      const prev = m.get(addMonths(k, -12));
      return prev ? [k, v / prev - 1] : null;
    })
    .filter(Boolean);
}

// Tek ilden olusan bolgelerde (Istanbul, Ankara, Izmir) etiket ilin adi.
export function regionMeta(region) {
  if (region === TURKEY) return { id: "tr", code: "TR", label: "Türkiye", short: "Türkiye", provinces: [] };
  const single = region.provinces.length === 1;
  return {
    id: region.id,
    code: region.code,
    label: single ? region.provinces[0] : `${region.code} bölgesi`,
    short: single ? region.provinces[0] : region.code,
    provinces: region.provinces,
  };
}

function prepare(raw) {
  const months = raw.monthly[TURKEY.kfe].map(([k]) => k);
  const lastMonth = months[months.length - 1];
  const cpiRows = raw.monthly[CPI];
  const expRow = last(raw.monthly[EXPECTATION]);
  return {
    months,
    lastMonth,
    cpiRows,
    cpi: align(months, cpiRows),
    exp12: align(months, raw.monthly[EXPECTATION]),
    cpiAhead: cpiRows.filter(([k]) => k > lastMonth).map(([, v]) => v),
    expNow: expRow[1],
    expMonth: expRow[0],
  };
}

function buildRegion(region, raw, common) {
  const { months, cpi, exp12, cpiAhead, expNow } = common;
  const kfeRows = raw.monthly[region.kfe];
  const price = align(months, kfeRows);
  const cpiLast = cpi[months.length - 1];

  // Reel endeks, bugunun fiyatlariyla: son ayda nominal ile ayni.
  const real = kfeRows.map(([k, v]) => [k, round((v * cpiLast) / cpi[months.indexOf(k)], 3)]);

  const f = forecast({ months, price, cpi, exp12, cpiAhead, expNow, origin: months.length - 1 });
  const bt = backtest({ months, price, cpi, exp12, horizons: [12, 24], point: true });
  const periods = [
    { id: "calm", label: "2016-2020", from: "2015-12", to: "2020-12" },
    { id: "boom", label: "2021-2022", from: "2021-01", to: "2022-12" },
    { id: "now", label: "2023 ve sonrası", from: "2023-01", to: "2999-12" },
  ];
  const backtestSummary = [12, 24].map((h) => ({
    h,
    periods: periods.map((p) => {
      const e = bt[h].errors.filter((x) => x.month >= p.from && x.month <= p.to);
      const mae = e.length ? e.reduce((s, x) => s + Math.abs(Math.exp(x.error) - 1), 0) / e.length : null;
      return { ...p, mae: round(mae), count: e.length };
    }),
  }));

  const lastKfe = last(kfeRows);
  const realYoy = yoy(real);

  // Reel zirve ve patlama oncesi duzey
  let peak = real[0];
  for (const r of real) if (r[1] > peak[1]) peak = r;
  const pre = real.filter(([k]) => k >= "2019-01" && k <= "2019-12");
  const preAvg = pre.reduce((s, [, v]) => s + v, 0) / pre.length;

  // Reel dususun kac aydir surdugu (yillik reel degisim < 0)
  let fallingFor = 0;
  for (let i = realYoy.length - 1; i >= 0 && realYoy[i][1] < 0; i--) fallingFor++;

  const q = (arr, p) => arr[QUANTILES.indexOf(p)];

  return {
    ...regionMeta(region),
    last: { month: lastKfe[0], value: lastKfe[1] },
    mom: lastKfe[1] / kfeRows[kfeRows.length - 2][1] - 1,
    nominal: kfeRows,
    real,
    nomYoy: yoy(kfeRows).map(([k, v]) => [k, round(v)]),
    realYoy: realYoy.map(([k, v]) => [k, round(v)]),
    forecast: {
      start: f.start,
      steps: f.steps.map((s) => ({
        h: s.h,
        month: s.month,
        cpi: round(s.cpi, 5),
        nominal: s.nominal.map((v) => round(v, 5)),
        real: s.real.map((v) => round(v, 5)),
      })),
      longRunReal: round(f.longRunReal * 12),
      median12: q(f.steps[11].nominal, 0.5) - 1,
      low12: q(f.steps[11].nominal, 0.1) - 1,
      high12: q(f.steps[11].nominal, 0.9) - 1,
      real12: q(f.steps[11].real, 0.5) - 1,
    },
    backtest: backtestSummary,
    valuation: {
      peak: { month: peak[0], gap: lastKfe[1] / peak[1] - 1 },
      vsPreBoom: lastKfe[1] / preAvg - 1,
      fallingFor,
    },
  };
}

// Il bazinda m2 fiyati ve kirasi, ceyreklik [ay, deger] dizileri.
function unitRows(raw, item) {
  return { price: raw.quarterly[item.price] ?? [], rent: raw.quarterly[item.rent] ?? [] };
}

export async function getPageData() {
  const raw = await loadRaw();
  const common = prepare(raw);
  const cpiYoy = yoy(common.cpiRows);
  const expMap = new Map(raw.monthly[EXPECTATION]);
  // Beklenen enflasyona gore reel faiz (yillik)
  const realRate = (rows) =>
    rows.filter(([k]) => expMap.has(k)).map(([k, v]) => [k, round((1 + v / 100) / (1 + expMap.get(k) / 100) - 1)]);
  const mortgage = last(raw.monthly[MORTGAGE]);
  const deposit = last(raw.monthly[DEPOSIT]);
  const inflationNow = last(cpiYoy);

  return {
    source: raw.source,
    fetchedAt: raw.fetchedAt,
    lastMonth: common.lastMonth,
    turkey: { ...buildRegion(TURKEY, raw, common), unit: unitRows(raw, TURKEY) },
    regions: REGIONS.map(regionMeta),
    provinces: PROVINCES.map((p) => {
      const u = unitRows(raw, p);
      return { slug: p.slug, name: p.name, region: p.region, hasUnit: u.price.length > 0 && u.rent.length > 0 };
    }),
    cpiYoy: cpiYoy.filter(([k]) => k >= "2011-01").map(([k, v]) => [k, round(v)]),
    inflation: { month: inflationNow[0], value: inflationNow[1] },
    expectation: { month: common.expMonth, value: common.expNow / 100 },
    mortgage: { month: mortgage[0], value: mortgage[1] / 100 },
    deposit: { month: deposit[0], value: deposit[1] / 100 },
    realMortgage: realRate(raw.monthly[MORTGAGE]),
    quantiles: QUANTILES,
  };
}

export async function getRegionData(id) {
  const region = REGIONS.find((r) => r.id === id);
  if (!region) return null;
  const raw = await loadRaw();
  const common = prepare(raw);
  const units = Object.fromEntries(
    PROVINCES.filter((p) => p.region === id).map((p) => [p.slug, unitRows(raw, p)]),
  );
  return { ...buildRegion(region, raw, common), units };
}
