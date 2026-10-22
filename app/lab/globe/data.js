// public/lab/globe/data.json'u okur (scripts/build-globe-data.mjs uretir)
// ve arayuzun ihtiyac duydugu bicime cevirir.

export const DATA_URL = "/lab/globe/data.json";
export const FIRST_YEAR = 1975;
export const LAST_YEAR = 2050;
// BM'nin son tahmin yili; sonrasi projeksiyon.
export const ESTIMATE_YEAR = 2025;
// Binlik birimde. Veri dosyasina bu esigi bir yilda gecen sehirler giriyor;
// bu yuzden siralama da ancak bu esigin ustunde kesin.
export const RANK_FLOOR = 300;

const D2R = Math.PI / 180;

export async function loadGlobeData(signal) {
  const res = await fetch(DATA_URL, { signal });
  if (!res.ok) throw new Error(`${DATA_URL}: ${res.status}`);
  const raw = await res.json();

  const count = raw.cities.length;
  const stride = raw.years.length;
  const names = new Array(count);
  const countries = new Array(count);
  const capital = new Uint8Array(count);
  const lat = new Float32Array(count);
  const lon = new Float32Array(count);
  const pops = new Float32Array(count * stride);
  let maxPop = 0;

  raw.cities.forEach(([name, country, la, lo, cap, series], i) => {
    names[i] = name;
    countries[i] = country;
    capital[i] = cap;
    lat[i] = la * D2R;
    lon[i] = lo * D2R;
    for (let s = 0; s < stride; s++) {
      const v = series[s];
      pops[i * stride + s] = v;
      if (v > maxPop) maxPop = v;
    }
  });

  return {
    years: raw.years,
    stride,
    count,
    names,
    countries,
    capital,
    lat,
    lon,
    pops,
    maxPop,
    totals: raw.totals,
    cityCounts: raw.cityCounts,
    land: decodeLand(raw.land),
  };
}

// Kara noktalari enlem satirlari halinde, her satirdaki noktalarin kara
// olup olmadigi bit maskesinde. Satir basina nokta sayisi dosyada yazili;
// istemci cos() ile yeniden hesaplasaydi motorlar arasindaki son basamak
// farki tum maskeyi kaydirabilirdi.
function decodeLand({ latMin, step, counts, mask }) {
  const bin = atob(mask);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let total = 0;
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    while (b) {
      total += b & 1;
      b >>= 1;
    }
  }
  const out = new Float32Array(total * 2);
  let bit = 0;
  let k = 0;
  counts.forEach((n, row) => {
    const la = (latMin + (row + 0.5) * step) * D2R;
    for (let j = 0; j < n; j++, bit++) {
      if (bytes[bit >> 3] & (1 << (bit & 7))) {
        out[k++] = la;
        out[k++] = (-180 + ((j + 0.5) * 360) / n) * D2R;
      }
    }
  });
  return out;
}

// Veri bes yilda bir; aradaki yillar dogrusal. Bir uc eksikse (sehir o yil
// BM tanimina gore henuz sehir sayilmiyor) bir sonraki ornege kadar eksik
// kabul ediliyor, sifirdan uydurma bir buyume cizilmiyor.
function sampleAt(values, offset, stride, year) {
  const f = Math.min(stride - 1, Math.max(0, (year - FIRST_YEAR) / 5));
  const a = Math.floor(f);
  const b = Math.min(stride - 1, a + 1);
  const t = f - a;
  const va = values[offset + a];
  if (t === 0 || a === b) return va;
  const vb = values[offset + b];
  if (va <= 0 || vb <= 0) return va;
  return va + (vb - va) * t;
}

export function popAt(data, i, year) {
  return sampleAt(data.pops, i * data.stride, data.stride, year);
}

export function totalAt(data, year) {
  return sampleAt(data.totals, 0, data.stride, year);
}

export function cityCountAt(data, year) {
  return Math.round(sampleAt(data.cityCounts, 0, data.stride, year));
}

const oneDecimal = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

// Girdi binlik birimde.
export function formatPop(k) {
  if (k >= 999.5) return `${oneDecimal.format(k / 1000)} milyon`;
  return `${integer.format(k)} bin`;
}

export function formatBillions(k) {
  return `${twoDecimals.format(k / 1e6)} milyar`;
}

export function formatCount(n) {
  return integer.format(n);
}

// Intl'in Turkce adlarindan bazilari etikete sigmayacak kadar uzun ya da
// resmi yazimda ("Çin Hong Kong ÖİB", "Kongo - Kinşasa").
const COUNTRY_OVERRIDES = {
  US: "ABD",
  HK: "Hong Kong",
  MO: "Makao",
  PS: "Filistin",
  CI: "Fildişi Sahili",
  MM: "Myanmar",
  CD: "Kongo DC",
  CG: "Kongo",
  KP: "Kuzey Kore",
  XK: "Kosova",
};

let regionNames = null;
const countryCache = new Map();

export function countryName(code) {
  if (COUNTRY_OVERRIDES[code]) return COUNTRY_OVERRIDES[code];
  if (countryCache.has(code)) return countryCache.get(code);
  let name = code;
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      regionNames ??= new Intl.DisplayNames(["tr"], { type: "region" });
      name = regionNames.of(code) ?? code;
    } catch {
      name = code;
    }
  }
  countryCache.set(code, name);
  return name;
}

// "1975'ten", "1990'dan", "2040'tan": ek sayinin okunusundaki son kelimeye
// gore secilir.
const ONES = ["", "den", "den", "ten", "ten", "ten", "dan", "den", "den", "dan"];
const TENS = ["", "dan", "den", "dan", "tan", "den", "tan", "ten", "den", "dan"];

export function yearFrom(year) {
  let suffix;
  if (year % 10) suffix = ONES[year % 10];
  else if (year % 100) suffix = TENS[(year % 100) / 10];
  else suffix = "den";
  return `${year}'${suffix}`;
}

// Sehrin verisi olan ilk yildan secili yila buyume cumlesi.
export function growthSentence(data, i, year) {
  const off = i * data.stride;
  let first = -1;
  for (let s = 0; s < data.stride; s++) {
    if (data.pops[off + s] > 0) {
      first = s;
      break;
    }
  }
  if (first < 0) return null;
  const baseYear = data.years[first];
  if (year <= baseYear) return null;
  const now = popAt(data, i, year);
  if (now <= 0) return null;
  const ratio = now / data.pops[off + first];
  const since = `${yearFrom(baseYear)} bu yana`;
  if (ratio >= 2) return `${since} ${oneDecimal.format(ratio)} kat büyüdü`;
  if (ratio >= 1.05) return `${since} %${integer.format((ratio - 1) * 100)} büyüdü`;
  if (ratio > 0.95) return `${since} neredeyse aynı kaldı`;
  return `${since} %${integer.format((1 - ratio) * 100)} küçüldü`;
}
