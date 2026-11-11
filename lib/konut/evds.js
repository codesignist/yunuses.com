// TCMB EVDS resmi web servisi. Anahtar URL'ye degil `key` basligina yaziliyor;
// URL'de kalirsa proxy ve hata kayitlarina sizar. Parametreler sorgu dizesi
// degil yolun kendisi: ".../igmevdsms-dis/series=A-B&startDate=...".
//
// Bu dosya sadece sunucuda calisiyor (sayfa ve snapshot betigi). Istemci
// tarafina hicbir zaman anahtar inmiyor.

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis/";

// EVDS frekans kodlari. Sayfada yalnizca aylik ve ceyreklik kullaniliyor.
export const FREQUENCY = { month: 5, quarter: 6 };

function evdsDate(d) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

// "2026-9" ve "2026-Q3" gibi EVDS tarihlerini ay anahtarina cevirir.
// Ceyreklik veride anahtar ceyregin son ayi oluyor (Q3 -> 2026-09).
export function periodKey(raw) {
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-Q([1-4])$/i);
  if (m) return `${m[1]}-${String(Number(m[2]) * 3).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  return null;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Birden fazla seriyi tek istekte ceker.
 * @param {string[]} codes  "TP.KFE.TR" bicimindeki seri kodlari
 * @returns {Promise<Record<string, Array<[string, number]>>>} koda gore [ay, deger] dizileri
 */
export async function fetchSeries(
  codes,
  { key, start = "01-01-2010", end, frequency = FREQUENCY.month, revalidate } = {},
) {
  if (!key) throw new Error("EVDS_API_KEY tanimli degil");
  const endDate = end ?? evdsDate(new Date());
  const params = [
    `series=${codes.join("-")}`,
    `startDate=${start}`,
    `endDate=${endDate}`,
    "type=json",
    `frequency=${frequency}`,
    `aggregationTypes=${codes.map(() => "avg").join("-")}`,
    `formulas=${codes.map(() => "0").join("-")}`,
  ].join("&");

  const init = { headers: { key, accept: "application/json" } };
  if (revalidate) init.next = { revalidate };
  const res = await fetch(BASE + params, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`EVDS ${res.status}: ${text.slice(0, 200)}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("EVDS JSON yerine HTML dondu (adres ya da anahtar hatali)");
  }

  const items = Array.isArray(json) ? json : (json.items ?? []);
  const out = Object.fromEntries(codes.map((c) => [c, []]));
  for (const item of items) {
    const period = periodKey(item.Tarih);
    if (!period) continue;
    for (const code of codes) {
      // Yanitta alan adi noktalar alt cizgiye donusmus olarak geliyor.
      const v = toNumber(item[code.replaceAll(".", "_")] ?? item[code]);
      if (v !== null) out[code].push([period, v]);
    }
  }
  return out;
}

// Cok sayida seri: URL'yi kisa tutmak icin 40'lik parcalar, paralel.
export async function fetchMany(codes, opts) {
  const parts = [];
  for (let i = 0; i < codes.length; i += 40) parts.push(codes.slice(i, i + 40));
  const results = await Promise.all(parts.map((p) => fetchSeries(p, opts)));
  return Object.assign({}, ...results);
}
