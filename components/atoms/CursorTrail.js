"use client";

import { useEffect, useRef } from "react";

const POINTS = 70;
const ELASTIC_INNER = 0.11; // velocity'nin delta'ya yakınsama hızı — düşük = daha geç toparlanma, daha çok lag
const ELASTIC_OUTER = 0.21; // tracker'ın velocity'yi ne kadar uyguladığı — yüksek = daha çok overshoot, daha yaylı
const MAX_ALPHA = 0.55;
const MIN_WIDTH = 0.5;
const MAX_WIDTH = 1.6;
const ORBIT_PAD_RATIO = 1.6; // ellipse, linkin sınırından kaç px dışarıdan geçer
const ORBIT_SPEED = 0.2; // rad/frame — tam tur ~31 frame, 60 Hz'de ~0.5 sn
const ORBIT_JITTER = 12; // px, her frame eklenen rastgele şaşma (kalemle çizim hissi)

// Büyük tıklama alanlarında (yazı ve deney kartları) elips kartın çok dışına
// taşıyordu; orada iz, kutunun biraz dışından yuvarlak köşeli bir dikdörtgen
// çiziyor. Küçük linkler ve yuvarlak avatar elipste kalıyor.
const RECT_MIN_W = 200;
const RECT_MIN_H = 80;
const RECT_PAD = 10; // px, kutunun dışına mesafe
const RECT_RADIUS = 14;
// Tur hızı elipsteki gibi açı cinsinden: kart ne kadar büyük olursa olsun tur
// süresi aynı. Elipsten biraz yavaş; 0.12 ile tam tur ~52 frame (~0.9 sn).
const RECT_ORBIT_SPEED = 0.12; // rad/frame
// Yaylı takip köşeleri kesiyor, köşeden sonra salınıp kenarı
// dalgalandırıyordu; o yüzden iz önce yayla kenara yaklaşıyor, yola değince
// kilitlenip doğrudan yolun üzerinden gidiyor.
const RECT_LOCK_DIST = 8; // px
const RECT_LOCK_MAX_FRAMES = 24; // yaklaşma uzarsa yine de kilitlen
// Büyük kartta frame başına onlarca px yol alınıyor; adım bu değeri aşarsa
// köşeler iki nokta arasında kalıp kesilmesin diye ara noktalar ekleniyor.
const RECT_SUBSTEP = 60;
// Düz kenarda 1-2 px'lik dalga bile yamuk okunuyor; eğride kalem hissi olan
// şey burada bozukluk gibi duruyor.
const RECT_JITTER = 1;

const isLargeTarget = (rect) =>
  rect.width >= RECT_MIN_W && rect.height >= RECT_MIN_H;

function rectPathLength(rect) {
  const w = rect.width + RECT_PAD * 2;
  const h = rect.height + RECT_PAD * 2;
  const r = Math.min(RECT_RADIUS, w / 2, h / 2);
  return 2 * (w + h) - (8 - 2 * Math.PI) * r;
}

// Kutunun etrafındaki yuvarlak köşeli yolda, sol üst köşeden saat yönünde
// s px ilerideki nokta. Sonuç out'a yazılıyor, her frame nesne üretilmesin.
function rectPathPoint(rect, s, out) {
  const w = rect.width + RECT_PAD * 2;
  const h = rect.height + RECT_PAD * 2;
  const r = Math.min(RECT_RADIUS, w / 2, h / 2);
  const left = rect.left - RECT_PAD;
  const top = rect.top - RECT_PAD;
  const ew = w - 2 * r;
  const eh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const per = 2 * (ew + eh) + 4 * arc;
  let d = ((s % per) + per) % per;

  const corner = (cx, cy, a0) => {
    const a = a0 + d / r;
    out.x = cx + r * Math.cos(a);
    out.y = cy + r * Math.sin(a);
    return out;
  };

  if (d < ew) { out.x = left + r + d; out.y = top; return out; }
  d -= ew;
  if (d < arc) return corner(left + w - r, top + r, -Math.PI / 2);
  d -= arc;
  if (d < eh) { out.x = left + w; out.y = top + r + d; return out; }
  d -= eh;
  if (d < arc) return corner(left + w - r, top + h - r, 0);
  d -= arc;
  if (d < ew) { out.x = left + w - r - d; out.y = top + h; return out; }
  d -= ew;
  if (d < arc) return corner(left + r, top + h - r, Math.PI / 2);
  d -= arc;
  if (d < eh) { out.x = left; out.y = top + h - r - d; return out; }
  d -= eh;
  return corner(left + r, top + r, Math.PI);
}

// İmlece en yakın yol noktası: yörünge imlecin girdiği yerden başlasın.
function nearestRectPathPos(rect, x, y) {
  const per = rectPathLength(rect);
  const p = { x: 0, y: 0 };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 96; i++) {
    const s = (i / 96) * per;
    rectPathPoint(rect, s, p);
    const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = s;
    }
  }
  return best;
}

export default function CursorTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fineHover.matches || reducedMotion.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let dpr = window.devicePixelRatio || 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const tracker = { x: mouse.x, y: mouse.y };
    const velocity = { x: 0, y: 0 };
    const trail = Array.from({ length: POINTS }, () => ({
      x: tracker.x,
      y: tracker.y,
      fixed: false,
    }));

    let active = false;
    let hoveredLink = null;
    let orbitAngle = 0;
    let orbitPos = 0; // büyük hedeflerde dikdörtgen yol üzerindeki px konumu
    let rectLocked = false;
    let approachFrames = 0;
    const orbitPt = { x: 0, y: 0 };
    let strokeRGB = "250, 250, 250";
    let mouseOverFixed = false;
    // elementFromPoint sonucunu son kez gördüğümüz element için cache'liyoruz —
    // her mousemove'da parent zincirini yeniden yürümeyelim.
    let lastFixedEl = null;
    let lastFixedResult = false;

    const readStrokeColor = () => {
      const hex = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-fg")
        .trim();
      const m = hex.match(/^#([0-9a-f]{6})$/i);
      if (!m) return;
      const v = m[1];
      strokeRGB = `${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}`;
    };
    readStrokeColor();
    const onThemeChange = () => readStrokeColor();
    window.addEventListener("themechange", onThemeChange);

    const isInFixedTree = (el) => {
      let cur = el;
      while (cur && cur !== document.body) {
        const pos = getComputedStyle(cur).position;
        if (pos === "fixed" || pos === "sticky") return true;
        cur = cur.parentElement;
      }
      return false;
    };

    const detectContext = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      const link = el ? el.closest("a, button") : null;
      let fixed;
      if (el === lastFixedEl) {
        fixed = lastFixedResult;
      } else {
        fixed = el ? isInFixedTree(el) : false;
        lastFixedEl = el;
        lastFixedResult = fixed;
      }
      return { link, fixed };
    };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      active = true;
      const ctx = detectContext(e.clientX, e.clientY);
      mouseOverFixed = ctx.fixed;
      const newLink = ctx.link;
      if (newLink !== hoveredLink) {
        if (newLink) {
          // Yeni linke girince yörüngeyi imlecin geldiği açıdan başlat —
          // tracker'ın o anki konumundan en yakın orbit noktasına geçişi yumuşatır
          const rect = newLink.getBoundingClientRect();
          orbitAngle = Math.atan2(
            e.clientY - (rect.top + rect.height / 2),
            e.clientX - (rect.left + rect.width / 2),
          );
          orbitPos = nearestRectPathPos(rect, e.clientX, e.clientY);
        }
        rectLocked = false;
        approachFrames = 0;
        hoveredLink = newLink;
      }
    };
    const onEnter = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      tracker.x = mouse.x;
      tracker.y = mouse.y;
      velocity.x = 0;
      velocity.y = 0;
      const ctx = detectContext(e.clientX, e.clientY);
      mouseOverFixed = ctx.fixed;
      for (const p of trail) {
        p.x = mouse.x;
        p.y = mouse.y;
        p.fixed = ctx.fixed;
      }
      active = true;
      rectLocked = false;
      approachFrames = 0;
      hoveredLink = ctx.link;
    };
    const onLeave = () => {
      active = false;
      hoveredLink = null;
      mouseOverFixed = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseenter", onEnter);
    window.addEventListener("mouseleave", onLeave);

    // Trail noktaları viewport koordinatında saklandığından, canvas fixed iken
    // scroll'da geride kalan izler "camda" duruyormuş gibi hissettiriyor.
    // Scroll delta'sını trail/tracker'dan düşerek izleri sayfaya yapıştırıyoruz —
    // baş, elastik takip ile sonraki birkaç frame'de imlece geri yetişir.
    let lastScrollX = window.scrollX;
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const dx = window.scrollX - lastScrollX;
      const dy = window.scrollY - lastScrollY;
      lastScrollX = window.scrollX;
      lastScrollY = window.scrollY;
      if (dx === 0 && dy === 0) return;
      // Fixed alt ağaçtaki noktalar viewport'a yapışık — onları öteleme.
      if (!mouseOverFixed) {
        tracker.x -= dx;
        tracker.y -= dy;
      }
      for (const p of trail) {
        if (p.fixed) continue;
        p.x -= dx;
        p.y -= dy;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    const loop = () => {
      // Hedef: link üzerindeyken yörünge noktası, değilse imlecin kendisi
      let targetX = mouse.x;
      let targetY = mouse.y;
      let onPath = false;
      const rect = hoveredLink ? hoveredLink.getBoundingClientRect() : null;
      if (rect && isLargeTarget(rect)) {
        if (!rectLocked) {
          // Yaklaşma: yolda imlecin girdiği noktaya yayla git.
          rectPathPoint(rect, orbitPos, orbitPt);
          targetX = orbitPt.x;
          targetY = orbitPt.y;
          approachFrames++;
          const dist = Math.hypot(tracker.x - orbitPt.x, tracker.y - orbitPt.y);
          if (dist < RECT_LOCK_DIST || approachFrames > RECT_LOCK_MAX_FRAMES) {
            rectLocked = true;
          }
        }
        if (rectLocked) {
          const step = (rectPathLength(rect) * RECT_ORBIT_SPEED) / (Math.PI * 2);
          const n = Math.max(1, Math.ceil(step / RECT_SUBSTEP));
          const x0 = tracker.x;
          const y0 = tracker.y;
          for (let k = 1; k <= n; k++) {
            rectPathPoint(rect, orbitPos + (step * k) / n, orbitPt);
            trail.shift();
            trail.push({
              x: orbitPt.x + (Math.random() - 0.5) * RECT_JITTER * 2,
              y: orbitPt.y + (Math.random() - 0.5) * RECT_JITTER * 2,
              fixed: mouseOverFixed,
            });
          }
          orbitPos += step;
          tracker.x = orbitPt.x;
          tracker.y = orbitPt.y;
          // Karttan çıkınca yay kaldığı yerden devam etsin: son frame'in
          // hareketi hız olarak kalıyor, iz imlece savrularak dönüyor.
          velocity.x = tracker.x - x0;
          velocity.y = tracker.y - y0;
          onPath = true;
        }
      } else if (rect) {
        orbitAngle += ORBIT_SPEED;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rx = (rect.width / 2) * ORBIT_PAD_RATIO;
        const ry = (rect.height / 2) * ORBIT_PAD_RATIO;
        targetX =
          cx +
          rx * Math.cos(orbitAngle) +
          (Math.random() - 0.5) * ORBIT_JITTER * 2;
        targetY =
          cy +
          ry * Math.sin(orbitAngle) +
          (Math.random() - 0.5) * ORBIT_JITTER * 2;
      }

      if (!onPath) {
        // İç aşama: velocity, hedefe doğru yaklaşır (lag yaratır)
        velocity.x += (targetX - tracker.x - velocity.x) * ELASTIC_INNER;
        velocity.y += (targetY - tracker.y - velocity.y) * ELASTIC_INNER;
        // Dış aşama: tracker velocity ile ilerler (momentum → overshoot → yaylanma)
        tracker.x += velocity.x * ELASTIC_OUTER;
        tracker.y += velocity.y * ELASTIC_OUTER;

        trail.shift();
        trail.push({ x: tracker.x, y: tracker.y, fixed: mouseOverFixed });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (active) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < trail.length - 1; i++) {
          const t = i / (trail.length - 1);
          ctx.strokeStyle = `rgba(${strokeRGB}, ${t * MAX_ALPHA})`;
          ctx.lineWidth = MIN_WIDTH + t * (MAX_WIDTH - MIN_WIDTH);
          ctx.beginPath();
          if (i === 0) {
            ctx.moveTo(trail[0].x, trail[0].y);
          } else {
            ctx.moveTo(
              (trail[i - 1].x + trail[i].x) / 2,
              (trail[i - 1].y + trail[i].y) / 2,
            );
          }
          if (i === trail.length - 2) {
            ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
          } else {
            ctx.quadraticCurveTo(
              trail[i].x,
              trail[i].y,
              (trail[i].x + trail[i + 1].x) / 2,
              (trail[i].y + trail[i + 1].y) / 2,
            );
          }
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("themechange", onThemeChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
