"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import data from "./data.json";

const W = 2160;
const H = 3120;

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = data.bbox;

const lonToX = (lon) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
const latToY = (lat) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;

function buildColormap() {
  // Slime izi: koyu bordo → kızıl → mercan → soluk pembe. Su (navy) ve
  // bina (gri) ile yüksek kontrast olsun diye sıcak palet seçildi.
  const stops = [
    [0, [8, 10, 14]],
    [55, [55, 14, 20]],
    [125, [170, 38, 50]],
    [185, [235, 90, 95]],
    [225, [248, 170, 160]],
    [255, [252, 232, 220]],
  ];
  const map = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    let s0 = stops[0];
    let s1 = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (i >= stops[j][0] && i <= stops[j + 1][0]) {
        s0 = stops[j];
        s1 = stops[j + 1];
        break;
      }
    }
    const span = s1[0] - s0[0] || 1;
    const k = (i - s0[0]) / span;
    map[i * 3] = s0[1][0] + k * (s1[1][0] - s0[1][0]);
    map[i * 3 + 1] = s0[1][1] + k * (s1[1][1] - s0[1][1]);
    map[i * 3 + 2] = s0[1][2] + k * (s1[1][2] - s0[1][2]);
  }
  return map;
}

const COLORMAP = buildColormap();

// Base map paleti — şehrin dokusu okunabilir olsun diye binalar net gri,
// su saturated navy, kara koyu. Slime izi (kızıl colormap) bunların
// üstüne organik akış olarak biniyor.
const COLOR_LAND = [8, 10, 14];
const COLOR_BUILDING_FILL = [34, 41, 54];
const COLOR_BUILDING_EDGE = [62, 74, 92];
const COLOR_WATER = [22, 56, 96];
const COLOR_WATER_EDGE = [40, 92, 140];

function buildLayers() {
  const bldgCanvas = document.createElement("canvas");
  bldgCanvas.width = W;
  bldgCanvas.height = H;
  const bc = bldgCanvas.getContext("2d", { willReadFrequently: true });
  bc.fillStyle = "#fff";
  for (const poly of data.buildings) {
    if (poly.length < 6) continue;
    bc.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const x = lonToX(poly[i]);
      const y = latToY(poly[i + 1]);
      if (i === 0) bc.moveTo(x, y);
      else bc.lineTo(x, y);
    }
    bc.closePath();
    bc.fill();
  }
  const bldgImg = bc.getImageData(0, 0, W, H);
  const buildingMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (bldgImg.data[i * 4 + 3] > 0) buildingMask[i] = 1;
  }

  const waterCanvas = document.createElement("canvas");
  waterCanvas.width = W;
  waterCanvas.height = H;
  const wc = waterCanvas.getContext("2d", { willReadFrequently: true });
  wc.fillStyle = "#fff";
  for (const poly of data.waterPolys) {
    wc.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const [lon, lat] = poly[i];
      const x = lonToX(lon);
      const y = latToY(lat);
      if (i === 0) wc.moveTo(x, y);
      else wc.lineTo(x, y);
    }
    wc.closePath();
    wc.fill();
  }
  wc.strokeStyle = "#fff";
  wc.lineWidth = 7;
  wc.lineCap = "round";
  wc.lineJoin = "round";
  for (const line of data.waterLines) {
    wc.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [lon, lat] = line[i];
      const x = lonToX(lon);
      const y = latToY(lat);
      if (i === 0) wc.moveTo(x, y);
      else wc.lineTo(x, y);
    }
    wc.stroke();
  }
  const waterImg = wc.getImageData(0, 0, W, H);
  const waterMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (waterImg.data[i * 4 + 3] > 0) waterMask[i] = 1;
  }

  const obstacleMask = new Uint8Array(W * H);
  const walkableTmp = [];
  for (let i = 0; i < W * H; i++) {
    const blocked = waterMask[i] || buildingMask[i];
    obstacleMask[i] = blocked ? 1 : 0;
    if (!blocked) walkableTmp.push(i);
  }
  const walkable = new Int32Array(walkableTmp);

  // Besin kaynakları — mahalle merkezleri (Tokyo metro tarzı). Her mahalle
  // bir gauss spot; ajanlar mahalleler arasında bağlantı kurmaya çalışırken
  // bina blokları engel olduğu için doğal olarak sokak hatlarına oturur.
  const foodCanvas = document.createElement("canvas");
  foodCanvas.width = W;
  foodCanvas.height = H;
  const fdc = foodCanvas.getContext("2d", { willReadFrequently: true });
  fdc.fillStyle = "#fff";
  for (const s of data.settlements) {
    const x = lonToX(s.lon);
    const y = latToY(s.lat);
    const r = 26 + (s.w ?? 1) * 6;
    fdc.beginPath();
    fdc.arc(x, y, r, 0, Math.PI * 2);
    fdc.fill();
  }
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = W;
  blurCanvas.height = H;
  const fbc = blurCanvas.getContext("2d", { willReadFrequently: true });
  fbc.filter = "blur(140px)";
  fbc.drawImage(foodCanvas, 0, 0);
  fbc.filter = "none";
  const fImg = fbc.getImageData(0, 0, W, H);
  const foodMap = new Float32Array(W * H);
  let maxF = 0;
  for (let i = 0; i < W * H; i++) {
    const v = fImg.data[i * 4 + 3];
    foodMap[i] = v;
    if (v > maxF) maxF = v;
  }
  if (maxF > 0) {
    const inv = 1 / maxF;
    for (let i = 0; i < W * H; i++) foodMap[i] *= inv;
  }

  // Visual base — bina ve sular ayrı bir canvas'ta gerçek dolgu + ince
  // outline ile çiziliyor. Anti-aliased kenarlar şehir dokusunu okunabilir
  // hale getiriyor; per-pixel branching yerine canvas'ın kendi rendering'i
  // kullanılıyor.
  const visual = document.createElement("canvas");
  visual.width = W;
  visual.height = H;
  const vc = visual.getContext("2d", { willReadFrequently: true });

  const rgbStr = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

  vc.fillStyle = rgbStr(COLOR_LAND);
  vc.fillRect(0, 0, W, H);

  // Su — polylar + dereler. Önce dolgu, sonra ince kenar (kıyıyı belirgin yap).
  vc.fillStyle = rgbStr(COLOR_WATER);
  for (const poly of data.waterPolys) {
    vc.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const [lon, lat] = poly[i];
      const x = lonToX(lon);
      const y = latToY(lat);
      if (i === 0) vc.moveTo(x, y);
      else vc.lineTo(x, y);
    }
    vc.closePath();
    vc.fill();
  }
  vc.strokeStyle = rgbStr(COLOR_WATER);
  vc.lineWidth = 7;
  vc.lineCap = "round";
  vc.lineJoin = "round";
  for (const line of data.waterLines) {
    vc.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [lon, lat] = line[i];
      const x = lonToX(lon);
      const y = latToY(lat);
      if (i === 0) vc.moveTo(x, y);
      else vc.lineTo(x, y);
    }
    vc.stroke();
  }
  // Su şeritlerine + polylara ince parlak kenar — kıyı çizgisi okunsun.
  vc.strokeStyle = rgbStr(COLOR_WATER_EDGE);
  vc.lineWidth = 1.2;
  for (const poly of data.waterPolys) {
    vc.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const [lon, lat] = poly[i];
      const x = lonToX(lon);
      const y = latToY(lat);
      if (i === 0) vc.moveTo(x, y);
      else vc.lineTo(x, y);
    }
    vc.closePath();
    vc.stroke();
  }

  // Yollar — düşük hiyerarşiden yükseğe çiziliyor (büyük caddeler en üstte).
  // Track (orman/tarla yolu) atlandı; service/residential/major çizilir.
  const drawRoadGroup = (group, stroke, width) => {
    vc.strokeStyle = stroke;
    vc.lineWidth = width;
    vc.lineCap = "round";
    vc.lineJoin = "round";
    for (const line of group) {
      if (!line || line.length < 2) continue;
      vc.beginPath();
      for (let i = 0; i < line.length; i++) {
        const [lon, lat] = line[i];
        const x = lonToX(lon);
        const y = latToY(lat);
        if (i === 0) vc.moveTo(x, y);
        else vc.lineTo(x, y);
      }
      vc.stroke();
    }
  };
  if (data.roads) {
    drawRoadGroup(data.roads.service ?? [], "rgb(38, 46, 60)", 1.2);
    drawRoadGroup(data.roads.residential ?? [], "rgb(80, 92, 112)", 2.4);
    drawRoadGroup(data.roads.major ?? [], "rgb(168, 152, 110)", 4);
  }

  // Binalar — orta gri dolgu + 1.2px açık kenar. Anti-aliased outline
  // sayesinde her bina ayrı bir blok olarak okunuyor. Yolların üstüne çiziliyor
  // çünkü gerçek şehirde caddenin kenarına oturmuşlar.
  vc.fillStyle = rgbStr(COLOR_BUILDING_FILL);
  vc.strokeStyle = rgbStr(COLOR_BUILDING_EDGE);
  vc.lineWidth = 1.2;
  vc.lineJoin = "miter";
  for (const poly of data.buildings) {
    if (poly.length < 6) continue;
    vc.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const x = lonToX(poly[i]);
      const y = latToY(poly[i + 1]);
      if (i === 0) vc.moveTo(x, y);
      else vc.lineTo(x, y);
    }
    vc.closePath();
    vc.fill();
    vc.stroke();
  }

  const visualImg = vc.getImageData(0, 0, W, H);
  const basePixels = new Uint8ClampedArray(visualImg.data);

  return { obstacleMask, foodMap, walkable, basePixels };
}

const DEFAULT_AGENTS = 8000;
const AGENTS_MIN = 1500;
const AGENTS_MAX = 30000;
const AGENTS_STEP = 500;

const ZOOM_MIN_FACTOR = 0.95;
const ZOOM_MAX_FACTOR = 12;
const ZOOM_WHEEL_STEP = 1.18;

export default function Camur() {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const viewRef = useRef({ scale: 1, x: 0, y: 0, fitScale: 1 });
  const [zoomedOut, setZoomedOut] = useState(true);

  const [resetKey, setResetKey] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const showLabelsRef = useRef(true);
  const [agentCount, setAgentCount] = useState(DEFAULT_AGENTS);
  const [draftAgents, setDraftAgents] = useState(DEFAULT_AGENTS);

  // Etiketleri container koordinat uzayında, sabit 16px font ile çiziyoruz —
  // stage transform'undan etkilenmesin, zoom yapılsa da yazı büyümesin.
  // Mahalle lat/lon → internal canvas → screen via current view transform.
  const drawLabels = useCallback(() => {
    const c = containerRef.current;
    const overlay = overlayRef.current;
    if (!c || !overlay) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = rect.width;
    const ch = rect.height;
    const targetW = Math.round(cw * dpr);
    const targetH = Math.round(ch * dpr);
    if (overlay.width !== targetW || overlay.height !== targetH) {
      overlay.width = targetW;
      overlay.height = targetH;
      overlay.style.width = `${cw}px`;
      overlay.style.height = `${ch}px`;
    }
    const ctx = overlay.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!showLabelsRef.current) return;

    const v = viewRef.current;
    const project = (s) => {
      const ix = lonToX(s.lon);
      const iy = latToY(s.lat);
      return { x: ix * v.scale + v.x, y: iy * v.scale + v.y };
    };
    const onScreen = (p) => p.x > -120 && p.x < cw + 220 && p.y > -40 && p.y < ch + 40;

    ctx.strokeStyle = "rgba(255, 180, 90, 0.32)";
    ctx.lineWidth = 1.5;
    for (const s of data.settlements) {
      const p = project(s);
      if (!onScreen(p)) continue;
      const r = 2.2 + s.w * 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 195, 110, 0.92)";
    for (const s of data.settlements) {
      const p = project(s);
      if (!onScreen(p)) continue;
      const r = 2.2 + s.w * 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
    for (const s of data.settlements) {
      const p = project(s);
      if (!onScreen(p)) continue;
      ctx.strokeText(s.name, p.x + 8, p.y);
    }
    ctx.fillStyle = "rgba(255, 218, 165, 0.95)";
    for (const s of data.settlements) {
      const p = project(s);
      if (!onScreen(p)) continue;
      ctx.fillText(s.name, p.x + 8, p.y);
    }
  }, []);

  const applyTransform = useCallback(() => {
    const v = viewRef.current;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
    }
    drawLabels();
  }, [drawLabels]);

  const fitView = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const fitS = Math.min(rect.width / W, rect.height / H);
    viewRef.current = {
      scale: fitS,
      fitScale: fitS,
      x: (rect.width - W * fitS) / 2,
      y: (rect.height - H * fitS) / 2,
    };
    applyTransform();
    setZoomedOut(true);
  }, [applyTransform]);

  // Fit to viewport — initial + on resize
  useEffect(() => {
    fitView();
    const onResize = () => fitView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitView]);

  // Wheel zoom + drag pan + pinch zoom
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = viewRef.current;
      const minS = v.fitScale * ZOOM_MIN_FACTOR;
      const maxS = v.fitScale * ZOOM_MAX_FACTOR;
      const factor = e.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP;
      const newScale = Math.max(minS, Math.min(maxS, v.scale * factor));
      const ratio = newScale / v.scale;
      viewRef.current = {
        ...v,
        scale: newScale,
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
      };
      applyTransform();
      setZoomedOut(Math.abs(newScale - v.fitScale) / v.fitScale < 0.05);
    };

    // Pan + pinch: track active pointers in a Map.
    const pointers = new Map();
    let pinchPrevDist = 0;
    let pinchPrevMid = null;

    const midpoint = () => {
      const it = pointers.values();
      const a = it.next().value;
      const b = it.next().value;
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        d: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        c.setPointerCapture(e.pointerId);
      } catch {}
      if (pointers.size === 2) {
        const m = midpoint();
        pinchPrevDist = m.d;
        pinchPrevMid = { x: m.x, y: m.y };
      }
      c.style.cursor = "grabbing";
    };

    const onMove = (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const next = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, next);

      if (pointers.size === 1) {
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const v = viewRef.current;
        viewRef.current = { ...v, x: v.x + dx, y: v.y + dy };
        applyTransform();
      } else if (pointers.size === 2) {
        const m = midpoint();
        const v = viewRef.current;
        const minS = v.fitScale * ZOOM_MIN_FACTOR;
        const maxS = v.fitScale * ZOOM_MAX_FACTOR;
        const rect = c.getBoundingClientRect();
        const cx = m.x - rect.left;
        const cy = m.y - rect.top;
        const factor = pinchPrevDist > 0 ? m.d / pinchPrevDist : 1;
        const newScale = Math.max(minS, Math.min(maxS, v.scale * factor));
        const ratio = newScale / v.scale;
        const tx = cx - (cx - v.x) * ratio + (m.x - pinchPrevMid.x);
        const ty = cy - (cy - v.y) * ratio + (m.y - pinchPrevMid.y);
        viewRef.current = { ...v, scale: newScale, x: tx, y: ty };
        applyTransform();
        pinchPrevDist = m.d;
        pinchPrevMid = { x: m.x, y: m.y };
        setZoomedOut(Math.abs(newScale - v.fitScale) / v.fitScale < 0.05);
      }
    };

    const onUp = (e) => {
      pointers.delete(e.pointerId);
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {}
      if (pointers.size < 2) {
        pinchPrevDist = 0;
        pinchPrevMid = null;
      }
      if (pointers.size === 0) c.style.cursor = "grab";
    };

    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.style.cursor = "grab";

    return () => {
      c.removeEventListener("wheel", onWheel);
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, [applyTransform]);

  const zoomBy = useCallback(
    (factor) => {
      const c = containerRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const mx = rect.width / 2;
      const my = rect.height / 2;
      const v = viewRef.current;
      const minS = v.fitScale * ZOOM_MIN_FACTOR;
      const maxS = v.fitScale * ZOOM_MAX_FACTOR;
      const newScale = Math.max(minS, Math.min(maxS, v.scale * factor));
      const ratio = newScale / v.scale;
      viewRef.current = {
        ...v,
        scale: newScale,
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
      };
      applyTransform();
      setZoomedOut(Math.abs(newScale - v.fitScale) / v.fitScale < 0.05);
    },
    [applyTransform]
  );

  // Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });

    const N_AGENTS = agentCount;

    const SENSOR_DIST = 13;
    const SENSOR_ANGLE = Math.PI / 4;
    const TURN_SPEED = 0.45;
    const STEP = 1.4;
    const DEPOSIT = 1.4;
    const DECAY = 0.962;
    const FOOD_WEIGHT = 110;
    const TRAIL_TO_BYTE = 32;

    let raf;
    let cancelled = false;

    (() => {
      const { obstacleMask, foodMap, walkable, basePixels } = buildLayers();
      if (cancelled) return;
      const NW = walkable.length;

      // Uniform seed — ajanlar walkable alana eşit dağılır, besin
      // gradyanını takip ederek mahallelere doğru çekilirler.
      const agents = new Float32Array(N_AGENTS * 3);
      let placed = 0;
      while (placed < N_AGENTS) {
        const idx = walkable[(Math.random() * NW) | 0];
        const x = (idx % W) + 0.5;
        const y = ((idx / W) | 0) + 0.5;
        agents[placed * 3] = x;
        agents[placed * 3 + 1] = y;
        agents[placed * 3 + 2] = Math.random() * Math.PI * 2;
        placed++;
      }
      let trail = new Float32Array(W * H);
      let trailH = new Float32Array(W * H);
      let trailNext = new Float32Array(W * H);
      const imgData = ctx.createImageData(W, H);
      imgData.data.set(basePixels);

      function sense(x, y) {
        const ix = x | 0;
        const iy = y | 0;
        if (ix < 0 || ix >= W || iy < 0 || iy >= H) return -1;
        const idx = iy * W + ix;
        if (obstacleMask[idx]) return -1;
        return trail[idx] + foodMap[idx] * FOOD_WEIGHT;
      }

      function tick() {
        if (cancelled) return;

        for (let i = 0; i < N_AGENTS; i++) {
          const i3 = i * 3;
          let x = agents[i3];
          let y = agents[i3 + 1];
          let a = agents[i3 + 2];

          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          const cosL = Math.cos(a - SENSOR_ANGLE);
          const sinL = Math.sin(a - SENSOR_ANGLE);
          const cosR = Math.cos(a + SENSOR_ANGLE);
          const sinR = Math.sin(a + SENSOR_ANGLE);

          const sf = sense(x + cosA * SENSOR_DIST, y + sinA * SENSOR_DIST);
          const sl = sense(x + cosL * SENSOR_DIST, y + sinL * SENSOR_DIST);
          const sr = sense(x + cosR * SENSOR_DIST, y + sinR * SENSOR_DIST);

          if (sf > sl && sf > sr) {
            // straight
          } else if (sf < sl && sf < sr) {
            a += (Math.random() - 0.5) * TURN_SPEED * 2;
          } else if (sl > sr) {
            a -= TURN_SPEED * Math.random();
          } else if (sr > sl) {
            a += TURN_SPEED * Math.random();
          }

          const nx = x + Math.cos(a) * STEP;
          const ny = y + Math.sin(a) * STEP;
          const ix = nx | 0;
          const iy = ny | 0;

          if (ix < 1 || ix >= W - 1 || iy < 1 || iy >= H - 1 || obstacleMask[iy * W + ix]) {
            a = Math.random() * Math.PI * 2;
          } else {
            x = nx;
            y = ny;
            trail[iy * W + ix] += DEPOSIT;
          }

          agents[i3] = x;
          agents[i3 + 1] = y;
          agents[i3 + 2] = a;
        }

      for (let k = 0; k < NW; k++) {
        const i = walkable[k];
        const x = i % W;
        if (x < 1 || x >= W - 1) {
          trailH[i] = trail[i];
          continue;
        }
        trailH[i] = (trail[i - 1] + trail[i] + trail[i + 1]) * 0.33333334;
      }
      for (let k = 0; k < NW; k++) {
        const i = walkable[k];
        const y = (i / W) | 0;
        if (y < 1 || y >= H - 1) {
          trailNext[i] = trailH[i] * DECAY;
          continue;
        }
        trailNext[i] = (trailH[i - W] + trailH[i] + trailH[i + W]) * 0.33333334 * DECAY;
      }
      const tmp = trail;
      trail = trailNext;
      trailNext = tmp;

      const dataArr = imgData.data;
      for (let k = 0; k < NW; k++) {
        const i = walkable[k];
        const p = i * 4;
        let v = trail[i] * TRAIL_TO_BYTE;
        if (v > 255) v = 255;
        const ci = (v | 0) * 3;
        dataArr[p] = COLORMAP[ci];
        dataArr[p + 1] = COLORMAP[ci + 1];
        dataArr[p + 2] = COLORMAP[ci + 2];
      }
      ctx.putImageData(imgData, 0, 0);

      raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [resetKey, agentCount]);

  useEffect(() => {
    showLabelsRef.current = showLabels;
    drawLabels();
  }, [showLabels, drawLabels]);

  return (
    <div className="absolute inset-0 flex flex-col items-stretch">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden touch-none select-none"
      >
        <div
          ref={stageRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block absolute inset-0 w-full h-full"
          />
        </div>
        {/* Etiket overlay'i stage dışında — zoom'dan etkilenmiyor, sabit 16px */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Zoom kontrolleri — sağ alt, kontrol çubuğunun üstünde */}
      <div className="absolute right-4 bottom-24 max-md:bottom-32 flex flex-col gap-1 pointer-events-none">
        <button
          onClick={() => zoomBy(1.5)}
          className="pointer-events-auto w-9 h-9 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-white/85 hover:bg-white/15 hover:border-white/30 transition flex items-center justify-center text-base font-light"
          aria-label="Yakınlaştır"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.5)}
          className="pointer-events-auto w-9 h-9 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-white/85 hover:bg-white/15 hover:border-white/30 transition flex items-center justify-center text-base font-light"
          aria-label="Uzaklaştır"
        >
          −
        </button>
        {!zoomedOut && (
          <button
            onClick={fitView}
            className="pointer-events-auto w-9 h-9 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-white/85 hover:bg-white/15 hover:border-white/30 transition flex items-center justify-center"
            aria-label="Sığdır"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4" />
            </svg>
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 max-md:p-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/55 backdrop-blur-md px-2 py-2 text-[12px] text-white/75 max-md:text-[11px] flex-wrap max-md:gap-1.5">
          <div className="hidden md:flex items-center gap-2 pl-3 pr-1 text-white/55">
            <span className="text-white/80">Kırklareli</span>
            <span className="text-white/25">·</span>
            <span>{data.buildings.length.toLocaleString("tr-TR")} bina</span>
          </div>
          <label className="flex items-center gap-2 px-3 text-white/65">
            <span className="text-white/55">Ajan</span>
            <input
              type="range"
              min={AGENTS_MIN}
              max={AGENTS_MAX}
              step={AGENTS_STEP}
              value={draftAgents}
              onChange={(e) => setDraftAgents(+e.target.value)}
              onPointerUp={() => setAgentCount(draftAgents)}
              onKeyUp={() => setAgentCount(draftAgents)}
              className="w-24 accent-[#87b4d7] cursor-pointer"
              aria-label="Ajan sayısı"
            />
            <span className="text-white/85 tabular-nums w-12 text-right">
              {draftAgents.toLocaleString("tr-TR")}
            </span>
          </label>
          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`px-3 py-1.5 rounded-full transition border ${
              showLabels
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/10 bg-transparent text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            Mahalle etiketleri
          </button>
          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 hover:border-white/30 text-white/85 hover:text-white transition"
          >
            Yeniden başlat
          </button>
        </div>
      </div>

      <div className="absolute top-4 right-4 max-w-[260px] text-right pointer-events-none">
        <div className="text-[12px] text-white/45 leading-[1.55]">
          OpenStreetMap'ten alınan {data.buildings.length.toLocaleString("tr-TR")} bina
          besin yoğunluğu olarak rasterize edildi. Çamur ajanları binalar
          arasındaki sokaklar boyunca ulaşım ağı çiziyor. Sürükle, kaydır,
          tekerlekle yakınlaş.
        </div>
      </div>
    </div>
  );
}
