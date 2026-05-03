// OpenStreetMap'ten Kırklareli merkez bbox için bina, su, yol ve mahalle
// verilerini Overpass API ile çek; çamur (slime mold) simülasyonu için
// app/lab/camur/data.json'ı yeniden üret.
//
// Çalıştır: node scripts/fetch-camur-data.mjs

import fs from "node:fs";
import path from "node:path";

const BBOX = [41.715, 27.175, 41.785, 27.24]; // [s, w, n, e]
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OUT = path.resolve("app/lab/camur/data.json");

async function overpass(query) {
  const body = "data=" + encodeURIComponent(query);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "yunuses.com-camur/1.0 (yunuses@gmail.com)",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

// Way'i çözümleyen helper — node referanslarından lon/lat çıkarır.
function buildNodeMap(elements) {
  const map = new Map();
  for (const el of elements) {
    if (el.type === "node") map.set(el.id, [el.lon, el.lat]);
  }
  return map;
}

function wayCoords(way, nodes) {
  const out = [];
  for (const id of way.nodes) {
    const c = nodes.get(id);
    if (c) out.push(c);
  }
  return out;
}

// Relation içindeki "outer" rolündeki way'leri ring'e bağlar (multipolygon).
function ringsFromRelation(rel, ways, nodes) {
  const outers = (rel.members || [])
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""))
    .map((m) => ways.get(m.ref))
    .filter(Boolean);
  // Basit yaklaşım: her outer way'i ayrı bir ring olarak döndür.
  return outers.map((w) => wayCoords(w, nodes)).filter((r) => r.length >= 3);
}

async function fetchBuildings() {
  const [s, w, n, e] = BBOX;
  const q = `
[out:json][timeout:120];
(
  way["building"](${s},${w},${n},${e});
  relation["building"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;
  const data = await overpass(q);
  const nodes = buildNodeMap(data.elements);
  const ways = new Map();
  for (const el of data.elements) {
    if (el.type === "way") ways.set(el.id, el);
  }

  const buildings = [];
  // Standalone way (relation üyesi olmayanlar) — building tag'i olanlar.
  const usedWays = new Set();
  for (const el of data.elements) {
    if (el.type === "relation") {
      const rings = ringsFromRelation(el, ways, nodes);
      for (const r of rings) {
        const flat = [];
        for (const [lon, lat] of r) flat.push(lon, lat);
        if (flat.length >= 6) buildings.push(flat);
      }
      for (const m of el.members || []) {
        if (m.type === "way") usedWays.add(m.ref);
      }
    }
  }
  for (const el of data.elements) {
    if (el.type !== "way") continue;
    if (!el.tags || !el.tags.building) continue;
    if (usedWays.has(el.id)) continue;
    const coords = wayCoords(el, nodes);
    if (coords.length < 3) continue;
    const flat = [];
    for (const [lon, lat] of coords) flat.push(lon, lat);
    if (flat.length >= 6) buildings.push(flat);
  }
  return buildings;
}

async function fetchWater() {
  const [s, w, n, e] = BBOX;
  const q = `
[out:json][timeout:120];
(
  way["natural"="water"](${s},${w},${n},${e});
  relation["natural"="water"](${s},${w},${n},${e});
  way["water"](${s},${w},${n},${e});
  way["waterway"="riverbank"](${s},${w},${n},${e});
  way["landuse"="reservoir"](${s},${w},${n},${e});
  way["waterway"~"^(stream|river|canal|drain|ditch)$"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;
  const data = await overpass(q);
  const nodes = buildNodeMap(data.elements);
  const ways = new Map();
  for (const el of data.elements) if (el.type === "way") ways.set(el.id, el);

  const waterPolys = [];
  const waterLines = [];
  const usedWays = new Set();

  for (const el of data.elements) {
    if (el.type !== "relation") continue;
    if (!el.tags) continue;
    if (el.tags.natural !== "water" && !el.tags.water) continue;
    const rings = ringsFromRelation(el, ways, nodes);
    for (const r of rings) waterPolys.push(r);
    for (const m of el.members || []) if (m.type === "way") usedWays.add(m.ref);
  }
  for (const el of data.elements) {
    if (el.type !== "way") continue;
    if (usedWays.has(el.id)) continue;
    const t = el.tags || {};
    const coords = wayCoords(el, nodes);
    if (coords.length < 2) continue;
    const isPoly =
      t.natural === "water" ||
      t.water ||
      t.waterway === "riverbank" ||
      t.landuse === "reservoir";
    if (isPoly && coords.length >= 3) {
      waterPolys.push(coords);
    } else if (
      t.waterway &&
      ["stream", "river", "canal", "drain", "ditch"].includes(t.waterway)
    ) {
      waterLines.push(coords);
    }
  }
  return { waterPolys, waterLines };
}

async function fetchRoads() {
  const [s, w, n, e] = BBOX;
  const q = `
[out:json][timeout:120];
(
  way["highway"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;
  const data = await overpass(q);
  const nodes = buildNodeMap(data.elements);
  const groups = { major: [], residential: [], service: [], track: [] };
  for (const el of data.elements) {
    if (el.type !== "way") continue;
    const t = el.tags || {};
    const hw = t.highway;
    if (!hw) continue;
    const coords = wayCoords(el, nodes);
    if (coords.length < 2) continue;
    if (
      [
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "motorway_link",
        "trunk_link",
        "primary_link",
        "secondary_link",
        "tertiary_link",
        "unclassified",
      ].includes(hw)
    ) {
      groups.major.push(coords);
    } else if (hw === "residential" || hw === "living_street") {
      groups.residential.push(coords);
    } else if (
      hw === "service" ||
      hw === "footway" ||
      hw === "pedestrian" ||
      hw === "path"
    ) {
      groups.service.push(coords);
    } else if (hw === "track") {
      groups.track.push(coords);
    }
  }
  return groups;
}

async function fetchSettlements() {
  const [s, w, n, e] = BBOX;
  const q = `
[out:json][timeout:60];
(
  node["place"~"^(city|town|village|suburb|neighbourhood|hamlet|quarter)$"](${s},${w},${n},${e});
);
out body;`;
  const data = await overpass(q);
  const placeWeight = {
    city: 6,
    town: 5,
    neighbourhood: 5,
    suburb: 4,
    quarter: 4,
    village: 3,
    hamlet: 2,
  };
  const out = [];
  for (const el of data.elements) {
    if (el.type !== "node") continue;
    const t = el.tags || {};
    if (!t.name) continue;
    out.push({
      name: t.name,
      kind: t.place,
      lon: el.lon,
      lat: el.lat,
      w: placeWeight[t.place] ?? 3,
    });
  }
  return out;
}

(async () => {
  console.log("Bina çekiliyor...");
  const buildings = await fetchBuildings();
  console.log("  ", buildings.length, "polygon");

  console.log("Su çekiliyor...");
  const water = await fetchWater();
  console.log("  ", water.waterPolys.length, "polygon,", water.waterLines.length, "line");

  console.log("Yol çekiliyor...");
  const roads = await fetchRoads();
  console.log(
    "  ",
    "major=" + roads.major.length,
    "residential=" + roads.residential.length,
    "service=" + roads.service.length,
    "track=" + roads.track.length
  );

  console.log("Yerleşim çekiliyor...");
  const settlements = await fetchSettlements();
  console.log("  ", settlements.length, "settlement");

  const dataset = {
    bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]], // [w, s, e, n] — renderer'ın beklediği lon-lat sıra
    source: `OpenStreetMap via Overpass API, ${new Date().toISOString().slice(0, 10)}`,
    settlements,
    waterLines: water.waterLines,
    waterPolys: water.waterPolys,
    buildings,
    roads,
  };

  fs.writeFileSync(OUT, JSON.stringify(dataset));
  const sz = fs.statSync(OUT).size;
  console.log(`\nYazıldı: ${OUT} (${(sz / 1024 / 1024).toFixed(2)} MB)`);
})();
