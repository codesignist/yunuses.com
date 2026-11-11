// Konut fiyati tahmini.
//
// Model iki parcali:
//  1. Reel (enflasyondan arindirilmis) aylik fiyat degisimi kendi son uc
//     ayina bagli bir AR(3) ile ilerletiliyor. Boylece son donemin egilimi
//     surer ama zamanla uzun donem ortalamasina doner.
//  2. Nominal fiyat, bunun ustune piyasa katilimcilarinin 12 ay sonrasi
//     enflasyon beklentisinin eklenmesiyle bulunuyor.
//
// Neden bu model: 2016'dan bu yana her ay icin "o gun bilinenle" tahmin
// yapilip sonradan gerceklesenle karsilastirildi. Son 12 ayin hizini
// surduren basit yaklasim, enflasyonun dustugu 2023 sonrasinda fiyat
// artisini cok fazla tahmin ediyordu; reel modeller bu donemde hatayi
// ucte birine indirdi. Uc gecikme bir ve ikiden biraz daha iyi cikti, daha
// fazlasi bir sey katmadi.
//
// Belirsizlik: reel taraf icin modelin kendi hatalari yeniden ornekleniyor
// (bootstrap), enflasyon icin beklentinin gecmisteki sapmalari kullaniliyor.
// Sonuc her ay icin bir dagilim.

import { addMonths, mean, ols, dot, quantile, rng } from "./stats.js";

export const QUANTILES = [0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.975];
const LAGS = 3;
// Uzun donem yillik reel artis. "pre2020": 2010-2019 ortalamasi. 2020-2023
// patlamasini da iceren tum donem ortalamasi (yillik %4 civari) reel
// fiyatlarin uzun vadede her yil bu kadar artacagini varsaymak olurdu;
// gecmise donuk sinamada ikisi arasinda isabet farki cikmadi, temkinli olan
// secildi. Sayi verilirse o kullanilir, null ise veriden tahmin edilir.
export const REAL_MEAN = "pre2020";
// Enflasyon surprizinin olculdugu pencere (ay). Son uc yil: bugunku para
// politikasi rejimini yansitiyor. Uzun pencere 2021-2023 surprizlerini
// iceriyor ve 2023 sonrasinda bantlari gereginden genis yapiyordu.
export const SURPRISE_WINDOW = 36;
// Beklentinin son donemdeki ortalama yanilgisini beklentiye geri ekle.
export const BIAS_CORRECT = false;
// Son 12 ayin ortalama reel degisimini de ozellik olarak kullan.
export const MOMENTUM = false;

function preBoomMean(r, months, origin) {
  const end = Math.min(origin, months.indexOf("2019-12") === -1 ? origin : months.indexOf("2019-12"));
  const xs = [];
  for (let i = 1; i <= end; i++) if (r[i] != null) xs.push(r[i]);
  return xs.length >= 24 ? mean(xs) * 12 : null;
}

// [[ay, deger]] dizilerini ortak bir ay eksenine oturtur.
export function align(months, pairs) {
  const m = new Map(pairs);
  return months.map((k) => m.get(k) ?? null);
}

function growth(logs) {
  return logs.map((v, i) => (i && v != null && logs[i - 1] != null ? v - logs[i - 1] : null));
}

// Normal dagilimdan ornek (Box-Muller).
function gauss(rand) {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Enflasyon beklentisinin 12 aylik sapmalarinin standart sapmasi.
 * sapma = log(TUFE_t / TUFE_{t-12}) - log(1 + beklenti_{t-12})
 * window: son kac gozlem (ay). Uzun pencere 2021-2023 surprizlerini de iceriyor.
 */
export function inflationSurprise(months, cpi, exp12, upto, window = 60) {
  const out = [];
  for (let i = Math.max(12, upto - window + 1); i <= upto; i++) {
    if (cpi[i] == null || cpi[i - 12] == null || exp12[i - 12] == null) continue;
    out.push(Math.log(cpi[i] / cpi[i - 12]) - Math.log(1 + exp12[i - 12] / 100));
  }
  if (out.length < 12) return { mean: 0, sigma: 0.06, count: out.length };
  const m = mean(out);
  return { mean: m, sigma: Math.sqrt(out.reduce((s, x) => s + (x - m) ** 2, 0) / (out.length - 1)), count: out.length };
}

export function inflationSurpriseSigma(months, cpi, exp12, upto, window = 60) {
  return inflationSurprise(months, cpi, exp12, upto, window).sigma;
}

/**
 * @param {object} a
 * @param {string[]} a.months      ortak ay ekseni (fiyatin son ayina kadar)
 * @param {Array<number|null>} a.price   fiyat endeksi
 * @param {Array<number|null>} a.cpi     TUFE (fiyattan bir iki ay ileri gidebilir: cpiAhead)
 * @param {Array<number|null>} a.exp12   12 ay sonrasi yillik enflasyon beklentisi (%)
 * @param {number[]} [a.cpiAhead]        fiyatin son ayindan sonra aciklanmis TUFE degerleri
 * @param {number} a.origin              tahminin baslangic indeksi (dahil)
 */
export function forecast({
  months,
  price,
  cpi,
  exp12,
  cpiAhead = [],
  expNow,
  origin,
  horizon = 24,
  sims = 2000,
  seed = 7,
  realMean = REAL_MEAN,
  surpriseWindow = SURPRISE_WINDOW,
  biasCorrect = BIAS_CORRECT,
  momentum = MOMENTUM,
  point = false,
}) {
  // point: soksuz tek yol. Gecmise donuk sinamada yalnizca orta tahmin
  // gerekiyor; binlerce senaryo yerine tek hesap.
  if (point) sims = 1;
  const lp = price.map((v) => (v == null ? null : Math.log(v)));
  const lc = cpi.map((v) => (v == null ? null : Math.log(v)));
  const n = growth(lp);
  const pi = growth(lc);
  const r = n.map((v, i) => (v == null || pi[i] == null ? null : v - pi[i]));

  // Tahmin denklemi: r_t - mu = b1 (r_{t-1} - mu) + b2 (r_{t-2} - mu) + b3 (r_{t-3} - mu)
  // mu verilmezse sabit terimle birlikte veriden tahmin ediliyor.
  const annualMean = realMean === "pre2020" ? preBoomMean(r, months, origin) : realMean;
  const mu = annualMean == null ? null : annualMean / 12;
  // Ozellikler: son uc ayin reel degisimi, istenirse son 12 ayin ortalamasi.
  const span = momentum ? 12 : LAGS;
  const feats = (series, t) => {
    const out = [];
    for (let l = 1; l <= LAGS; l++) out.push(series[t - l]);
    if (momentum) {
      let s = 0;
      for (let l = 1; l <= 12; l++) s += series[t - l];
      out.push(s / 12);
    }
    return out;
  };
  const X = [];
  const y = [];
  for (let t = span + 1; t <= origin; t++) {
    const recent = r.slice(t - span, t);
    if (r[t] == null || recent.some((v) => v == null)) continue;
    const f = feats(r, t);
    if (mu == null) {
      X.push([1, ...f]);
      y.push(r[t]);
    } else {
      X.push(f.map((v) => v - mu));
      y.push(r[t] - mu);
    }
  }
  const fit = ols(X, y, 0);
  const { sigma } = fit;
  // Ortalama sabitlenince hatalarin ortalamasi sifir olmuyor (2020-2023
  // donemi arti yonde). Merkezlenmezse bootstrap o egilimi tahmine geri
  // ekliyordu.
  const residMean = mean(fit.resid);
  const resid = fit.resid.map((e) => e - residMean);
  // Ortalama sabitlenince regresyonda sabit terim yok; mu, denkleme
  // mu * (1 - toplam b) sabiti olarak geri ekleniyor.
  const beta = mu == null ? fit.beta : [mu * (1 - fit.beta.reduce((s, b) => s + b, 0)), ...fit.beta];

  // Beklenen aylik enflasyon. Son beklenti tum ufka yayiliyor; daha ilerisi
  // icin TCMB bir beklenti yayimlamiyor.
  let e = expNow ?? exp12[origin];
  for (let i = origin; e == null && i > 0; i--) e = exp12[i];
  const surprise = inflationSurprise(months, cpi, exp12, origin, surpriseWindow);
  const sigma12 = surprise.sigma;
  const bias = biasCorrect ? surprise.mean : 0;
  const ePi = (Math.log(1 + (e ?? 30) / 100) + bias) / 12;

  const rand = rng(seed);
  const H = horizon;
  const nominal = Array.from({ length: H }, () => new Float64Array(sims));
  const real = Array.from({ length: H }, () => new Float64Array(sims));
  const cpiPath = Array.from({ length: H }, () => new Float64Array(sims));

  const base = r.slice(origin - span + 1, origin + 1);
  for (let s = 0; s < sims; s++) {
    const hist = base.slice();
    let cumR = 0;
    let cumPi = 0;
    let drift = 0;
    for (let h = 1; h <= H; h++) {
      const x = [1, ...feats(hist, hist.length)];
      const shock = point ? 0 : resid[Math.floor(rand() * resid.length)];
      const rh = dot(x, beta) + shock;
      hist.push(rh);
      cumR += rh;

      // Aciklanmis TUFE varsa o ay kesin; yoksa beklenti + birikimli surpriz.
      if (h <= cpiAhead.length) {
        cumPi = Math.log(cpiAhead[h - 1] / cpi[origin]);
      } else {
        if (!point) drift += gauss(rand) * sigma12 * Math.sqrt(1 / 12);
        cumPi += ePi;
      }
      const piTotal = cumPi + (h <= cpiAhead.length ? 0 : drift);
      real[h - 1][s] = Math.exp(cumR);
      cpiPath[h - 1][s] = Math.exp(piTotal);
      nominal[h - 1][s] = Math.exp(cumR + piTotal);
    }
  }

  const summarize = (arr) =>
    arr.map((col) => {
      const sorted = Array.from(col).sort((a, b) => a - b);
      return QUANTILES.map((q) => quantile(sorted, q));
    });

  const nomQ = summarize(nominal);
  const realQ = summarize(real);
  const cpiQ = summarize(cpiPath);
  const mid = QUANTILES.indexOf(0.5);
  const start = months[origin];

  return {
    start,
    beta,
    sigma,
    sigma12,
    expectedInflation: e,
    inflationBias: bias,
    surpriseMean: surprise.mean,
    longRunReal: annualMean != null ? annualMean / 12 : beta[0] / (1 - beta.slice(1).reduce((s, b) => s + b, 0)),
    steps: nomQ.map((q, i) => ({
      h: i + 1,
      month: addMonths(start, i + 1),
      nominal: q,
      real: realQ[i],
      cpi: cpiQ[i][mid],
    })),
  };
}

/**
 * Gecmise donuk sinama: her baslangic ayinda o gun bilinenle tahmin yapip
 * h ay sonra gerceklesenle karsilastirir. point: true ise yalnizca orta
 * tahmin hesaplaniyor (hizli); bant isabeti (inside) o zaman anlamsiz.
 */
export function backtest({ months, price, cpi, exp12, from = "2015-12", horizons = [6, 12, 24], sims = 400, point = false, ...opts }) {
  const out = Object.fromEntries(horizons.map((h) => [h, { errors: [], inside80: 0, count: 0 }]));
  const first = months.indexOf(from);
  for (let o = first; o < months.length - Math.min(...horizons); o++) {
    const f = forecast({ months, price, cpi, exp12, origin: o, horizon: Math.max(...horizons), sims, seed: o, point, ...opts });
    for (const h of horizons) {
      if (o + h >= months.length || price[o + h] == null) continue;
      const actual = price[o + h] / price[o];
      const q = f.steps[h - 1].nominal;
      const med = q[QUANTILES.indexOf(0.5)];
      const lo = q[QUANTILES.indexOf(0.1)];
      const hi = q[QUANTILES.indexOf(0.9)];
      const rec = out[h];
      const inside = actual >= lo && actual <= hi;
      rec.errors.push({ month: months[o], error: Math.log(med / actual), inside });
      rec.count++;
      if (inside) rec.inside80++;
    }
  }
  return out;
}
