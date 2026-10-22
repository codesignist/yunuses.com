"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useLabKeys from "lib/useLabKeys";
import LabOptionBar from "components/molecules/LabOptionBar";
import {
  ESTIMATE_YEAR,
  FIRST_YEAR,
  LAST_YEAR,
  RANK_FLOOR,
  cityCountAt,
  countryName,
  formatBillions,
  formatCount,
  formatPop,
  growthSentence,
  loadGlobeData,
  popAt,
  totalAt,
} from "./data";
import { createGlobeScene } from "./scene";

const VIEWS = { globe: "Küre", map: "Harita" };
const VIEW_IDS = Object.keys(VIEWS);
const VIEW_OPTIONS = VIEW_IDS.map((id) => ({ id, label: VIEWS[id] }));
const START_YEAR = 2025;
const YEARS_PER_SECOND = 6;
const TOP_N = 10;
const CARD_W = 256;
// Sagdaki liste lg ve ustunde gorunuyor: genislik + kenar boslugu + ara.
const LIST_W = 272;
const LIST_SAFE = LIST_W + 20 + 16;
const LIST_QUERY = "(min-width: 1024px)";
// Bunun altinda alt panel tam genislik, sahnenin altini kapatiyor.
const WIDE_QUERY = "(min-width: 768px)";
const SODIUM = "#f39a3d";
const THUMB = 14;

const GLASS = "rounded-lg border border-white/10 bg-black/45 backdrop-blur-md";

export default function Globe() {
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const dockRef = useRef(null);
  const sceneRef = useRef(null);
  const activeRef = useRef(-1);
  const yearRef = useRef(START_YEAR);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [view, setView] = useState("globe");
  const [year, setYear] = useState(START_YEAR);
  const [playing, setPlaying] = useState(false);
  const [pickHover, setPickHover] = useState(-1);
  const [listHover, setListHover] = useState(-1);
  const [selected, setSelected] = useState(-1);

  useLabKeys(VIEW_IDS, setView);

  useEffect(() => {
    const ctrl = new AbortController();
    loadGlobeData(ctrl.signal)
      .then(setData)
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus("error");
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!data) return;

    // Kart sehrin sutun tepesine yapisik; konumu her karede sahneden
    // geliyor, React'e ugramadan dogrudan stile yaziliyor.
    function placeCard() {
      const el = cardRef.current;
      const s = sceneRef.current;
      if (!el || !s) return;
      const a = activeRef.current >= 0 ? s.anchor(activeRef.current) : null;
      if (!a || !a.ok) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        return;
      }
      const { width, height } = s.size();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let x;
      let y;
      if (width < 640) {
        // Dar ekranda parmak karti kapatmasin: ustte, ortada.
        x = (width - w) / 2;
        y = 64;
      } else {
        // Liste gorunurken kart onun altina girmesin.
        const right = width >= 1024 ? width - LIST_SAFE : width - 16;
        x = a.x + 18;
        y = a.y - h - 14;
        if (x + w > right) x = a.x - w - 18;
        if (y < 72) y = a.y + 18;
        x = Math.min(Math.max(16, x), right - w);
        y = Math.min(Math.max(16, y), height - h - 16);
      }
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      if (el.style.opacity !== "1") el.style.opacity = "1";
    }

    const s = createGlobeScene(containerRef.current, data, {
      hover: setPickHover,
      select: setSelected,
      frame: placeCard,
    });
    if (!s) {
      setStatus("unsupported");
      return;
    }
    sceneRef.current = s;
    s.setYear(yearRef.current);
    setStatus("ready");
    return () => {
      s.dispose();
      sceneRef.current = null;
    };
  }, [data]);

  // Sahneye arayuzun kapladigi kenarlari bildir: genis ekranda sagdaki
  // liste, dar ekranda alttaki panel (zaman cubugu + gorunum secici).
  useEffect(() => {
    const s = sceneRef.current;
    const dock = dockRef.current;
    if (status !== "ready" || !s || !dock) return;
    const listQuery = window.matchMedia(LIST_QUERY);
    const wideQuery = window.matchMedia(WIDE_QUERY);
    const sync = () =>
      s.setSafeArea(listQuery.matches ? LIST_SAFE : 0, wideQuery.matches ? 0 : dock.offsetHeight + 24);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(dock);
    listQuery.addEventListener("change", sync);
    wideQuery.addEventListener("change", sync);
    return () => {
      ro.disconnect();
      listQuery.removeEventListener("change", sync);
      wideQuery.removeEventListener("change", sync);
    };
  }, [status]);

  const hover = listHover >= 0 ? listHover : pickHover;
  const active = hover >= 0 ? hover : selected;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    sceneRef.current?.setHighlight(hover, selected);
  }, [hover, selected, status]);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view, status]);

  useEffect(() => {
    yearRef.current = year;
    if (!playing) sceneRef.current?.setYear(year);
  }, [year, playing, status]);

  // Oynatma: sutunlar kesirli yillarla akiyor, arayuz tam yillarda yenileniyor.
  useEffect(() => {
    if (!playing || status !== "ready") return;
    let raf = 0;
    let prev = 0;
    let y = yearRef.current >= LAST_YEAR ? FIRST_YEAR : yearRef.current;
    function tick(t) {
      const dt = prev ? Math.min(0.1, (t - prev) / 1000) : 0;
      prev = t;
      y = Math.min(LAST_YEAR, y + dt * YEARS_PER_SECOND);
      sceneRef.current?.setYear(y);
      const whole = Math.floor(y);
      if (whole !== yearRef.current) {
        yearRef.current = whole;
        setYear(whole);
      }
      if (y >= LAST_YEAR) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, status]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const changeYear = useCallback((y) => {
    setPlaying(false);
    setYear(y);
  }, []);

  const pickFromList = useCallback((i) => {
    setSelected(i);
    sceneRef.current?.flyTo(i);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        setSelected(-1);
        return;
      }
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName))) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // Siralama yil degistikce bastan; 2.600 sehri siralamak oynatma sirasinda
  // bile kare butcesinin cok altinda.
  const ranking = useMemo(() => {
    if (!data) return null;
    const vals = new Float32Array(data.count);
    for (let i = 0; i < data.count; i++) vals[i] = popAt(data, i, year);
    const order = Array.from({ length: data.count }, (_, i) => i).sort((a, b) => vals[b] - vals[a]);
    const rank = new Int32Array(data.count);
    order.forEach((i, r) => {
      rank[i] = r + 1;
    });
    return { vals, rank, top: order.slice(0, TOP_N) };
  }, [data, year]);

  return (
    <div className="absolute inset-0 bg-black">
      {/* Tuvali three kendisi ekliyor; ad kapsayicida. */}
      <div
        ref={containerRef}
        role="img"
        aria-label="Dünya şehirlerinin nüfusunu ışık sütunlarıyla gösteren küre"
        className="absolute inset-0 touch-none select-none"
      />

      {/* data-chrome: sunucuda da ciziliyor, sayfanin markdown'ina girmesin. */}
      {status === "loading" && (
        <div data-chrome className="fixed inset-0 z-30 flex items-center justify-center text-[12px] text-white/55 pointer-events-none">
          Hazırlanıyor...
        </div>
      )}

      {status === "unsupported" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center text-white/70 text-sm px-6 text-center">
          Tarayıcın bu deneyi çalıştıramıyor. Başka bir tarayıcıda ya da cihazda dene.
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center text-white/70 text-sm px-6 text-center">
          Şehir verisi yüklenemedi. Sayfayı yenileyip tekrar dene.
        </div>
      )}

      {status === "ready" && ranking && (
        <>
          <div
            ref={cardRef}
            data-chrome
            className="pointer-events-none absolute left-0 top-0 z-20"
            style={{ opacity: 0, width: CARD_W }}
          >
            {active >= 0 && (
              <CityCard data={data} i={active} year={year} rank={ranking.rank[active]} />
            )}
          </div>

          <TopList
            data={data}
            ranking={ranking}
            selected={selected}
            onHover={setListHover}
            onPick={pickFromList}
          />

          <div
            ref={dockRef}
            className="fixed inset-x-4 bottom-4 z-30 flex flex-col-reverse gap-3 pointer-events-none md:flex-row md:items-end md:justify-between"
          >
            <div className="flex flex-col items-start gap-2 pointer-events-auto">
              <div data-chrome className="px-1 text-[12px] text-white/60 pointer-events-none">
                <span className="pointer-coarse:hidden">
                  {view === "globe" ? "Sürükleyerek döndür" : "Sürükleyerek kaydır"}, tekerlekle
                  yakınlaş, bir şehrin üstüne gel.
                </span>
                <span className="hidden pointer-coarse:inline">
                  {view === "globe" ? "Sürükleyerek döndür" : "Sürükleyerek kaydır"}, iki parmakla
                  yakınlaş, bir şehre dokun.
                </span>
              </div>
              <LabOptionBar options={VIEW_OPTIONS} active={view} onSelect={setView} />
            </div>

            <Timeline
              data={data}
              year={year}
              playing={playing}
              onYear={changeYear}
              onTogglePlay={togglePlay}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CityCard({ data, i, year, rank }) {
  const pop = popAt(data, i, year);
  const country = countryName(data.countries[i]);
  let note = growthSentence(data, i, year);
  if (pop <= 0) {
    const first = data.years[data.pops.subarray(i * data.stride, (i + 1) * data.stride).findIndex((v) => v > 0)];
    note = first ? `${first} öncesi için BM verisi yok.` : null;
  } else if (note) {
    note = `${note}.`;
  }
  return (
    <div className={`${GLASS} bg-black/60 p-4`}>
      <div className="text-[18px] font-medium leading-tight tracking-tight text-white">
        {data.names[i]}
      </div>
      <div className="mt-0.5 text-[12px] text-white/55">
        {data.capital[i] ? `${country}, başkent` : country}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="text-[24px] font-light leading-none tracking-tight tabular-nums text-white">
          {pop > 0 ? formatPop(pop) : "Veri yok"}
        </div>
        {pop >= RANK_FLOOR && (
          <div className="text-[12px] tabular-nums text-white/55">Dünyada {rank}.</div>
        )}
      </div>
      <Sparkline data={data} i={i} year={year} />
      {note && <p className="mt-2 text-[12px] leading-snug text-white/60">{note}</p>}
    </div>
  );
}

// Sehrin 1975-2050 egrisi. Taban sifirda; tahmin yilindan sonrasi kesikli,
// zaman cubugundaki ayrimla ayni dil.
function Sparkline({ data, i, year }) {
  const W = CARD_W - 32;
  const H = 40;
  const pad = 3;
  const off = i * data.stride;
  const pts = [];
  let max = 0;
  data.years.forEach((y, s) => {
    const v = data.pops[off + s];
    if (v > 0) {
      pts.push([y, v]);
      if (v > max) max = v;
    }
  });
  if (pts.length < 2 || max <= 0) return null;
  const x = (y) => ((y - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * W;
  const yy = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = (list) => list.map(([a, b]) => `${x(a).toFixed(1)},${yy(b).toFixed(1)}`).join(" ");
  const past = pts.filter(([y]) => y <= ESTIMATE_YEAR);
  const future = pts.filter(([y]) => y >= ESTIMATE_YEAR);
  const now = popAt(data, i, year);
  return (
    <div className="mt-3">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block overflow-visible">
        <line x1="0" x2={W} y1={H - pad} y2={H - pad} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {past.length > 1 && (
          <polyline points={line(past)} fill="none" stroke={SODIUM} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {future.length > 1 && (
          <polyline points={line(future)} fill="none" stroke={SODIUM} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 3" strokeLinejoin="round" />
        )}
        {now > 0 && (
          <circle cx={x(year)} cy={yy(now)} r="4" fill="#ffe9c8" stroke="rgba(0,0,0,0.7)" strokeWidth="2" />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/40">
        <span>{pts[0][0]}</span>
        <span>{LAST_YEAR}</span>
      </div>
    </div>
  );
}

function TopList({ data, ranking, selected, onHover, onPick }) {
  const listRef = useRef(null);
  const prevTops = useRef(new Map());

  // Siralama degisince yer degistiren satirlar eski yerinden kayarak gelsin
  // (FLIP). Oynatma sirasinda sehirlerin birbirini gecisi buradan okunuyor.
  useLayoutEffect(() => {
    const ol = listRef.current;
    if (!ol) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map();
    const first = prevTops.current.size === 0;
    for (const li of ol.children) {
      const key = li.dataset.key;
      const top = li.offsetTop;
      next.set(key, top);
      if (still || first) continue;
      const was = prevTops.current.get(key);
      if (was === undefined) {
        li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
      } else if (was !== top) {
        li.animate(
          [{ transform: `translateY(${was - top}px)` }, { transform: "translateY(0)" }],
          { duration: 380, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
        );
      }
    }
    prevTops.current = next;
  }, [ranking]);

  const max = ranking.vals[ranking.top[0]] || 1;

  return (
    <div
      data-chrome
      className={`${GLASS} fixed right-5 top-[76px] z-30 hidden p-3 lg:block`}
      style={{ width: LIST_W }}
    >
      <h2 className="px-1 text-[12px] text-white/55">En kalabalık şehirler</h2>
      <ol ref={listRef} className="mt-1.5">
        {ranking.top.map((i, r) => {
          const isSel = selected === i;
          return (
            <li key={i} data-key={i}>
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => onPick(i)}
                onPointerEnter={() => onHover(i)}
                onPointerLeave={() => onHover(-1)}
                // Fareyle tiklayinca odak dugmede kaliyor; odakla vurgu yalniz
                // klavyede, yoksa kart imlec gittikten sonra da asili kaliyordu.
                onFocus={(e) => {
                  if (e.currentTarget.matches(":focus-visible")) onHover(i);
                }}
                onBlur={() => onHover(-1)}
                className={`group relative flex w-full items-baseline gap-2.5 rounded px-1 pt-1.5 pb-2 text-left transition-colors ${
                  isSel ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-white/40">
                  {r + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {data.names[i]}
                  <span className="ml-1.5 text-[11px] text-white/40">
                    {countryName(data.countries[i])}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/70">
                  {formatPop(ranking.vals[i])}
                </span>
                {/* Cubuk birinciye gore orantili, sifirdan basliyor. */}
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0.5 left-[30px] right-1 h-px origin-left transition-[background-color,transform] duration-300 ${
                    isSel ? "bg-[#f39a3d]" : "bg-[#f39a3d]/45 group-hover:bg-[#f39a3d]"
                  }`}
                  style={{ transform: `scaleX(${ranking.vals[i] / max})` }}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Basparmagin merkezi araligin iki ucundan THUMB/2 iceride; cubuk ve
// etiketler ayni hesapla hizalaniyor.
const at = (p) => `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${p})`;

function Timeline({ data, year, playing, onYear, onTogglePlay }) {
  const span = LAST_YEAR - FIRST_YEAR;
  const p = (year - FIRST_YEAR) / span;
  const est = (ESTIMATE_YEAR - FIRST_YEAR) / span;
  const verb = year < ESTIMATE_YEAR ? "yaşıyordu" : year === ESTIMATE_YEAR ? "yaşıyor" : "yaşayacak";
  const dashed = (color) => `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`;

  return (
    <div data-chrome className={`${GLASS} w-full p-3.5 pointer-events-auto md:w-[300px] md:p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[36px] font-light leading-none tracking-tight tabular-nums text-white md:text-[44px]">
          {year}
        </div>
        {year > ESTIMATE_YEAR && (
          <span className="rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-white/60">
            Projeksiyon
          </span>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-white/60">
        Dünyada {formatCount(cityCountAt(data, year))} şehirde {formatBillions(totalAt(data, year))}{" "}
        kişi {verb}.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          {playing ? (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <rect x="0" y="0" width="3" height="12" rx="1" fill="currentColor" />
              <rect x="7" y="0" width="3" height="12" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <path d="M1 1.2v9.6a.7.7 0 0 0 1.06.6l7.6-4.8a.7.7 0 0 0 0-1.2L2.06.6A.7.7 0 0 0 1 1.2Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="relative h-6">
            <div className="absolute top-1/2 h-px bg-white/25" style={{ left: at(0), width: `calc((100% - ${THUMB}px) * ${est})` }} />
            <div
              className="absolute top-1/2 h-px"
              style={{ left: at(est), right: THUMB / 2, backgroundImage: dashed("rgba(255,255,255,0.3)") }}
            />
            <div
              className="absolute top-1/2 -mt-px h-[2px] rounded-full"
              style={{ left: at(0), width: `calc((100% - ${THUMB}px) * ${Math.min(p, est)})`, background: SODIUM }}
            />
            {p > est && (
              <div
                className="absolute top-1/2 -mt-px h-[2px]"
                style={{ left: at(est), width: `calc((100% - ${THUMB}px) * ${p - est})`, backgroundImage: dashed(SODIUM) }}
              />
            )}
            <input
              type="range"
              min={FIRST_YEAR}
              max={LAST_YEAR}
              step={1}
              value={year}
              onChange={(e) => onYear(Number(e.target.value))}
              aria-label="Yıl"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#ffe9c8] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(243,154,61,0.3)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ffe9c8] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(243,154,61,0.3)]"
            />
          </div>
          <div className="relative mt-0.5 h-3 text-[10px] tabular-nums text-white/40">
            <span className="absolute -translate-x-1/2" style={{ left: at(0) }}>
              {FIRST_YEAR}
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: at(est) }}>
              {ESTIMATE_YEAR}
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: at(1) }}>
              {LAST_YEAR}
            </span>
          </div>
        </div>
      </div>

      <a
        href="https://population.un.org/wup/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-[11px] text-white/40 transition hover:text-white/75"
      >
        Veri: BM, World Urbanization Prospects 2025
      </a>
    </div>
  );
}
