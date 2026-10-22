// /lab/globe deneyinin verisini uretir: public/lab/globe/data.json
//
//   node scripts/build-globe-data.mjs <sehirler.csv.gz> <kara.geojson>
//
// Sehirler: BM, World Urbanization Prospects 2025, "Cities Population
// Surface Data" (WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz,
// population.un.org/wup/downloads). Ham dosya ~60 MB, depoya girmiyor.
// Kara: Natural Earth ne_50m_land.geojson (kamu mali).
//
// BM verisi 1975-2050 arasi yillik ve oyle kaliyor. Her sehrin serisi bir
// onceki yila gore farklar halinde yaziliyor: dosya bes yilda bir ornegin
// gzip'te ~23 KB fazlasi, karsiliginda ara yillar tahmin degil gercek.

import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

const [csvPath, landPath] = process.argv.slice(2);
if (!csvPath || !landPath) {
  console.error("kullanim: node scripts/build-globe-data.mjs <sehirler.csv.gz> <kara.geojson>");
  process.exit(1);
}

const OUT = resolve(process.cwd(), "public/lab/globe/data.json");
const YEARS = [];
for (let y = 1975; y <= 2050; y++) YEARS.push(y);
const ANCHOR_YEAR = 2025;
// Binlik birimde; herhangi bir yilda bu esigi gecen sehir giriyor.
const MIN_POP = 300;

// Kara noktalari: enlem satirlari, her satirda cos(enlem) ile orantili
// sayida nokta. Kure uzerinde esit aralikli dagiliyor. Antarktika disarida:
// sehri yok, duz haritada da tum alt kenari kapliyordu.
const LAT_MIN = -58;
const LAT_MAX = 84;
const STEP = 0.7;

// Turkce okura tanidik gelen adlar. Anahtar BM'deki ham ad; ayni adin iki
// ulkede farkli karsiligi varsa "ISO2:Ad". Parantezli adlarda (yerel ad +
// Ingilizce) sozlukte yoksa parantez ici kullaniliyor.
const TR_NAMES = {
  "Tōkyō (Tokyo)": "Tokyo",
  "Al-Qahirah (Cairo)": "Kahire",
  "Krung Thep Maha Nakhon (Bangkok)": "Bangkok",
  "Ciudad de México (Mexico City)": "Meksiko",
  "Moskva (Moscow)": "Moskova",
  "Tehrān (Tehran)": "Tahran",
  "Al-Kharṭūm (Khartoum)": "Hartum",
  "Ar-Riyāḑ (Riyadh)": "Riyad",
  "Kābul (Kabul)": "Kabil",
  "Baghdād (Baghdad)": "Bağdat",
  "Muqdisho (Mogadishu)": "Mogadişu",
  "Dimashq (Damascus)": "Şam",
  "Şan'ā' (Sana'a)": "Sana",
  "Al Kuwayt (Kuwait City)": "Kuveyt",
  "Toshkent (Tashkent)": "Taşkent",
  "El Djazaïr (Algiers)": "Cezayir",
  "Coyah (Conacry)": "Konakri",
  "Athína (Athens)": "Atina",
  "Ciudad de Guatemala (Guatemala City)": "Guatemala",
  "Kyiv (Kiev)": "Kiev",
  "Roma (Rome)": "Roma",
  "Bakı (Baku)": "Bakü",
  "București (Bucharest)": "Bükreş",
  "Bayrūt (Beirut)": "Beyrut",
  "Wien (Vienna)": "Viyana",
  "Lisboa (Lisbon)": "Lizbon",
  "Warszawa (Warsaw)": "Varşova",
  "Ciudad de Panamá (Panama City)": "Panama",
  "Aşgabat (Ashgabat)": "Aşkabat",
  "La Habana (Havana)": "Havana",
  "Al-Quds (East Jerusalem)": "Doğu Kudüs",
  "Ţarābulus (Tripoli)": "Trablus",
  "Abū Ẓabī (Abu Dhabi)": "Abu Dabi",
  "Bruxelles (Brussels)": "Brüksel",
  "København (Copenhagen)": "Kopenhag",
  "Praha (Prague)": "Prag",
  "Beograd (Belgrade)": "Belgrad",
  "Masqąt (Muscat)": "Maskat",
  "Helsinki (Helsingfors)": "Helsinki",
  "Tiranë (Tirana)": "Tiran",
  "Aden ('Adan)": "Aden",
  "Lefkosia (Nicosia)": "Lefkoşa",
  "Viangchan (Vientiane)": "Vientiane",

  Istanbul: "İstanbul",
  Izmir: "İzmir",
  Eskisehir: "Eskişehir",
  Diyarbakir: "Diyarbakır",

  Jakarta: "Cakarta",
  Dhaka: "Dakka",
  "New Delhi": "Yeni Delhi",
  Shanghai: "Şanghay",
  Seoul: "Seul",
  Karachi: "Karaçi",
  Beijing: "Pekin",
  Lahore: "Lahor",
  "New York City": "New York",
  "Washington, D.C.": "Washington",
  Kinshasa: "Kinşasa",
  "GB:London": "Londra",
  Alexandria: "İskenderiye",
  "Dar es Salaam": "Darüsselam",
  Singapore: "Singapur",
  "Islāmābād": "İslamabad",
  "Saint Petersburg": "St. Petersburg",
  Casablanca: "Kazablanka",
  Jeddah: "Cidde",
  Mecca: "Mekke",
  Medina: "Medine",
  "At Ta'if": "Taif",
  Luxor: "Luksor",
  Suez: "Süveyş",
  Damietta: "Dimyat",
  "Al Ismailiya": "İsmailiye",
  "El Mansura": "Mansure",
  Peshawar: "Peşaver",
  "Ho Chi Minh City": "Ho Chi Minh",
  "Bogotá": "Bogota",
  "Sri Jayawardenepura Kotte - Colombo": "Kolombo",
  "Macau - Zhuhai": "Makao - Zhuhai",
  "Xiamen City": "Xiamen",
  "Jilin City": "Jilin",
  "Ürümqi": "Urumçi",
  "市中区": "Zaozhuang",
  "塔什科瑞克乡": "Gulca",
  "胶南": "Jiaonan",
  "Kasaï-Oriental": "Mbuji-Mayi",
  "شبلنجة": "Shiblanga",
  "دنجواي": "Dinjiway",

  Mashhad: "Meşhed",
  Isfahan: "İsfahan",
  Tabriz: "Tebriz",
  Shiraz: "Şiraz",
  Qom: "Kum",
  Ahwaz: "Ahvaz",
  Urmia: "Urmiye",
  Kermanshah: "Kirmanşah",
  Hamedan: "Hemedan",
  Ardabil: "Erdebil",
  Zanjan: "Zencan",
  Qazvin: "Kazvin",
  "Bandar Abbas": "Bender Abbas",
  "ویس": "Veys",
  "جیرفت": "Ciroft",

  Aleppo: "Halep",
  Homs: "Humus",
  Latakia: "Lazkiye",
  "Deir Ez Zor": "Deyrizor",
  Qamishli: "Kamışlı",
  "Al-Hasakah": "Haseke",
  Raqqa: "Rakka",
  Mosul: "Musul",
  Kirkuk: "Kerkük",
  Sulaymaniyah: "Süleymaniye",
  Karbala: "Kerbela",
  "Al-Najaf": "Necef",
  Fallujah: "Felluce",
  Hodeidah: "Hudeyde",
  "Ta'izz": "Taiz",

  Tunis: "Tunus",
  Sfax: "Sfaks",
  Fez: "Fas",
  Marrakesh: "Marakeş",
  Tangier: "Tanca",
  Oran: "Vahran",
  Benghazi: "Bingazi",

  Sumgayit: "Sumgayıt",
  Ganja: "Gence",
  Tbilisi: "Tiflis",
  Yerevan: "Erivan",
  Almaty: "Almatı",
  Shymkent: "Çimkent",
  Samarqand: "Semerkant",
  Bukhara: "Buhara",
  Andijon: "Andican",
  Qoqand: "Hokand",
  Urgench: "Ürgenç",
  Bishkek: "Bişkek",
  Dushanbe: "Duşanbe",
  "Mazar i sharif": "Mezar-ı Şerif",

  Jerusalem: "Kudüs",
  Haifa: "Hayfa",
  Nazareth: "Nasıra",
  "LB:Tripoli": "Trablusşam",

  Munich: "Münih",
  Cologne: "Köln",
  Dusseldorf: "Düsseldorf",
  Nuremberg: "Nürnberg",
  Hanover: "Hannover",
  Naples: "Napoli",
  Milan: "Milano",
  Turin: "Torino",
  Genoa: "Cenova",
  Florence: "Floransa",
  Seville: "Sevilla",
  Thessaloniki: "Selanik",
  Kharkiv: "Harkiv",
  Odesa: "Odessa",
  Zaporizhzhia: "Zaporijya",
  Sevastopol: "Sivastopol",
  "Rostov-on-Don": "Rostov",
  Makhachkala: "Mahaçkale",
  "Тимофеевка": "Timofeyevka",
  Lodz: "Łódź",
  Krakow: "Krakov",
  Poznan: "Poznań",
  Gdansk: "Gdańsk",
  Sofia: "Sofya",
  Antwerp: "Anvers",
  "The Hague": "Lahey",
  Geneva: "Cenevre",
  Zurich: "Zürih",
  Gothenburg: "Göteborg",
  Malmo: "Malmö",
  Edinburgh: "Edinburg",
};

// --- CSV ---

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readCities(path) {
  const rl = createInterface({
    input: createReadStream(path).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let col = null;
  const cities = new Map();
  const totals = new Map(YEARS.map((y) => [y, 0]));
  const counts = new Map(YEARS.map((y) => [y, 0]));
  // Sehirlilerin agirlik merkezi: her sehrin o yilki konum vektoru nufusla
  // agirliklanip toplaniyor, toplam yuzeye yansitiliyor.
  const centroids = new Map(YEARS.map((y) => [y, [0, 0, 0]]));
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, "");
    if (!col) {
      col = Object.fromEntries(parseCsvLine(line).map((name, i) => [name, i]));
      continue;
    }
    const f = parseCsvLine(line);
    const year = Number(f[col.Year]);
    const pop = Number(f[col.Pop]);
    const code = f[col.City_Code];
    let c = cities.get(code);
    if (!c) {
      c = {
        name: f[col.City_Name],
        iso2: f[col.ISO2_Code],
        location: f[col.Location],
        capital: f[col.Capital] === "1",
        lat: NaN,
        lon: NaN,
        coordYear: -1,
        pop: new Map(),
      };
      cities.set(code, c);
    }
    // Nufus agirlikli merkez yil yil biraz kayiyor; 2025'inkini tercih et,
    // o yil yoksa en gec yilinkini.
    const lat = Number(f[col.PWCent_Latitude]);
    const lon = Number(f[col.PWCent_Longitude]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const better =
        c.coordYear !== ANCHOR_YEAR && (year === ANCHOR_YEAR || year > c.coordYear);
      if (better) {
        c.lat = lat;
        c.lon = lon;
        c.coordYear = year;
      }
    }
    if (totals.has(year) && Number.isFinite(pop) && pop > 0) {
      c.pop.set(year, pop);
      totals.set(year, totals.get(year) + pop);
      counts.set(year, counts.get(year) + 1);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const la = (lat * Math.PI) / 180;
        const lo = (lon * Math.PI) / 180;
        const v = centroids.get(year);
        v[0] += pop * Math.cos(la) * Math.cos(lo);
        v[1] += pop * Math.cos(la) * Math.sin(lo);
        v[2] += pop * Math.sin(la);
      }
    }
  }
  return { cities: [...cities.values()], totals, counts, centroids };
}

function toLatLon([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return [(Math.asin(z / len) * 180) / Math.PI, (Math.atan2(y, x) * 180) / Math.PI];
}

// Arama icin: buyuk/kucuk harf ve aksan farkini yok say.
const plain = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .toLowerCase();

function displayName(c) {
  const byCountry = TR_NAMES[`${c.iso2}:${c.name}`];
  if (byCountry) return byCountry;
  if (TR_NAMES[c.name]) return TR_NAMES[c.name];
  const paren = c.name.match(/\(([^)]+)\)\s*$/);
  return paren ? paren[1] : c.name;
}

// --- Kara maskesi ---

function landRings(geojson) {
  const rings = [];
  for (const feature of geojson.features) {
    const g = feature.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }
  return rings;
}

// Her satirin enleminde tum kenarlarin kesisimlerini topla, cift-tek
// kuraliyla icerde olan noktalari isaretle. Nokta-cokgen testinden cok
// daha hizli ve delikleri (ic denizler) kendiliginden dogru ele aliyor.
function buildLandMask(rings) {
  const counts = [];
  const bits = [];
  const rows = Math.round((LAT_MAX - LAT_MIN) / STEP);
  for (let i = 0; i < rows; i++) {
    const lat = LAT_MIN + (i + 0.5) * STEP;
    const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / STEP));
    counts.push(n);
    const xs = [];
    for (const ring of rings) {
      for (let k = 0, m = ring.length; k < m - 1; k++) {
        const [x1, y1] = ring[k];
        const [x2, y2] = ring[k + 1];
        if (y1 <= lat !== y2 <= lat) {
          xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    let p = 0;
    for (let j = 0; j < n; j++) {
      const lon = -180 + ((j + 0.5) * 360) / n;
      while (p < xs.length && xs[p] < lon) p++;
      bits.push(p % 2 === 1 ? 1 : 0);
    }
  }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => {
    if (b) bytes[i >> 3] |= 1 << (i & 7);
  });
  const total = bits.reduce((a, b) => a + b, 0);
  return { counts, mask: Buffer.from(bytes).toString("base64"), total };
}

// --- Cikti ---

const round2 = (v) => Math.round(v * 100) / 100;

const { cities, totals, counts, centroids } = await readCities(csvPath);

const kept = cities
  .filter((c) => Number.isFinite(c.lat) && Math.max(0, ...c.pop.values()) >= MIN_POP)
  .sort((a, b) => (b.pop.get(ANCHOR_YEAR) ?? 0) - (a.pop.get(ANCHOR_YEAR) ?? 0));

const nonLatin = [];
const rows = kept.map((c) => {
  const name = displayName(c);
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{M}`'‘’]/u.test(name)) nonLatin.push(name);
  if (!c.iso2) console.warn(`ISO2 yok: ${c.name} (${c.location})`);
  let prev = 0;
  const deltas = YEARS.map((y) => {
    const v = Math.round(c.pop.get(y) ?? 0);
    const d = v - prev;
    prev = v;
    return d;
  });
  const row = [name, c.iso2 || c.location, round2(c.lat), round2(c.lon), c.capital ? 1 : 0, deltas];
  // BM'deki ad Turkce addan farkliysa aramada o da bulunsun ("Cairo",
  // "New York City").
  if (!plain(c.name).includes(plain(name))) row.push(c.name);
  return row;
});
if (nonLatin.length) console.warn("Latin olmayan ad:", nonLatin.join(", "));

const land = buildLandMask(landRings(JSON.parse(await readFile(landPath, "utf8"))));

const data = {
  source: "UN DESA, World Urbanization Prospects 2025",
  years: YEARS,
  // Tum BM sehirlerinin (esik alti dahil) toplami ve sayisi; binlik birim.
  totals: YEARS.map((y) => Math.round(totals.get(y))),
  cityCounts: YEARS.map((y) => counts.get(y)),
  // Yil basina [enlem, boylam], yine tum sehirlerden.
  centroids: YEARS.flatMap((y) => toLatLon(centroids.get(y)).map(round2)),
  // [ad, ulke, enlem, boylam, baskent, yillik farklar, BM adi?]
  cities: rows,
  land: { latMin: LAT_MIN, step: STEP, counts: land.counts, mask: land.mask },
};

await mkdir(dirname(OUT), { recursive: true });
const json = JSON.stringify(data);
await writeFile(OUT, json);
console.log(
  `wrote ${OUT}: ${rows.length} sehir, ${land.total} kara noktasi, ${(json.length / 1024).toFixed(0)} KB`,
);
