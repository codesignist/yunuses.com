"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import useLabKeys from "lib/useLabKeys";
import LabOptionBar from "components/molecules/LabOptionBar";
import {
  ESTIMATE_YEAR,
  FIRST_YEAR,
  LAST_YEAR,
  RANK_FLOOR,
  countryName,
  formatPop,
  loadGlobeData,
  popAt,
} from "./data";
import { createGlobeScene } from "./scene";
import CityPanel from "./CityPanel";
import RankingDialog from "./RankingDialog";
import Search from "./Search";
import Timeline from "./Timeline";
import TopList from "./TopList";
import { GLASS } from "./ui";

const VIEWS = { globe: "Küre", map: "Harita" };
const VIEW_IDS = Object.keys(VIEWS);
const VIEW_OPTIONS = VIEW_IDS.map((id) => ({ id, label: VIEWS[id] }));
const YEARS_PER_SECOND = 6;
const TOP_N = 10;
const TIP_W = 220;
// Sagdaki sutun lg ve ustunde gorunuyor: genislik + kenar boslugu + ara.
const LIST_W = 272;
const LIST_SAFE = LIST_W + 20 + 16;
const LIST_QUERY = "(min-width: 1024px)";
// Bunun altinda alt panel tam genislik, ustte de arama kutusu var.
const WIDE_QUERY = "(min-width: 768px)";
const SEARCH_BAR = 56;

function useMedia(query) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export default function Globe() {
  const containerRef = useRef(null);
  const tipRef = useRef(null);
  const centroidRef = useRef(null);
  const dockRef = useRef(null);
  const searchRef = useRef(null);
  const sceneRef = useRef(null);
  const tipIndexRef = useRef(-1);
  const pickRef = useRef(() => {});
  const yearRef = useRef(ESTIMATE_YEAR);
  const playingRef = useRef(false);
  // Oynatmanin duracagi yil: acilistaki gosterim bugunde, dugmeyle baslatilan
  // oynatma 2050'de duruyor.
  const stopAtRef = useRef(LAST_YEAR);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [view, setView] = useState("globe");
  const [year, setYear] = useState(ESTIMATE_YEAR);
  const [playing, setPlaying] = useState(false);
  const [pickHover, setPickHover] = useState(-1);
  const [listHover, setListHover] = useState(-1);
  const [selected, setSelected] = useState(-1);
  const [compare, setCompare] = useState(-1);
  const [comparing, setComparing] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const wide = useMedia(WIDE_QUERY);

  useLabKeys(VIEW_IDS, setView);

  useEffect(() => {
    const ctrl = new AbortController();
    loadGlobeData(ctrl.signal)
      .then((d) => {
        // Acilista 1975'ten bugune oynuyor: loş bir Dunya, yillar akarken
        // Guney Asya ve Afrika yaniyor. Hareketi azalt tercihinde dogrudan bugun.
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          yearRef.current = FIRST_YEAR;
          stopAtRef.current = ESTIMATE_YEAR;
          setYear(FIRST_YEAR);
          setPlaying(true);
        }
        setData(d);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus("error");
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!data) return;

    // Uzerine gelinen sehrin karti ve agirlik merkezi etiketi sahnedeki
    // noktalara yapisik; konumlari her karede sahneden geliyor, React'e
    // ugramadan dogrudan stile yaziliyor.
    function placeOverlays() {
      const s = sceneRef.current;
      if (!s) return;
      const { width, height } = s.size();

      const tip = tipRef.current;
      if (tip) {
        const a = tipIndexRef.current >= 0 ? s.anchor(tipIndexRef.current) : null;
        if (!a || !a.ok) {
          if (tip.style.opacity !== "0") tip.style.opacity = "0";
        } else {
          const w = tip.offsetWidth;
          const h = tip.offsetHeight;
          // Liste gorunurken kart onun altina girmesin.
          const right = width >= 1024 ? width - LIST_SAFE : width - 16;
          let x = a.x + a.r + 14;
          let y = a.y - a.r - h - 6;
          if (x + w > right) x = a.x - a.r - w - 14;
          if (y < 64) y = a.y + a.r + 10;
          x = Math.min(Math.max(16, x), right - w);
          y = Math.min(Math.max(16, y), height - h - 16);
          tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
          if (tip.style.opacity !== "1") tip.style.opacity = "1";
        }
      }

      const label = centroidRef.current;
      if (label) {
        const a = s.anchorCentroid();
        if (!a.ok) {
          if (label.style.opacity !== "0") label.style.opacity = "0";
        } else {
          // Sag kenara sigmiyorsa halkanin soluna.
          const w = label.offsetWidth;
          const x = a.x + 13 + w > width - 8 ? a.x - 13 - w : a.x + 13;
          label.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(a.y - 8)}px, 0)`;
          if (label.style.opacity !== "1") label.style.opacity = "1";
        }
      }
    }

    const s = createGlobeScene(containerRef.current, data, {
      hover: setPickHover,
      select: (i) => pickRef.current(i, false),
      frame: placeOverlays,
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
  // sutun; dar ekranda ustteki arama ve alttaki panel.
  useEffect(() => {
    const s = sceneRef.current;
    const dock = dockRef.current;
    if (status !== "ready" || !s || !dock) return;
    const listQuery = window.matchMedia(LIST_QUERY);
    const wideQuery = window.matchMedia(WIDE_QUERY);
    const sync = () => {
      const narrow = !wideQuery.matches;
      s.setSafeArea(
        listQuery.matches ? LIST_SAFE : 0,
        narrow ? dock.offsetHeight + 24 : 0,
        narrow ? SEARCH_BAR : 0,
      );
    };
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
  // Secili ve karsilastirilan sehrin bilgisi panelde; kucuk kart yalniz
  // digerleri icin.
  const tipIndex = hover >= 0 && hover !== selected && hover !== compare ? hover : -1;

  useEffect(() => {
    tipIndexRef.current = tipIndex;
  }, [tipIndex]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    sceneRef.current?.setHighlight(hover, selected, compare);
  }, [hover, selected, compare, status]);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view, status]);

  useEffect(() => {
    yearRef.current = year;
    if (!playing) sceneRef.current?.setYear(year);
  }, [year, playing, status]);

  // Oynatma: isiklar kesirli yillarla akiyor, arayuz tam yillarda yenileniyor.
  useEffect(() => {
    if (!playing || status !== "ready") return;
    let raf = 0;
    let prev = 0;
    let y = yearRef.current;
    const stopAt = stopAtRef.current;
    function tick(t) {
      const dt = prev ? Math.min(0.1, (t - prev) / 1000) : 0;
      prev = t;
      y = Math.min(stopAt, y + dt * YEARS_PER_SECOND);
      sceneRef.current?.setYear(y);
      const whole = Math.floor(y);
      if (whole !== yearRef.current) {
        yearRef.current = whole;
        setYear(whole);
      }
      if (y >= stopAt) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, status]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      setPlaying(false);
      return;
    }
    stopAtRef.current = LAST_YEAR;
    if (yearRef.current >= LAST_YEAR) {
      yearRef.current = FIRST_YEAR;
      setYear(FIRST_YEAR);
    }
    setPlaying(true);
  }, []);

  const changeYear = useCallback((y) => {
    setPlaying(false);
    setYear(y);
  }, []);

  // Kureden, listeden, aramadan ve tablodan gelen secimlerin tek yolu.
  // Karsilastirma modunda secilen sehir ikinci seri oluyor.
  const handlePick = (i, fly) => {
    if (comparing) {
      if (i >= 0 && i !== selected) setCompare(i);
      setComparing(false);
      return;
    }
    setSelected(i);
    setCompare(-1);
    if (i >= 0 && fly) sceneRef.current?.flyTo(i);
  };
  useEffect(() => {
    pickRef.current = handlePick;
  });

  const closePanel = useCallback(() => {
    setSelected(-1);
    setCompare(-1);
    setComparing(false);
  }, []);

  const startCompare = useCallback(() => {
    setComparing(true);
    searchRef.current?.focus();
  }, []);

  const openRanking = useCallback(() => {
    setPlaying(false);
    setRankingOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        if (comparing) setComparing(false);
        else closePanel();
        return;
      }
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName))) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "/" && !document.documentElement.hasAttribute("data-chrome-hidden")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, closePanel, comparing]);

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
    return { vals, rank, order, top: order.slice(0, TOP_N) };
  }, [data, year]);

  return (
    <div className="absolute inset-0 bg-black">
      {/* Tuvali three kendisi ekliyor; ad kapsayicida. */}
      <div
        ref={containerRef}
        role="img"
        aria-label="Dünya şehirlerinin nüfusunu ışık lekeleriyle gösteren küre"
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
            ref={centroidRef}
            data-chrome
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap text-[11px] text-[#dfe9ff]/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
            style={{ opacity: 0 }}
          >
            Şehirlilerin ağırlık merkezi
          </div>

          <div
            ref={tipRef}
            data-chrome
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20"
            style={{ opacity: 0, width: TIP_W }}
          >
            {tipIndex >= 0 && (
              <Tooltip data={data} i={tipIndex} year={year} rank={ranking.rank[tipIndex]} />
            )}
          </div>

          <div className="fixed left-[96px] right-16 top-4 z-40 flex flex-col gap-2 lg:left-auto lg:right-5 lg:top-[76px] lg:w-[272px]">
            <div data-chrome>
              <Search
                ref={searchRef}
                data={data}
                year={year}
                comparing={comparing}
                onPick={(i) => handlePick(i, true)}
                onCancelCompare={() => setComparing(false)}
              />
            </div>
            <div className="hidden lg:block">
              <TopList
                data={data}
                ranking={ranking}
                selected={selected}
                onHover={setListHover}
                onPick={(i) => handlePick(i, true)}
                onShowAll={openRanking}
              />
            </div>
          </div>

          {selected >= 0 && (
            <div
              data-chrome
              className="fixed inset-x-4 top-[68px] z-30 max-h-[52vh] overflow-y-auto rounded-lg md:inset-x-auto md:left-4 md:top-[76px] md:max-h-[calc(100vh-260px)] md:w-[300px]"
            >
              <CityPanel
                compact={!wide}
                data={data}
                i={selected}
                year={year}
                rank={ranking.rank[selected]}
                compare={compare}
                compareRank={compare >= 0 ? ranking.rank[compare] : 0}
                comparing={comparing}
                onClose={closePanel}
                onStartCompare={startCompare}
                onClearCompare={() => setCompare(-1)}
              />
            </div>
          )}

          <div
            ref={dockRef}
            className="fixed inset-x-4 bottom-4 z-30 flex flex-col-reverse gap-3 pointer-events-none md:flex-row md:items-end md:justify-between"
          >
            <div className="flex flex-col items-start gap-2 pointer-events-auto">
              <div data-chrome className="px-1 text-[12px] text-white/60 pointer-events-none">
                <span className="pointer-coarse:hidden">
                  {view === "globe" ? "Sürükleyerek döndür" : "Sürükleyerek kaydır"}, tekerlekle
                  yakınlaş, bir şehre tıkla.
                </span>
                <span className="hidden pointer-coarse:inline">
                  {view === "globe" ? "Sürükleyerek döndür" : "Sürükleyerek kaydır"}, iki parmakla
                  yakınlaş, bir şehre dokun.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <LabOptionBar options={VIEW_OPTIONS} active={view} onSelect={setView} />
                <button
                  type="button"
                  data-chrome
                  onClick={openRanking}
                  className="h-[34px] rounded border border-white/10 bg-white/5 px-3 text-[12px] text-white/70 backdrop-blur-sm transition hover:bg-white/10 hover:text-white lg:hidden"
                >
                  Sıralama
                </button>
              </div>
            </div>

            <Timeline
              data={data}
              year={year}
              playing={playing}
              onYear={changeYear}
              onTogglePlay={togglePlay}
            />
          </div>

          <RankingDialog
            open={rankingOpen}
            data={data}
            ranking={ranking}
            year={year}
            onClose={() => setRankingOpen(false)}
            onPick={(i) => {
              setRankingOpen(false);
              handlePick(i, true);
            }}
          />
        </>
      )}
    </div>
  );
}

function Tooltip({ data, i, year, rank }) {
  const pop = popAt(data, i, year);
  return (
    <div className={`${GLASS} bg-black/70 px-3 py-2.5`}>
      <div className="truncate text-[15px] font-medium leading-tight text-white">{data.names[i]}</div>
      <div className="mt-0.5 text-[11px] text-white/50">{countryName(data.countries[i])}</div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-light leading-none tabular-nums text-white">
          {pop > 0 ? formatPop(pop) : "Veri yok"}
        </span>
        {pop >= RANK_FLOOR && (
          <span className="text-[11px] tabular-nums text-white/50">Dünyada {rank}.</span>
        )}
      </div>
    </div>
  );
}
