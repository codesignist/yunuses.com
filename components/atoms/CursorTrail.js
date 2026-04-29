"use client";

import { useEffect, useRef } from "react";

const POINTS = 70;
const ELASTIC_INNER = 0.1; // velocity'nin delta'ya yakınsama hızı — düşük = daha geç toparlanma, daha çok lag
const ELASTIC_OUTER = 0.2; // tracker'ın velocity'yi ne kadar uyguladığı — yüksek = daha çok overshoot, daha yaylı
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
    }));

    let active = false;
    let hoveredLink = null;
    let orbitAngle = 0;

    const detectLink = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      return el ? el.closest("a") : null;
    };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      active = true;
      const newLink = detectLink(e.clientX, e.clientY);
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
      for (const p of trail) {
        p.x = mouse.x;
        p.y = mouse.y;
      }
      active = true;
      hoveredLink = detectLink(e.clientX, e.clientY);
    };
    const onLeave = () => {
      active = false;
      hoveredLink = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseenter", onEnter);
    window.addEventListener("mouseleave", onLeave);

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
      trail.push({ x: tracker.x, y: tracker.y });

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (active) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < trail.length - 1; i++) {
          const t = i / (trail.length - 1);
          ctx.strokeStyle = `rgba(250, 250, 250, ${t * MAX_ALPHA})`;
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
      window.removeEventListener("resize", resize);
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
