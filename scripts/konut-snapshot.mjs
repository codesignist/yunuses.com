// /lab/konut sayfasinin yedek verisini yeniler: data/konut-evds.json
//
//   pnpm konut:snapshot
//
// Sayfa veriyi normalde TCMB EVDS'den canli cekiyor (12 saatte bir). Anahtar
// tanimli degilse ya da EVDS yanit vermezse bu dosyaya dusuyor; boylece
// anahtarsiz bir derleme de calisan bir sayfa uretiyor. Anahtar ortam
// degiskeninden ya da .env.local'dan okunuyor ve dosyaya yazilmiyor.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchMany, FREQUENCY } from "../lib/konut/evds.js";
import { MONTHLY, QUARTERLY } from "../lib/konut/series.js";
import { encodeSnapshot } from "../lib/konut/snapshot.js";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "data/konut-evds.json");

async function readKey() {
  if (process.env.EVDS_API_KEY) return process.env.EVDS_API_KEY.trim();
  try {
    const env = await readFile(resolve(ROOT, ".env.local"), "utf8");
    return env.match(/^EVDS_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const key = await readKey();
if (!key) {
  console.error("EVDS_API_KEY bulunamadi (.env.local ya da ortam degiskeni)");
  process.exit(1);
}

const [monthly, quarterly] = await Promise.all([
  fetchMany(MONTHLY, { key, start: "01-01-2010", frequency: FREQUENCY.month }),
  fetchMany(QUARTERLY, { key, start: "01-01-2010", frequency: FREQUENCY.quarter }),
]);

const snapshot = encodeSnapshot({ fetchedAt: new Date().toISOString(), monthly, quarterly });
const text = JSON.stringify(snapshot) + "\n";
await writeFile(OUT, text);

const empty = Object.entries({ ...monthly, ...quarterly }).filter(([, rows]) => !rows.length);
for (const code of MONTHLY) console.log(code.padEnd(26), String(monthly[code].length).padStart(4), monthly[code].at(-1)?.join(" "));
console.log(`${QUARTERLY.length} ceyreklik seri, ${empty.length} tanesi bos: ${empty.map(([c]) => c).join(", ") || "-"}`);
console.log(`wrote ${OUT} (${Math.round(text.length / 1024)} KB)`);
