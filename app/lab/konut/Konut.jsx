"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStoredValue, writeStored } from "lib/browserStore";
import Decision from "./Decision";
import TimeChart from "./TimeChart";
import { monthLabel, num, pct } from "./format";
import { Legend, Section, Segmented, StatTile } from "./parts";
import { addMonths, unitStats } from "./unit";

const VIEW_STORE = "konut:gorunum:v1";
const PROVINCE_STORE = "konut:il";
const S1 = "var(--k-s1)";
const S2 = "var(--k-s2)";
const REF = "var(--color-faint)";

const RANGES = [
  { value: "3", label: "3 yıl" },
  { value: "6", label: "6 yıl" },
  { value: "all", label: "Tümü" },
];

function parseJson(raw) {
  try {
    const v = JSON.parse(raw || "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// Adresteki ?il= de bir dis depo: geri tusu (popstate) ve sayfanin kendi
// degistirmesi (URL_EVENT) dinleniyor.
const URL_EVENT = "konut:adres";
const subscribeUrl = (onChange) => {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
};
const readUrlProvince = () => new URLSearchParams(window.location.search).get("il");
const readUrlProvinceOnServer = () => null;

function setUrlProvince(slug) {
  const url = new URL(window.location.href);
  if (!slug || slug === "tr") url.searchParams.delete("il");
  else url.searchParams.set("il", slug);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_EVENT));
}

export default function Konut({ data }) {
  const turkey = data.turkey;

  // Grafik tercihleri localStorage'da; sunucuda ve hydration'da varsayilan.
  const viewPrefs = parseJson(useStoredValue(VIEW_STORE));
  const scale = viewPrefs.scale === "real" ? "real" : "nominal";
  const range = RANGES.some((r) => r.value === viewPrefs.range) ? viewPrefs.range : "3";
  const setView = (patch) => writeStored(VIEW_STORE, JSON.stringify({ scale, range, ...patch }));

  const provinceOf = (s) => (s === "tr" ? null : data.provinces.find((p) => p.slug === s));
  const regionOf = (s) => provinceOf(s)?.region ?? "tr";
  const valid = (s) => Boolean(s) && (s === "tr" || Boolean(provinceOf(s)));

  // Gosterilecek il: adresteki ?il=, yoksa kayitli secim, yoksa Turkiye.
  // Adres kayitli secimden once gelir ama onu ezmez: paylasilan bir baglanti
  // okurun kendi tercihini degistirmesin. Listeden secince ikisi de yaziliyor.
  const urlProvince = useSyncExternalStore(subscribeUrl, readUrlProvince, readUrlProvinceOnServer);
  const storedProvince = useStoredValue(PROVINCE_STORE);
  const slug = [urlProvince, storedProvince].find(valid) ?? "tr";
  const urlInvalid = urlProvince != null && !valid(urlProvince);

  // Gecersiz parametre adreste kalmasin.
  useEffect(() => {
    if (urlInvalid) setUrlProvince(null);
  }, [urlInvalid]);

  // Bolge verisi gerektiginde iniyor; inene kadar bir onceki gorunum soluk
  // olarak ekranda kaliyor.
  const [cache, setCache] = useState(() => ({ tr: turkey }));
  const [previous, setPrevious] = useState("tr");
  const [failed, setFailed] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const inflight = useRef(new Set());
  const wantedRegion = regionOf(slug);

  useEffect(() => {
    if (cache[wantedRegion] || inflight.current.has(wantedRegion)) return;
    inflight.current.add(wantedRegion);
    fetch(`/lab/konut/veri/${wantedRegion}/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setCache((c) => ({ ...c, [wantedRegion]: json })))
      .catch(() => setFailed(wantedRegion))
      .finally(() => inflight.current.delete(wantedRegion));
  }, [wantedRegion, cache, attempt]);

  const choose = (next) => {
    if (!valid(next)) return;
    setPrevious(shownSlug);
    setFailed(null);
    writeStored(PROVINCE_STORE, next);
    setUrlProvince(next);
  };

  const ready = Boolean(cache[wantedRegion]);
  const shownSlug = ready ? slug : cache[regionOf(previous)] ? previous : "tr";
  const loading = !ready && failed !== regionOf(slug);
  const province = provinceOf(shownSlug);
  const region = cache[regionOf(shownSlug)];
  const isTurkey = region.id === "tr";

  // m2 verisi: ilin kendisi, yoksa Turkiye ortalamasi.
  const turkeyUnit = unitStats(turkey.unit);
  const ownUnit = province ? unitStats(region.units?.[province.slug] ?? {}) : turkeyUnit;
  const unit = ownUnit ?? turkeyUnit;
  const unitFallback = Boolean(province) && !ownUnit;
  const place = province?.name ?? "Türkiye";
  const unitPlace = unitFallback ? "Türkiye" : place;

  const qs = data.quantiles;
  const qi = (q) => qs.indexOf(q);
  const lastMonth = region.last.month;
  const cpiAtLast = data.cpiYoy.find(([k]) => k === lastMonth)?.[1];
  const realYoyLast = region.realYoy[region.realYoy.length - 1][1];
  const nomYoyLast = region.nomYoy[region.nomYoy.length - 1][1];

  // Ana grafik: gecmis + tahmin
  const main = (() => {
    const hist = scale === "real" ? region.real : region.nominal;
    const from = range === "all" ? "0000-00" : addMonths(lastMonth, -12 * Number(range));
    const histPts = hist.filter(([k]) => k >= from);
    const base = region.last.value;
    const key = scale === "real" ? "real" : "nominal";
    const steps = region.forecast.steps;
    const level = (s, q) => +(base * s[key][qi(q)]).toFixed(2);
    const series = [
      {
        id: "idx",
        label: scale === "real" ? `${region.short} (bugünün fiyatlarıyla)` : region.short,
        color: S1,
        dashedFrom: lastMonth,
        points: [...histPts, ...steps.map((s) => [s.month, level(s, 0.5)])],
      },
    ];
    if (!isTurkey) {
      const tr = scale === "real" ? turkey.real : turkey.nominal;
      series.unshift({ id: "tr", label: "Türkiye", color: REF, noEndDot: true, points: tr.filter(([k]) => k >= from) });
    }
    const bands = [
      {
        id: "b80",
        label: "%80 aralık",
        color: S1,
        opacity: 0.1,
        points: [[lastMonth, base, base], ...steps.map((s) => [s.month, level(s, 0.1), level(s, 0.9)])],
      },
      {
        id: "b50",
        label: "%50 aralık",
        color: S1,
        opacity: 0.14,
        points: [[lastMonth, base, base], ...steps.map((s) => [s.month, level(s, 0.25), level(s, 0.75)])],
      },
    ];
    return { series, bands };
  })();

  const yoyFrom = "2011-01";
  const yoyChart = [
    { id: "kfe", label: `Konut fiyatı, ${region.short}`, color: S1, points: region.nomYoy.filter(([k]) => k >= yoyFrom).map(([k, v]) => [k, v * 100]) },
    { id: "cpi", label: "Enflasyon (TÜFE)", color: S2, points: data.cpiYoy.filter(([k]) => k >= yoyFrom && k <= lastMonth).map(([k, v]) => [k, v * 100]) },
  ];

  const yieldChart = [
    ...(unitPlace === "Türkiye" ? [] : [{ id: "ytr", label: "Türkiye", color: REF, noEndDot: true, points: turkeyUnit.yield.map(([k, v]) => [k, v * 100]) }]),
    { id: "y", label: unitPlace, color: S1, points: unit.yield.map(([k, v]) => [k, v * 100]) },
  ];

  const view = { key: shownSlug, place, unitPlace, label: region.label, forecast: region.forecast, unit };

  const regionNote = !province
    ? null
    : region.provinces.length === 1
      ? "Endeks, tahmin ve m² verisi doğrudan il için."
      : `TCMB fiyat endeksini il bazında yayımlamıyor. Endeks ve tahmin ${region.code} bölgesi için (${region.provinces.join(", ")}); m² fiyatı ve kirası il bazında.`;

  const signals = buildSignals(region, unit, data);
  const f = region.forecast;

  return (
    <div className="konut-viz">
      {/* Filtre: altindaki her seyi kapsiyor */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="block">
          <span className="text-meta text-muted">İl</span>
          <span className="relative mt-1 flex items-center">
            <select
              value={slug}
              onChange={(e) => choose(e.target.value)}
              className="min-w-56 appearance-none rounded-lg border border-line bg-bg py-2 pl-3 pr-9 text-ui text-fg outline-none focus-visible:border-faint"
            >
              <option value="tr">Türkiye geneli</option>
              {data.provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 text-faint">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </label>
        <p className="pb-2 text-meta text-faint" role="status">
          {loading ? "Bölge verisi yükleniyor" : failed === regionOf(slug) ? "Bölge verisi yüklenemedi." : ""}
          {failed === regionOf(slug) && (
            <button
              type="button"
              onClick={() => {
                setFailed(null);
                setAttempt((a) => a + 1);
              }}
              className="ml-2 text-fg underline underline-offset-4"
            >
              Tekrar dene
            </button>
          )}
        </p>
      </div>
      {(regionNote || unitFallback) && (
        <p className="mt-3 max-w-reading text-meta text-faint">
          {regionNote}
          {unitFallback && " Bu il için TCMB m² verisi yayımlamıyor; m² rakamları ve hesaplayıcının varsayılanları Türkiye ortalaması."}
        </p>
      )}

      <div aria-busy={loading} className={`transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
      <div className="mt-8 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <StatTile
          label={`Endeks, ${monthLabel(lastMonth)}`}
          value={num(region.last.value, 1)}
          sub={`Bir önceki aya göre ${pct(region.mom, 1, true)}`}
        />
        <StatTile
          label="Son 12 ayda"
          value={pct(nomYoyLast, 1, true)}
          sub={cpiAtLast != null ? `Aynı dönemde enflasyon ${pct(cpiAtLast, 1)}` : undefined}
        />
        <StatTile
          label="Enflasyondan arındırınca"
          value={pct(realYoyLast, 1, true)}
          sub={
            region.valuation.fallingFor > 0
              ? `${region.valuation.fallingFor} aydır reel olarak düşüyor`
              : "Reel olarak artıyor"
          }
        />
        <StatTile
          label="12 ay sonrası tahmini"
          value={pct(f.median12, 1, true)}
          sub={`%80 olasılıkla ${pct(f.low12, 0, true)} ile ${pct(f.high12, 0, true)} arası`}
        />
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-ui text-fg">Konut Fiyat Endeksi ve 24 aylık tahmin</h2>
            <p className="mt-0.5 text-meta text-muted">
              {scale === "real"
                ? `Enflasyondan arındırılmış, ${monthLabel(lastMonth)} fiyatlarıyla.`
                : "2023 = 100. Tahmin kesikli çizgi, etrafındaki bantlar olasılık aralığı."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              size="sm"
              label="Ölçek"
              value={scale}
              onChange={(v) => setView({ scale: v })}
              options={[
                { value: "nominal", label: "Nominal" },
                { value: "real", label: "Reel" },
              ]}
            />
            <Segmented size="sm" label="Aralık" value={range} onChange={(v) => setView({ range: v })} options={RANGES} />
          </div>
        </div>
        <div className="mt-4">
          <Legend
            items={[
              ...(!isTurkey ? [{ label: "Türkiye", color: REF }] : []),
              { label: region.short, color: S1 },
              { label: "Tahmin (orta)", color: S1, kind: "dashed" },
              { label: "%50 ve %80 olasılık aralığı", color: S1, kind: "band", opacity: 0.22 },
            ]}
          />
        </div>
        <div className="mt-2">
          <TimeChart
            series={main.series}
            bands={main.bands}
            marker={{ at: lastMonth, label: "Tahmin" }}
            height={340}
            yFormat={(v) => num(v, 0)}
            valueFormat={(v) => num(v, 1)}
            ariaLabel={`${region.label} konut fiyat endeksi ve tahmini`}
          />
        </div>
      </div>

      <Section
        id="degisim"
        eyebrow="Enflasyonla karşılaştırma"
        title="Yıllık değişim"
        intro={`Mavi çizgi turuncunun altındaysa konut fiyatları enflasyonun gerisinde kalıyor, yani ev reel olarak ucuzluyor. ${
          region.valuation.fallingFor > 0
            ? `${region.label}: fiyatlar ${region.valuation.fallingFor} aydır enflasyonun gerisinde.`
            : `${region.label}: fiyatlar şu an enflasyondan hızlı artıyor.`
        }`}
      >
        <Legend items={yoyChart.map((s) => ({ label: s.label, color: s.color }))} />
        <div className="mt-2">
          <TimeChart
            series={yoyChart}
            zero
            height={280}
            yFormat={(v) => `%${num(v, 0)}`}
            valueFormat={(v) => `%${num(v, 1)}`}
            ariaLabel="Konut fiyatı ve enflasyonun yıllık değişimi"
          />
        </div>
      </Section>

      <Section
        id="kira"
        eyebrow={`${unitPlace} için m² verisi`}
        title="Fiyat, kira ve kira getirisi"
        intro="TCMB, değerlemesi yapılan konutların m² fiyatını ve m² kirasını üç ayda bir il bazında yayımlıyor. Yıllık kiranın fiyata oranı brüt kira getirisi: evi alıp kiraya verseydin yılda fiyatının yüzde kaçını kira olarak alırdın."
      >
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <StatTile
            label={`m² fiyatı, ${quarterLabel(unit.unitPrice[0])}`}
            value={`${num(unit.unitPrice[1], 0)} TL`}
            sub={unit.unitPriceYoy != null ? `Bir yılda ${pct(unit.unitPriceYoy, 1, true)}` : undefined}
          />
          <StatTile
            label={`m² kirası, ${quarterLabel(unit.unitRent[0])}`}
            value={`${num(unit.unitRent[1], 0)} TL`}
            sub={`100 m² için aylık ${num(unit.unitRent[1] * 100, 0)} TL`}
          />
          <StatTile
            label="Brüt kira getirisi"
            value={pct(unit.yieldNow, 1)}
            sub={`${unit.yieldFrom}-${unit.yieldTo} ortalaması ${pct(unit.yieldAvg, 1)}`}
          />
        </div>
        <div className="mt-6">
          <Legend items={yieldChart.map((s) => ({ label: s.label, color: s.color }))} />
          <div className="mt-2">
            <TimeChart
              series={yieldChart}
              height={240}
              yFormat={(v) => `%${num(v, 1)}`}
              valueFormat={(v) => `%${num(v, 2)}`}
              ariaLabel="Brüt kira getirisi"
            />
          </div>
        </div>
      </Section>

      <Section
        id="karar"
        eyebrow="Al mı, bekle mi?"
        title="Bugün almak mı, beklemek mi?"
        intro="İki kişi aynı parayla başlıyor. Biri evi bugün alıyor. Diğeri parasını mevduatta tutup kira ödüyor ve aynı evi aylar sonra o günün fiyatıyla alıyor. Hesap, ikisinin servetini karşılaştırıyor. Fiyat ve kira kutularına kendi rakamlarını yazabilirsin; girdiklerin sadece bu tarayıcıda kalıyor."
      >
        <Decision view={view} common={data} />
      </Section>

      <Section id="sinyaller" eyebrow="Piyasa göstergeleri" title="Hangi yöne işaret ediyorlar?">
        <ul className="divide-y divide-line border-y border-line">
          {signals.map((s) => (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-4 max-sm:grid-cols-1">
              <div className="min-w-0">
                <div className="text-ui text-fg">{s.title}</div>
                <p className="mt-1 text-meta text-muted">{s.text}</p>
              </div>
              <div className="self-start whitespace-nowrap text-meta">
                <Stance stance={s.stance} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="yontem"
        eyebrow="Yöntem"
        title="Tahmin nasıl yapılıyor, ne kadar güvenilir?"
      >
        <div className="max-w-reading space-y-4 text-body text-prose">
          <p>
            Model, enflasyondan arındırılmış aylık fiyat değişiminin son üç ayına bakarak bir sonraki ayı tahmin ediyor.
            Son dönemin eğilimi bir süre sürüyor, sonra uzun dönem ortalamasına dönüyor. Bu ortalama 2020-2023
            patlamasından önceki on yılın ortalaması (yılda {pct(f.longRunReal, 1, true)}). Nominal fiyat buna piyasa
            katılımcılarının 12 ay sonrası enflasyon beklentisi (şu an {pct(data.expectation.value, 1)}) eklenerek
            bulunuyor. Bantlar 2.000 olası gelecek senaryosundan çıkıyor: modelin geçmişteki hataları ve enflasyon
            beklentisinin son üç yıldaki sapmaları yeniden örnekleniyor.
          </p>
          <p>
            Modeli seçmek için 2016'dan bu yana her ay, o gün bilinen veriyle tahmin yapıldı ve sonradan gerçekleşenle
            karşılaştırıldı. &quot;Son 12 ayın hızı sürer&quot; varsayımı enflasyonun düştüğü 2023 sonrasında fiyat
            artışını çok fazla tahmin ediyordu. Kasım 2026&apos;daki sınamada bu model aynı dönemin hatasını Türkiye
            için yaklaşık dörtte bire indirdi.
          </p>
        </div>
        <BacktestTable region={region} />
        <p className="mt-4 max-w-reading text-meta text-muted">
          Okuması: sakin dönemlerde 12 ay sonrası için sapma birkaç puan. 2021-2022 gibi bir şokta ise hiçbir model işe
          yaramadı; Ekim 2022&apos;de fiyatlar bir yıl öncesinin neredeyse üç katıydı. Bantlar bugünkü para politikasını yansıtıyor, böyle
          bir rejim değişikliğini değil. Enflasyon beklentisi de son iki yılda gerçekleşenin 5-7 puan altında kaldı.
          Ev fiyatları enflasyon sürprizini hemen yansıtmadığı için bu, tahmin hatasını şimdiye kadar büyütmedi.
        </p>
      </Section>

      <Section id="veri" eyebrow="Veri" title="Kaynak ve tablo">
        <div className="max-w-reading space-y-3 text-meta text-muted">
          <p>
            Veri: TCMB Elektronik Veri Dağıtım Sistemi (EVDS). Konut Fiyat Endeksi (Türkiye ve 19 bölge), il bazında
            konut birim fiyatları ve kiraları, TÜFE (2025=100), konut kredisi ve mevduat faizleri, piyasa
            katılımcılarının enflasyon beklentisi. TCMB yalnızca verinin sağlayıcısı; tahminler ve yorumlar bu sayfaya
            ait, TCMB&apos;nin görüşü değil.
          </p>
          <p>
            Sayfa veriyi 12 saatte bir yeniliyor. Son veri ayı {monthLabel(lastMonth)}
            {data.source === "snapshot" ? " (yedek veri gösteriliyor)" : ""}. Bu sayfa yatırım tavsiyesi değildir.
          </p>
        </div>
        <DataTable region={region} cpiYoy={data.cpiYoy} qs={qs} />
      </Section>
      </div>
    </div>
  );
}

function quarterLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${Math.ceil(m / 3)}. çeyrek ${y}`;
}

function Stance({ stance }) {
  const map = {
    wait: { label: "Beklemeyi destekliyor", icon: "M12 7v5l3 2", circle: true },
    buy: { label: "Almayı destekliyor", icon: "M4 11l8-7 8 7M6 10v9h12v-9" },
    even: { label: "Nötr", icon: "M5 12h14" },
  };
  const s = map[stance];
  return (
    <span className="inline-flex items-center gap-1.5 text-fg">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {s.circle && <circle cx="12" cy="12" r="9" />}
        <path d={s.icon} />
      </svg>
      {s.label}
    </span>
  );
}

function buildSignals(region, unit, data) {
  const f = region.forecast;
  const realYoy = region.realYoy[region.realYoy.length - 1][1];
  const v = region.valuation;
  const out = [];

  out.push({
    id: "trend",
    title: "Reel fiyat eğilimi",
    text:
      realYoy < 0
        ? `Fiyatlar son 12 ayda enflasyonun ${pct(-realYoy, 1)} gerisinde kaldı. Reel düşüş ${v.fallingFor} aydır sürüyor. Model önümüzdeki 12 ayda reel ${pct(f.real12, 1, true)} bekliyor.`
        : `Fiyatlar son 12 ayda enflasyonu ${pct(realYoy, 1)} geçti. Model önümüzdeki 12 ayda reel ${pct(f.real12, 1, true)} bekliyor.`,
    stance: f.real12 < -0.01 ? "wait" : f.real12 > 0.01 ? "buy" : "even",
  });

  out.push({
    id: "valuation",
    title: "Fiyat seviyesi",
    text: `Reel fiyat ${monthLabel(v.peak.month)} zirvesinin ${pct(-v.peak.gap, 0)} altında, ama patlama öncesi 2019 ortalamasının ${pct(v.vsPreBoom, 0)} ${v.vsPreBoom >= 0 ? "üstünde" : "altında"}.`,
    stance: v.vsPreBoom > 0.25 ? "wait" : v.vsPreBoom < 0 ? "buy" : "even",
  });

  const y = unit;
  out.push({
    id: "yield",
    title: "Kira getirisi",
    text: `Brüt kira getirisi ${pct(y.yieldNow, 1)}. ${y.yieldFrom}-${y.yieldTo} ortalaması ${pct(y.yieldAvg, 1)}. Getiri ortalamanın üstündeyse ev, kirasına göre ucuz demektir.`,
    stance: y.yieldNow > y.yieldAvg * 1.1 ? "buy" : y.yieldNow < y.yieldAvg * 0.9 ? "wait" : "even",
  });

  const depNet = data.deposit.value * (1 - 0.175);
  const depReal = (1 + depNet) / (1 + data.expectation.value) - 1;
  const ownReal = f.real12 + y.yieldNow;
  out.push({
    id: "deposit",
    title: "Paranın alternatif getirisi",
    text: `3 aylık mevduat yıllık ${pct(data.deposit.value, 1)} (stopaj sonrası ${pct(depNet, 1)}). Beklenen enflasyonun üstünde reel ${pct(depReal, 1, true)}. Ev sahibi olmanın beklenen reel getirisi (fiyat artışı ve kira) ${pct(ownReal, 1, true)}.`,
    stance: depReal > ownReal + 0.01 ? "wait" : depReal < ownReal - 0.01 ? "buy" : "even",
  });

  const rm = data.realMortgage;
  const rmNow = rm[rm.length - 1][1];
  const rmAvg = rm.reduce((s, [, x]) => s + x, 0) / rm.length;
  out.push({
    id: "credit",
    title: "Kredi maliyeti",
    text: `Konut kredisi faizi yıllık ${pct(data.mortgage.value, 1)}, beklenen enflasyonun ${pct(rmNow, 1)} üstünde. 2015'ten beri ortalama reel faiz ${pct(rmAvg, 1, true)}. Kredili alım için pahalı bir dönem; faizler düştüğünde fiyatlar genelde hızlanıyor.`,
    stance: rmNow > rmAvg + 0.03 ? "wait" : rmNow < rmAvg - 0.03 ? "buy" : "even",
  });

  return out;
}

function BacktestTable({ region }) {
  return (
    <table className="mt-6 w-full max-w-reading text-meta tabular-nums">
      <caption className="mb-2 text-left text-ui text-fg">Geçmişe dönük sınama, {region.label}</caption>
      <thead className="text-faint">
        <tr className="border-b border-line text-left">
          <th className="py-2 font-normal">Başlangıç dönemi</th>
          {region.backtest.map((b) => (
            <th key={b.h} className="py-2 text-right font-normal">
              {b.h} ay sonrası ortalama sapma
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-muted">
        {region.backtest[0].periods.map((p, i) => (
          <tr key={p.id} className="border-b border-line-soft">
            <td className="py-2 text-fg">{p.label}</td>
            {region.backtest.map((b) => (
              <td key={b.h} className="py-2 text-right">
                {b.periods[i].mae == null ? "–" : pct(b.periods[i].mae, 1)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DataTable({ region, cpiYoy, qs }) {
  const cpi = new Map(cpiYoy);
  const nomYoy = new Map(region.nomYoy);
  const realYoy = new Map(region.realYoy);
  const rows = region.nominal.slice(-24).reverse();
  const steps = region.forecast.steps;
  return (
    <details className="mt-6 rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer list-none text-ui text-muted hover:text-fg">
        Son 24 ay ve tahmin tablosu
      </summary>
      <div className="mt-4 grid grid-cols-2 gap-8 max-md:grid-cols-1">
        <table className="w-full text-meta tabular-nums">
          <caption className="mb-2 text-left text-faint">Gerçekleşen, {region.label}</caption>
          <thead className="text-faint">
            <tr className="border-b border-line text-left">
              <th className="py-1.5 font-normal">Ay</th>
              <th className="py-1.5 text-right font-normal">Endeks</th>
              <th className="py-1.5 text-right font-normal">Yıllık</th>
              <th className="py-1.5 text-right font-normal">Reel yıllık</th>
              <th className="py-1.5 text-right font-normal">TÜFE yıllık</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-line-soft">
                <td className="py-1.5 text-fg">{monthLabel(k)}</td>
                <td className="py-1.5 text-right">{num(v, 2)}</td>
                <td className="py-1.5 text-right">{nomYoy.has(k) ? pct(nomYoy.get(k), 1) : "–"}</td>
                <td className="py-1.5 text-right">{realYoy.has(k) ? pct(realYoy.get(k), 1) : "–"}</td>
                <td className="py-1.5 text-right">{cpi.has(k) ? pct(cpi.get(k), 1) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-meta tabular-nums">
          <caption className="mb-2 text-left text-faint">Tahmin, endeks düzeyi</caption>
          <thead className="text-faint">
            <tr className="border-b border-line text-left">
              <th className="py-1.5 font-normal">Ay</th>
              <th className="py-1.5 text-right font-normal">Alt (%10)</th>
              <th className="py-1.5 text-right font-normal">Orta</th>
              <th className="py-1.5 text-right font-normal">Üst (%90)</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {steps.map((s) => {
              const base = region.last.value;
              const q = (p) => num(base * s.nominal[qs.indexOf(p)], 1);
              return (
                <tr key={s.month} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{monthLabel(s.month)}</td>
                  <td className="py-1.5 text-right">{q(0.1)}</td>
                  <td className="py-1.5 text-right text-fg">{q(0.5)}</td>
                  <td className="py-1.5 text-right">{q(0.9)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

