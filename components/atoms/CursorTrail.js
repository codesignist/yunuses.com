"use client";

import { useEffect, useRef } from "react";

const POINTS = 70;
const ELASTIC_INNER = 0.11; // velocity'nin delta'ya yakınsama hızı — düşük = daha geç toparlanma, daha çok lag
const ELASTIC_OUTER = 0.21; // tracker'ın velocity'yi ne kadar uyguladığı — yüksek = daha çok overshoot, daha yaylı
const MAX_ALPHA = 0.55;
const MIN_WIDTH = 0.5;
const MAX_WIDTH = 1.6;
const ORBIT_PAD_RATIO = 1.6; // ellipse, linkin sınırından kaç px dışarıdan geçer
const ORBIT_SPEED = 0.2; // rad/frame — ~1.5 sn'de tam tur
const ORBIT_JITTER = 12; // px, her frame eklenen rastgele şaşma (kalemle çizim hissi)

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
        }
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
      if (hoveredLink) {
        orbitAngle += ORBIT_SPEED;
        const rect = hoveredLink.getBoundingClientRect();
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

      // İç aşama: velocity, hedefe doğru yaklaşır (lag yaratır)
      velocity.x += (targetX - tracker.x - velocity.x) * ELASTIC_INNER;
      velocity.y += (targetY - tracker.y - velocity.y) * ELASTIC_INNER;
      // Dış aşama: tracker velocity ile ilerler (momentum → overshoot → yaylanma)
      tracker.x += velocity.x * ELASTIC_OUTER;
      tracker.y += velocity.y * ELASTIC_OUTER;

      trail.shift();
      trail.push({ x: tracker.x, y: tracker.y, fixed: mouseOverFixed });

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
