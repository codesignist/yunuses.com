"use client";
import { useEffect, useRef, useState } from "react";

const N_SEGS = 48;
const SEG_LEN = 26;
const SEG_GAP = 8;
const CHAIN_DIST = SEG_LEN + SEG_GAP;
const N_FACETS = 16;
const N_PLATE_RING = 8;
const MID_Z = 720;
const CAM_F = 820;
const IDLE_DELAY = 1500;
const Z_AMP = 200;

const COMMON_BG = {
  bgTop: [0x18, 0x1f, 0x2c],
  bgBot: [0x08, 0x0c, 0x14],
  moonInner: [252, 248, 232],
  moonMid: [232, 220, 196],
  moonOuter: [168, 158, 142],
  halo: [220, 230, 240],
  haloMid: [160, 185, 215],
};

const STYLES = {
  golge: {
    ...COMMON_BG,
    label: "Gölge",
    bodyLit: [0x16, 0x1b, 0x24],
    bodyDark: [0x06, 0x09, 0x10],
    maneLit: [0x0c, 0x0e, 0x12],
    maneMid: [0x05, 0x07, 0x0b],
    maneDark: [0x01, 0x02, 0x04],
    extreme: [8, 10, 14],
    rim: [200, 200, 200],
    rimIntensity: 0,
  },
  ates: {
    ...COMMON_BG,
    label: "Ateş",
    bodyLit: [0xff, 0xea, 0x70],
    bodyDark: [0x46, 0x04, 0x00],
    maneLit: [0xff, 0xf0, 0x90],
    maneMid: [0xff, 0x6a, 0x14],
    maneDark: [0x82, 0x06, 0x00],
    extreme: [22, 6, 1],
    rim: [255, 200, 80],
    rimIntensity: 0.95,
    flicker: true,
  },
  haku: {
    ...COMMON_BG,
    label: "Haku",
    bodyLit: [0xf6, 0xf2, 0xe8],
    bodyDark: [0x48, 0x58, 0x6c],
    maneLit: [0xb6, 0xea, 0xe4],
    maneMid: [0x4e, 0xae, 0xae],
    maneDark: [0x12, 0x30, 0x40],
    extreme: [34, 38, 48],
    rim: [220, 240, 238],
    rimIntensity: 0.35,
  },
};

const MOON_POS = { x: 0.7, y: 0.22 };
const MOON_SIZE = 0.22;
const MOON_Z = 2400;

const BODY_R = 20;
const TAPER_START = 0.7;

function radiusAt(t) {
  if (t < TAPER_START) return BODY_R;
  const k = (t - TAPER_START) / (1 - TAPER_START);
  return Math.max(2, BODY_R * (1 - k * k));
}

function plateHeight(t) {
  if (t < 0.08) return 0.4 + t * 7.5;
  if (t < TAPER_START) return 1;
  const k = (t - TAPER_START) / (1 - TAPER_START);
  return Math.max(0.3, 1 * (1 - k * k));
}

function plateWidthFactor(t) {
  if (t < TAPER_START) return 0.74;
  const k = (t - TAPER_START) / (1 - TAPER_START);
  return Math.max(0.35, 0.74 * (1 - k * 0.7));
}

function lerpC(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
function rgb(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

export default function Dragon() {
  const canvasRef = useRef(null);
  const [active, setActive] = useState("golge");
  const activeRef = useRef("golge");
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let style = STYLES.golge;
    const extremeStr = () =>
      `rgba(${style.extreme[0]},${style.extreme[1]},${style.extreme[2]},1)`;
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      w = r.width;
      h = r.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const segs = [];
    for (let i = 0; i < N_SEGS; i++) {
      segs.push({
        x: -i * CHAIN_DIST,
        y: 0,
        z: MID_Z,
        tx: 1, ty: 0, tz: 0,
        ux: 0, uy: -1, uz: 0,
        rx: 0, ry: 0, rz: 1,
      });
    }

    const LEG_DEFS = [
      { segIdx: 6, side: -1, phase: 0 },
      { segIdx: 6, side: 1, phase: Math.PI },
      { segIdx: 31, side: -1, phase: Math.PI * 0.5 },
      { segIdx: 31, side: 1, phase: Math.PI * 1.5 },
    ];

    const cosA = new Float32Array(N_FACETS);
    const sinA = new Float32Array(N_FACETS);
    const cosM = new Float32Array(N_FACETS);
    const sinM = new Float32Array(N_FACETS);
    for (let k = 0; k < N_FACETS; k++) {
      const a = (k / N_FACETS) * Math.PI * 2;
      cosA[k] = Math.cos(a);
      sinA[k] = Math.sin(a);
      const am = ((k + 0.5) / N_FACETS) * Math.PI * 2;
      cosM[k] = Math.cos(am);
      sinM[k] = Math.sin(am);
    }

    const mouse = { x: w / 2, y: h / 2, t: -Infinity, inside: false };
    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.t = performance.now();
      mouse.inside = true;
    }
    function onLeave() {
      mouse.inside = false;
    }
    function onTouch(e) {
      if (e.touches && e.touches[0]) {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - r.left;
        mouse.y = e.touches[0].clientY - r.top;
        mouse.t = performance.now();
        mouse.inside = true;
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });

    let idleBlend = 1;
    let raf = 0;
    let halfW = 0;
    let halfH = 0;
    const HEAD_LERP = 0.07;
    const LIGHT = { x: -0.3, y: 0.82, z: -0.49 };

    function project(x, y, z) {
      if (z < 80) return null;
      const inv = CAM_F / z;
      return { x: halfW + x * inv, y: halfH + y * inv, s: inv };
    }

    function mouseToWorld(mx, my) {
      const wx = ((mx - halfW) * MID_Z) / CAM_F;
      const wy = ((my - halfH) * MID_Z) / CAM_F;
      return { x: wx, y: wy };
    }

    function step(now) {
      style = STYLES[activeRef.current] || STYLES.golge;
      halfW = w / 2;
      halfH = h / 2;
      const sinceMouse = now - mouse.t;
      const wantIdle = sinceMouse > IDLE_DELAY || !mouse.inside;
      idleBlend += (wantIdle ? 1 : -1) * 0.018;
      if (idleBlend < 0) idleBlend = 0;
      if (idleBlend > 1) idleBlend = 1;

      const ampX = ((Math.min(w, h) * 0.5 * MID_Z) / CAM_F);
      const ampY = ((Math.min(w, h) * 0.38 * MID_Z) / CAM_F);
      const driftCx = ampX * 0.6 * Math.sin(now * 0.00014);
      const driftCy = ampY * 0.6 * Math.cos(now * 0.00018 + 1.7);
      const idleCx = driftCx + ampX * 0.55 * Math.sin(now * 0.00126);
      const idleCy = driftCy + ampY * 0.55 * Math.sin(now * 0.00126 + 1.2);

      const mw = mouseToWorld(mouse.x, mouse.y);
      const tx = mw.x + (idleCx - mw.x) * idleBlend;
      const ty = mw.y + (idleCy - mw.y) * idleBlend;

      const head = segs[0];
      head.x += (tx - head.x) * HEAD_LERP;
      head.y += (ty - head.y) * HEAD_LERP;
      head.z = MID_Z + Math.sin(now * 0.00095) * Z_AMP;

      for (let i = 1; i < N_SEGS; i++) {
        const a = segs[i - 1];
        const b = segs[i];
        const tb = i / (N_SEGS - 1);
        const cd = CHAIN_DIST * Math.max(0.25, radiusAt(tb) / BODY_R);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        b.x = a.x - (dx / d) * cd;
        b.y = a.y - (dy / d) * cd;
        b.z = a.z - (dz / d) * cd;
      }

      for (let i = 0; i < N_SEGS; i++) {
        const prev = segs[Math.max(0, i - 1)];
        const next = segs[Math.min(N_SEGS - 1, i + 1)];
        let tx_ = next.x - prev.x;
        let ty_ = next.y - prev.y;
        let tz_ = next.z - prev.z;
        const tl = Math.hypot(tx_, ty_, tz_) || 1;
        segs[i].tx = tx_ / tl;
        segs[i].ty = ty_ / tl;
        segs[i].tz = tz_ / tl;
      }

      const t0 = segs[0];
      let pUx = t0.ux * 0.985 + 0 * 0.015;
      let pUy = t0.uy * 0.985 + -1 * 0.015;
      let pUz = t0.uz * 0.985 + 0 * 0.015;
      const dotU0 = pUx * t0.tx + pUy * t0.ty + pUz * t0.tz;
      pUx -= dotU0 * t0.tx;
      pUy -= dotU0 * t0.ty;
      pUz -= dotU0 * t0.tz;
      let l0 = Math.hypot(pUx, pUy, pUz) || 1;
      pUx /= l0;
      pUy /= l0;
      pUz /= l0;
      t0.ux = pUx;
      t0.uy = pUy;
      t0.uz = pUz;

      for (let i = 1; i < N_SEGS; i++) {
        const a = segs[i - 1];
        const b = segs[i];
        const t1x = a.tx, t1y = a.ty, t1z = a.tz;
        const t2x = b.tx, t2y = b.ty, t2z = b.tz;
        const ax = t1y * t2z - t1z * t2y;
        const ay = t1z * t2x - t1x * t2z;
        const az = t1x * t2y - t1y * t2x;
        const al = Math.hypot(ax, ay, az);
        let ux = a.ux, uy = a.uy, uz = a.uz;
        if (al > 1e-6) {
          const c = t1x * t2x + t1y * t2y + t1z * t2z;
          const angle = Math.atan2(al, c);
          const cs = Math.cos(angle);
          const sn = Math.sin(angle);
          const nax = ax / al, nay = ay / al, naz = az / al;
          const dotAU = nax * ux + nay * uy + naz * uz;
          const rxx = ux * cs + (nay * uz - naz * uy) * sn + nax * dotAU * (1 - cs);
          const ryy = uy * cs + (naz * ux - nax * uz) * sn + nay * dotAU * (1 - cs);
          const rzz = uz * cs + (nax * uy - nay * ux) * sn + naz * dotAU * (1 - cs);
          ux = rxx; uy = ryy; uz = rzz;
        }
        const dotU2 = ux * t2x + uy * t2y + uz * t2z;
        ux -= dotU2 * t2x;
        uy -= dotU2 * t2y;
        uz -= dotU2 * t2z;
        const ll = Math.hypot(ux, uy, uz) || 1;
        b.ux = ux / ll;
        b.uy = uy / ll;
        b.uz = uz / ll;
      }

      for (let i = 0; i < N_SEGS; i++) {
        const s = segs[i];
        s.rx = s.ty * s.uz - s.tz * s.uy;
        s.ry = s.tz * s.ux - s.tx * s.uz;
        s.rz = s.tx * s.uy - s.ty * s.ux;
      }

      render(now);
      raf = requestAnimationFrame(step);
    }

    function render(now) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgb(style.bgTop));
      g.addColorStop(1, rgb(style.bgBot));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const moonScrX = w * MOON_POS.x;
      const moonScrY = h * MOON_POS.y;
      const moonR = Math.min(w, h) * MOON_SIZE;
      const moonWX = (moonScrX - halfW) * MOON_Z / CAM_F;
      const moonWY = (moonScrY - halfH) * MOON_Z / CAM_F;
      const ldx = 0 - moonWX;
      const ldy = 0 - moonWY;
      const ldz = MID_Z - MOON_Z;
      const lmag = Math.hypot(ldx, ldy, ldz) || 1;
      LIGHT.x = ldx / lmag;
      LIGHT.y = ldy / lmag;
      LIGHT.z = ldz / lmag;

      const halo = ctx.createRadialGradient(
        moonScrX, moonScrY, moonR * 0.45,
        moonScrX, moonScrY, moonR * 3.2,
      );
      halo.addColorStop(0, `rgba(${style.halo[0]},${style.halo[1]},${style.halo[2]},0.22)`);
      halo.addColorStop(0.35, `rgba(${style.haloMid[0]},${style.haloMid[1]},${style.haloMid[2]},0.08)`);
      halo.addColorStop(1, `rgba(${style.haloMid[0]},${style.haloMid[1]},${style.haloMid[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(moonScrX, moonScrY, moonR * 3.2, 0, Math.PI * 2);
      ctx.fill();

      const disc = ctx.createRadialGradient(
        moonScrX - moonR * 0.25, moonScrY - moonR * 0.3, moonR * 0.1,
        moonScrX, moonScrY, moonR,
      );
      disc.addColorStop(0, `rgba(${style.moonInner[0]},${style.moonInner[1]},${style.moonInner[2]},1)`);
      disc.addColorStop(0.55, `rgba(${style.moonMid[0]},${style.moonMid[1]},${style.moonMid[2]},1)`);
      disc.addColorStop(1, `rgba(${style.moonOuter[0]},${style.moonOuter[1]},${style.moonOuter[2]},0.92)`);
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(moonScrX, moonScrY, moonR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const rim = ctx.createRadialGradient(
        moonScrX, moonScrY, moonR * 0.9,
        moonScrX, moonScrY, moonR * 1.05,
      );
      rim.addColorStop(0, "rgba(0, 0, 0, 0)");
      rim.addColorStop(1, `rgba(${style.moonInner[0]},${style.moonInner[1]},${style.moonInner[2]},0.45)`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(moonScrX, moonScrY, moonR * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const groups = new Array(N_SEGS);
      for (let i = 0; i < N_SEGS; i++) {
        groups[i] = { centerZ: segs[i].z, facets: [], segIdx: i };
      }

      const rings = new Array(N_SEGS);
      const ringLit = new Array(N_SEGS);
      for (let i = 0; i < N_SEGS; i++) {
        const s = segs[i];
        const t = i / (N_SEGS - 1);
        const r = radiusAt(t);
        const ring = new Array(N_FACETS);
        const lits = new Float32Array(N_FACETS);
        for (let k = 0; k < N_FACETS; k++) {
          const ck = cosA[k];
          const sk = sinA[k];
          const nxr = ck * s.rx + sk * s.ux;
          const nyr = ck * s.ry + sk * s.uy;
          const nzr = ck * s.rz + sk * s.uz;
          ring[k] = {
            x: s.x + nxr * r,
            y: s.y + nyr * r,
            z: s.z + nzr * r,
          };
          const nl = Math.hypot(nxr, nyr, nzr) || 1;
          lits[k] = Math.max(
            0,
            -((nxr / nl) * LIGHT.x + (nyr / nl) * LIGHT.y + (nzr / nl) * LIGHT.z),
          );
        }
        rings[i] = ring;
        ringLit[i] = lits;
      }

      for (let i = 0; i < N_SEGS - 1; i++) {
        const sA = segs[i];
        const sB = segs[i + 1];
        const t = i / (N_SEGS - 1);
        const facets = groups[i].facets;
        const ringA = rings[i];
        const ringB = rings[i + 1];
        const litRingA = ringLit[i];
        const litRingB = ringLit[i + 1];

        const rx = (sA.rx + sB.rx) * 0.5;
        const ry = (sA.ry + sB.ry) * 0.5;
        const rz = (sA.rz + sB.rz) * 0.5;
        const ux = (sA.ux + sB.ux) * 0.5;
        const uy = (sA.uy + sB.uy) * 0.5;
        const uz = (sA.uz + sB.uz) * 0.5;

        for (let k = 0; k < N_FACETS; k++) {
          const k2 = (k + 1) % N_FACETS;
          const v0 = ringA[k];
          const v1 = ringA[k2];
          const v2 = ringB[k2];
          const v3 = ringB[k];

          const cm = cosM[k], sm = sinM[k];
          const nxRaw = cm * rx + sm * ux;
          const nyRaw = cm * ry + sm * uy;
          const nzRaw = cm * rz + sm * uz;
          const nl = Math.hypot(nxRaw, nyRaw, nzRaw) || 1;
          const nx = nxRaw / nl;
          const ny = nyRaw / nl;
          const nz = nzRaw / nl;

          const cx = (v0.x + v1.x + v2.x + v3.x) * 0.25;
          const cy = (v0.y + v1.y + v2.y + v3.y) * 0.25;
          const cz = (v0.z + v1.z + v2.z + v3.z) * 0.25;
          const vl = Math.hypot(cx, cy, cz) || 1;
          const facing = (nx * cx + ny * cy + nz * cz) / vl;
          if (facing > 0.02) continue;

          const absF = Math.abs(facing);
          const rim = Math.pow(Math.max(0, 1 - absF * 3.5), 2.2);
          const isBelly = sm < -0.3;

          facets.push({
            type: 0,
            v0x: v0.x, v0y: v0.y, v0z: v0.z,
            v1x: v1.x, v1y: v1.y, v1z: v1.z,
            v2x: v2.x, v2y: v2.y, v2z: v2.z,
            v3x: v3.x, v3y: v3.y, v3z: v3.z,
            l00: litRingA[k],
            l01: litRingA[k2],
            l11: litRingB[k2],
            l10: litRingB[k],
            rim, avgZ: cz,
            tIdx: t,
            facetK: k,
            isBelly,
            segIdx: i,
          });
        }
      }

      drawHeadCap(groups[0].facets);

      groups.sort((a, b) => b.centerZ - a.centerZ);

      const legsBySeg = {};
      for (const ld of LEG_DEFS) {
        if (ld.segIdx >= N_SEGS) continue;
        if (!legsBySeg[ld.segIdx]) legsBySeg[ld.segIdx] = [];
        legsBySeg[ld.segIdx].push(ld);
      }

      for (const g of groups) {
        g.facets.sort((a, b) => b.avgZ - a.avgZ);
        for (const f of g.facets) {
          if (f.type === 0) drawBodyFacet(f, now);
        }
        const legs = legsBySeg[g.segIdx];
        if (legs) {
          const sorted = legs
            .map((ld) => {
              const s = segs[ld.segIdx];
              return {
                ld,
                z: s.z + s.rz * ld.side * BODY_R * 0.85 - s.uz * BODY_R * 0.45,
              };
            })
            .sort((a, b) => b.z - a.z);
          for (const { ld } of sorted) {
            drawLeg(ld.segIdx, ld.side, now, ld.phase);
          }
        }
      }

      drawMane(now);
      drawHeadDetail(now);
      drawWhiskers(now);
      drawAntennae(now);
    }

    function depthDim(z) {
      const k = Math.max(0, Math.min(1, (z - MID_Z + 50) / 360));
      return k * 0.7;
    }

    function drawBodyFacet(f, now) {
      const p0 = project(f.v0x, f.v0y, f.v0z);
      const p1 = project(f.v1x, f.v1y, f.v1z);
      const p2 = project(f.v2x, f.v2y, f.v2z);
      const p3 = project(f.v3x, f.v3y, f.v3z);
      if (!p0 || !p1 || !p2 || !p3) return;

      const dim = depthDim(f.avgZ);
      let l00 = f.l00, l01 = f.l01, l11 = f.l11, l10 = f.l10;
      let rimInt = style.rimIntensity;
      if (style.flicker) {
        const w1 = Math.sin(now * 0.004 + f.tIdx * 14 + f.facetK * 0.7);
        const w2 = Math.sin(now * 0.0075 + f.tIdx * 22 - f.facetK * 1.1);
        const w3 = Math.sin(now * 0.012 - f.tIdx * 9);
        const flick = 0.5 + 0.5 * (w1 * 0.55 + w2 * 0.35 + w3 * 0.15);
        const m = (l) => Math.min(1, Math.max(0, l * 0.18 + flick * 0.82));
        l00 = m(l00); l01 = m(l01); l11 = m(l11); l10 = m(l10);
        rimInt *= 0.7 + 0.3 * Math.sin(now * 0.008 + f.tIdx * 5);
      }

      const ramp = (l) => {
        let c = lerpC(style.bodyDark, style.bodyLit, l);
        c = lerpC(c, style.bgBot, dim * 0.7);
        if (rimInt > 0 && f.rim > 0.4) {
          const rimMix = Math.min(0.85, (f.rim - 0.4) * 1.2) * rimInt;
          c = lerpC(c, style.rim, rimMix);
        }
        return c;
      };

      const maxL = Math.max(l00, l01, l11, l10);
      const minL = Math.min(l00, l01, l11, l10);
      const midStr = rgb(ramp((maxL + minL) * 0.5));

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();

      if (maxL - minL < 0.025) {
        ctx.fillStyle = midStr;
      } else {
        const w0 = l00 * l00 + 1e-3;
        const w1 = l01 * l01 + 1e-3;
        const w2 = l11 * l11 + 1e-3;
        const w3 = l10 * l10 + 1e-3;
        const totW = w0 + w1 + w2 + w3;
        const cx = (p0.x * w0 + p1.x * w1 + p2.x * w2 + p3.x * w3) / totW;
        const cy = (p0.y * w0 + p1.y * w1 + p2.y * w2 + p3.y * w3) / totW;
        const r0 = Math.hypot(p0.x - cx, p0.y - cy);
        const r1 = Math.hypot(p1.x - cx, p1.y - cy);
        const r2 = Math.hypot(p2.x - cx, p2.y - cy);
        const r3 = Math.hypot(p3.x - cx, p3.y - cy);
        const facetR = Math.max(r0, r1, r2, r3, 0.5);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, facetR);
        grad.addColorStop(0, rgb(ramp(maxL)));
        grad.addColorStop(0.55, rgb(ramp(maxL * 0.55 + minL * 0.45)));
        grad.addColorStop(1, rgb(ramp(minL)));
        ctx.fillStyle = grad;
      }
      ctx.fill();
      ctx.strokeStyle = midStr;
      ctx.lineWidth = 0.5;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    function drawPlate(f, now) {
      const projs = f.poly.map((v) => project(v.x, v.y, v.z));
      if (projs.some((p) => !p)) return;
      const baseLit = lerpC(PLATE_DARK, PLATE_LIT, f.lit);
      const dim = depthDim(f.avgZ);
      const col = lerpC(baseLit, BG_BOT, dim);

      ctx.beginPath();
      ctx.moveTo(projs[0].x, projs[0].y);
      for (let i = 1; i < projs.length; i++) ctx.lineTo(projs[i].x, projs[i].y);
      ctx.closePath();
      ctx.fillStyle = rgb(col);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
      ctx.lineWidth = 1.0;
      ctx.stroke();

      const innerInset = 0.18;
      const acx = projs.reduce((s, p) => s + p.x, 0) / projs.length;
      const acy = projs.reduce((s, p) => s + p.y, 0) / projs.length;
      ctx.beginPath();
      ctx.moveTo(
        projs[0].x + (acx - projs[0].x) * innerInset,
        projs[0].y + (acy - projs[0].y) * innerInset,
      );
      for (let i = 1; i < projs.length; i++) {
        ctx.lineTo(
          projs[i].x + (acx - projs[i].x) * innerInset,
          projs[i].y + (acy - projs[i].y) * innerInset,
        );
      }
      ctx.closePath();
      const innerLit = lerpC(col, PLATE_LIT, 0.18);
      ctx.fillStyle = rgb(innerLit);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 0.6;
      ctx.stroke();

      if (f.hasLed) {
        const led = project(f.ledX, f.ledY, f.ledZ);
        if (led) {
          const pulse = 0.55 + 0.45 * Math.sin(now * 0.0028 + f.segIdx * 0.6);
          const sz = 1.6 * led.s * pulse;
          ctx.save();
          ctx.shadowColor = ACCENT;
          ctx.shadowBlur = 12 * pulse * Math.max(0.6, led.s);
          ctx.fillStyle = ACCENT_HOT;
          ctx.beginPath();
          ctx.arc(led.x, led.y, sz, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function drawHeadCap(facets) {
      const s = segs[0];
      const r0 = radiusAt(0);
      const bulgeR = r0 * 1.45;
      const taperEndR = r0 * 0.85;
      const cylR = r0 * 0.6;

      const headLen = SEG_LEN * 0.9;
      const taperLen = SEG_LEN * 1.0;
      const cylLen = SEG_LEN * 1.15;

      const bulgePos = headLen;
      const taperEndPos = bulgePos + taperLen;
      const frontPos = taperEndPos + cylLen;

      const bulgeCx = s.x - s.tx * bulgePos;
      const bulgeCy = s.y - s.ty * bulgePos;
      const bulgeCz = s.z - s.tz * bulgePos;
      const taperEndCx = s.x - s.tx * taperEndPos;
      const taperEndCy = s.y - s.ty * taperEndPos;
      const taperEndCz = s.z - s.tz * taperEndPos;
      const frontCx = s.x - s.tx * frontPos;
      const frontCy = s.y - s.ty * frontPos;
      const frontCz = s.z - s.tz * frontPos;

      const ringBack = new Array(N_FACETS);
      const ringBulge = new Array(N_FACETS);
      const ringTaperEnd = new Array(N_FACETS);
      const ringFront = new Array(N_FACETS);
      for (let k = 0; k < N_FACETS; k++) {
        const ck = cosA[k];
        const sk = sinA[k];
        const dx = ck * s.rx + sk * s.ux;
        const dy = ck * s.ry + sk * s.uy;
        const dz = ck * s.rz + sk * s.uz;
        ringBack[k] = { x: s.x + dx * r0, y: s.y + dy * r0, z: s.z + dz * r0 };
        ringBulge[k] = {
          x: bulgeCx + dx * bulgeR,
          y: bulgeCy + dy * bulgeR,
          z: bulgeCz + dz * bulgeR,
        };
        ringTaperEnd[k] = {
          x: taperEndCx + dx * taperEndR,
          y: taperEndCy + dy * taperEndR,
          z: taperEndCz + dz * taperEndR,
        };
        ringFront[k] = {
          x: frontCx + dx * cylR,
          y: frontCy + dy * cylR,
          z: frontCz + dz * cylR,
        };
      }

      const pairs = [
        { ringA: ringBack, ringB: ringBulge, tiltFwd: -0.18 },
        { ringA: ringBulge, ringB: ringTaperEnd, tiltFwd: 0.55 },
        { ringA: ringTaperEnd, ringB: ringFront, tiltFwd: 0.15 },
      ];

      function pushQuad(v0, v1, v2, v3, nx, ny, nz, l00, l01, l11, l10) {
        const cx = (v0.x + v1.x + v2.x + v3.x) * 0.25;
        const cy = (v0.y + v1.y + v2.y + v3.y) * 0.25;
        const cz = (v0.z + v1.z + v2.z + v3.z) * 0.25;
        const vl = Math.hypot(cx, cy, cz) || 1;
        const facing = (nx * cx + ny * cy + nz * cz) / vl;
        if (facing > 0.02) return;
        const absF = Math.abs(facing);
        const rim = Math.pow(Math.max(0, 1 - absF * 3.5), 2.2);
        facets.push({
          type: 0,
          v0x: v0.x, v0y: v0.y, v0z: v0.z,
          v1x: v1.x, v1y: v1.y, v1z: v1.z,
          v2x: v2.x, v2y: v2.y, v2z: v2.z,
          v3x: v3.x, v3y: v3.y, v3z: v3.z,
          l00, l01, l11, l10,
          rim,
          avgZ: cz,
          tIdx: 0,
          facetK: 0,
          isBelly: false,
          segIdx: 0,
        });
      }

      function ringLitForTilt(tiltFwd) {
        const out = new Float32Array(N_FACETS);
        for (let k = 0; k < N_FACETS; k++) {
          const ck = cosA[k];
          const sk = sinA[k];
          const nxr = ck * s.rx + sk * s.ux - s.tx * tiltFwd;
          const nyr = ck * s.ry + sk * s.uy - s.ty * tiltFwd;
          const nzr = ck * s.rz + sk * s.uz - s.tz * tiltFwd;
          const nl = Math.hypot(nxr, nyr, nzr) || 1;
          out[k] = Math.max(
            0,
            -((nxr / nl) * LIGHT.x + (nyr / nl) * LIGHT.y + (nzr / nl) * LIGHT.z),
          );
        }
        return out;
      }

      for (const pair of pairs) {
        const pairLit = ringLitForTilt(pair.tiltFwd);
        for (let k = 0; k < N_FACETS; k++) {
          const k2 = (k + 1) % N_FACETS;
          const cm = cosM[k];
          const sm = sinM[k];
          const nxRaw = cm * s.rx + sm * s.ux - s.tx * pair.tiltFwd;
          const nyRaw = cm * s.ry + sm * s.uy - s.ty * pair.tiltFwd;
          const nzRaw = cm * s.rz + sm * s.uz - s.tz * pair.tiltFwd;
          const nl = Math.hypot(nxRaw, nyRaw, nzRaw) || 1;
          pushQuad(
            pair.ringA[k],
            pair.ringA[k2],
            pair.ringB[k2],
            pair.ringB[k],
            nxRaw / nl,
            nyRaw / nl,
            nzRaw / nl,
            pairLit[k],
            pairLit[k2],
            pairLit[k2],
            pairLit[k],
          );
        }
      }

      const capNx = -s.tx;
      const capNy = -s.ty;
      const capNz = -s.tz;
      const capLit = Math.max(0, -(capNx * LIGHT.x + capNy * LIGHT.y + capNz * LIGHT.z));
      const capCenter = { x: frontCx, y: frontCy, z: frontCz };
      for (let k = 0; k < N_FACETS; k++) {
        const k2 = (k + 1) % N_FACETS;
        pushQuad(
          ringFront[k],
          ringFront[k2],
          capCenter,
          capCenter,
          capNx,
          capNy,
          capNz,
          capLit,
          capLit,
          capLit,
          capLit,
        );
      }
    }

    function projHeadLocal(head, fwd, up, side) {
      const fx = -head.tx;
      const fy = -head.ty;
      const fz = -head.tz;
      const x = head.x + fx * fwd + head.ux * up + head.rx * side;
      const y = head.y + fy * fwd + head.uy * up + head.ry * side;
      const z = head.z + fz * fwd + head.uz * up + head.rz * side;
      return project(x, y, z);
    }

    function drawHeadDetail() {
      const head = segs[0];
      const r = radiusAt(0);

      const antlerSegs = [
        [
          [-r * 0.15, r * 0.85, -r * 0.3],
          [-r * 1.1, r * 1.7, -r * 0.55],
          [-r * 2.6, r * 2.05, -r * 0.7],
        ],
        [
          [-r * 0.15, r * 0.85, r * 0.3],
          [-r * 1.1, r * 1.7, r * 0.55],
          [-r * 2.6, r * 2.05, r * 0.7],
        ],
      ];

      ctx.lineCap = "round";
      for (const spec of antlerSegs) {
        ctx.beginPath();
        let started = false;
        let avgS = 0;
        let count = 0;
        for (const pt of spec) {
          const p = projHeadLocal(head, pt[0], pt[1], pt[2]);
          if (!p) continue;
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
          avgS += p.s;
          count++;
        }
        if (!started || count === 0) continue;
        const s = avgS / count;
        ctx.strokeStyle = extremeStr();
        ctx.lineWidth = 3.4 * s;
        ctx.stroke();
      }
    }

    function drawWhiskers(now) {
      const head = segs[0];
      const r0 = radiusAt(0);
      const snoutLen = SEG_LEN * 1.5;
      const snoutTip = SEG_LEN / 2 + snoutLen;
      const followSegs = Math.min(N_SEGS - 1, 14);
      const ptsPerSeg = 4;
      const numPts = followSegs * ptsPerSeg;

      for (let s = -1; s <= 1; s += 2) {
        const phase = s === 1 ? 1.4 : 0;
        const points = [];

        const startFwd = snoutTip - r0 * 0.2;
        const startUp = -r0 * 0.05;
        const startSide = s * r0 * 0.28;
        points.push({
          x: head.x + (-head.tx) * startFwd + head.ux * startUp + head.rx * startSide,
          y: head.y + (-head.ty) * startFwd + head.uy * startUp + head.ry * startSide,
          z: head.z + (-head.tz) * startFwd + head.uz * startUp + head.rz * startSide,
        });

        for (let i = 1; i <= numPts; i++) {
          const t = i / numPts;
          const segF = t * followSegs;
          const segI = Math.floor(segF);
          const segFrac = segF - segI;
          if (segI >= N_SEGS - 1) break;
          const a = segs[segI];
          const b = segs[segI + 1];
          const bx = a.x + (b.x - a.x) * segFrac;
          const by = a.y + (b.y - a.y) * segFrac;
          const bz = a.z + (b.z - a.z) * segFrac;
          const ux = a.ux * (1 - segFrac) + b.ux * segFrac;
          const uy = a.uy * (1 - segFrac) + b.uy * segFrac;
          const uz = a.uz * (1 - segFrac) + b.uz * segFrac;
          const rxA = a.rx * (1 - segFrac) + b.rx * segFrac;
          const ryA = a.ry * (1 - segFrac) + b.ry * segFrac;
          const rzA = a.rz * (1 - segFrac) + b.rz * segFrac;

          const radHere = radiusAt(segF / (N_SEGS - 1));
          const sideWave =
            s *
            Math.sin(t * Math.PI * 1.7 + now * 0.0012 + phase) *
            radHere *
            0.9 *
            t;
          const upWave =
            Math.sin(t * Math.PI * 2.3 + now * 0.0015 + phase) *
            radHere *
            1.0 *
            t;
          const lateral = s * radHere * (1.9 + t * 0.5) + sideWave;

          points.push({
            x: bx + ux * upWave + rxA * lateral,
            y: by + uy * upWave + ryA * lateral,
            z: bz + uz * upWave + rzA * lateral,
          });
        }

        const projs = points.map((p) => project(p.x, p.y, p.z));
        let started = false;
        let avgS = 0;
        let count = 0;
        ctx.beginPath();
        for (const p of projs) {
          if (!p) continue;
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
          avgS += p.s;
          count++;
        }
        if (!started || count === 0) continue;
        const scale = avgS / count;

        ctx.strokeStyle = extremeStr();
        ctx.lineWidth = 1.6 * Math.max(0.5, scale);
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    function drawMane(now) {
      const startSeg = 0;
      const endSeg = Math.min(N_SEGS - 4, 36);
      const layers = [
        { rgb: style.maneDark, alpha: 0.7, count: 106, lenMult: 0.95, baseOff: -0.05, lateralAmp: 0.55, lift: 0.4, seed: 1 },
        { rgb: style.maneMid, alpha: 0.7, count: 96, lenMult: 1.05, baseOff: 0.05, lateralAmp: 0.4, lift: 0.55, seed: 1000 },
        { rgb: style.maneLit, alpha: 0.75, count: 77, lenMult: 1.15, baseOff: 0.1, lateralAmp: 0.25, lift: 0.7, seed: 2000 },
      ];

      const hash = (n) => {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
      };

      ctx.lineCap = "round";

      for (const layer of layers) {
        for (let i = 0; i < layer.count; i++) {
          const idx = i + layer.seed;
          const baseT = hash(idx);
          const lateralRand = (hash(idx + 73) - 0.5) * 2;
          const lenRand = 0.65 + hash(idx + 149) * 0.7;
          const widthRand = 1.7 + hash(idx + 211) * 1.2;
          const phaseRand = hash(idx + 307) * Math.PI * 2;

          const segIdxF = startSeg + (endSeg - startSeg) * baseT;
          const segI = Math.floor(segIdxF);
          const segFrac = segIdxF - segI;
          if (segI >= N_SEGS - 2) continue;
          const segA = segs[segI];
          const segB = segs[segI + 1];
          const f1 = 1 - segFrac;
          const f2 = segFrac;

          const tProg = segIdxF / (N_SEGS - 1);
          const r = radiusAt(tProg);

          const sx = segA.x * f1 + segB.x * f2;
          const sy = segA.y * f1 + segB.y * f2;
          const sz = segA.z * f1 + segB.z * f2;
          const sux = segA.ux * f1 + segB.ux * f2;
          const suy = segA.uy * f1 + segB.uy * f2;
          const suz = segA.uz * f1 + segB.uz * f2;
          const srx = segA.rx * f1 + segB.rx * f2;
          const sry = segA.ry * f1 + segB.ry * f2;
          const srz = segA.rz * f1 + segB.rz * f2;
          const stx = segA.tx * f1 + segB.tx * f2;
          const sty = segA.ty * f1 + segB.ty * f2;
          const stz = segA.tz * f1 + segB.tz * f2;

          const lateralOff = lateralRand * layer.lateralAmp * r;

          const baseUpFactor = 0.85 + layer.baseOff;
          const baseX = sx + sux * r * baseUpFactor + srx * lateralOff;
          const baseY = sy + suy * r * baseUpFactor + sry * lateralOff;
          const baseZ = sz + suz * r * baseUpFactor + srz * lateralOff;

          const strokeLen = r * 2.2 * lenRand * layer.lenMult * (1.1 - baseT * 0.3);
          const wave = Math.sin(now * 0.0011 + phaseRand) * 0.18;

          const tipX = baseX + stx * strokeLen * (0.55 + wave) + sux * strokeLen * layer.lift + srx * lateralOff * 1.3;
          const tipY = baseY + sty * strokeLen * (0.55 + wave) + suy * strokeLen * layer.lift + sry * lateralOff * 1.3;
          const tipZ = baseZ + stz * strokeLen * (0.55 + wave) + suz * strokeLen * layer.lift + srz * lateralOff * 1.3;

          const baseHalf = r * 0.12 * widthRand;
          const baseAx = baseX + stx * baseHalf;
          const baseAy = baseY + sty * baseHalf;
          const baseAz = baseZ + stz * baseHalf;
          const baseBx = baseX - stx * baseHalf;
          const baseBy = baseY - sty * baseHalf;
          const baseBz = baseZ - stz * baseHalf;

          const pBaseA = project(baseAx, baseAy, baseAz);
          const pBaseB = project(baseBx, baseBy, baseBz);
          const pTip = project(tipX, tipY, tipZ);
          if (!pBaseA || !pBaseB || !pTip) continue;

          const dim = depthDim(sz);
          let a = layer.alpha * (1 - dim * 0.55);
          let c = layer.rgb;
          if (style.flicker) {
            const flick = 0.45 + 0.55 * Math.sin(now * 0.009 + i * 1.7 + phaseRand * 4);
            a *= 0.35 + flick * 0.85;
            c = lerpC(style.maneDark, style.maneLit, Math.max(0, Math.min(1, baseT * 0.3 + flick * 0.85)));
          }
          ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
          ctx.beginPath();
          ctx.moveTo(pBaseA.x, pBaseA.y);
          ctx.lineTo(pTip.x, pTip.y);
          ctx.lineTo(pBaseB.x, pBaseB.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    function drawAntennae(now) {
      const head = segs[0];
      const r = radiusAt(0);
      const wave1 = Math.sin(now * 0.0021) * 6;
      const wave2 = Math.cos(now * 0.0019) * 5;
      const wave3 = Math.sin(now * 0.0026 + 1.2) * 7;
      const wave4 = Math.cos(now * 0.0023 + 0.8) * 6;
      const snoutFwd = SEG_LEN / 2 + SEG_LEN * 0.2;

      const ants = [
        [
          [snoutFwd * 0.4, r * 0.15, -r * 0.55],
          [snoutFwd * 0.1, -r * 0.05 + wave1, -r * 0.95],
          [-snoutFwd * 0.6, -r * 0.4 + wave1 * 1.4, -r * 1.5],
          [-snoutFwd * 1.6, -r * 0.85 + wave1 * 1.8, -r * 2.0],
        ],
        [
          [snoutFwd * 0.4, r * 0.15, r * 0.55],
          [snoutFwd * 0.1, -r * 0.05 + wave2, r * 0.95],
          [-snoutFwd * 0.6, -r * 0.4 + wave2 * 1.4, r * 1.5],
          [-snoutFwd * 1.6, -r * 0.85 + wave2 * 1.8, r * 2.0],
        ],
        [
          [snoutFwd * 0.5, r * 0.25, -r * 0.3],
          [snoutFwd * 0.2, r * 0.05 + wave3, -r * 0.5],
          [-snoutFwd * 0.4, -r * 0.25 + wave3 * 1.3, -r * 0.85],
          [-snoutFwd * 1.3, -r * 0.6 + wave3 * 1.6, -r * 1.15],
        ],
        [
          [snoutFwd * 0.5, r * 0.25, r * 0.3],
          [snoutFwd * 0.2, r * 0.05 + wave4, r * 0.5],
          [-snoutFwd * 0.4, -r * 0.25 + wave4 * 1.3, r * 0.85],
          [-snoutFwd * 1.3, -r * 0.6 + wave4 * 1.6, r * 1.15],
        ],
      ];

      ctx.lineCap = "round";
      for (let idx = 0; idx < ants.length; idx++) {
        const spec = ants[idx];
        let started = false;
        let avgS = 0;
        let count = 0;
        ctx.beginPath();
        for (const pt of spec) {
          const p = projHeadLocal(segs[0], pt[0], pt[1], pt[2]);
          if (!p) continue;
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
          avgS += p.s;
          count++;
        }
        if (!started) continue;
        const s = avgS / count;
        const inner = idx < 2;
        ctx.strokeStyle = extremeStr();
        ctx.lineWidth = (inner ? 2.0 : 1.4) * s;
        ctx.stroke();
      }
    }

    function drawLeg(segIdx, side, now, phaseOffset) {
      const s = segs[segIdx];
      const ATT_OUT = BODY_R * 0.88;
      const ATT_DOWN = BODY_R * 0.4;
      const shx = s.x + s.rx * side * ATT_OUT - s.ux * ATT_DOWN;
      const shy = s.y + s.ry * side * ATT_OUT - s.uy * ATT_DOWN;
      const shz = s.z + s.rz * side * ATT_OUT - s.uz * ATT_DOWN;

      const ph = now * 0.0022 + phaseOffset;
      const swing1 = Math.sin(ph) * 0.45;
      const swing2 = Math.sin(ph * 1.3 + 0.7) * 0.35;

      const UPPER = 32;
      const LOWER = 28;

      const upDx = -s.ux * 0.55 + s.rx * side * 0.5 + s.tx * swing1;
      const upDy = -s.uy * 0.55 + s.ry * side * 0.5 + s.ty * swing1;
      const upDz = -s.uz * 0.55 + s.rz * side * 0.5 + s.tz * swing1;
      const upL = Math.hypot(upDx, upDy, upDz) || 1;
      const elx = shx + (upDx / upL) * UPPER;
      const ely = shy + (upDy / upL) * UPPER;
      const elz = shz + (upDz / upL) * UPPER;

      const loDx = -s.ux * 0.92 + s.tx * swing2 + s.rx * side * 0.15;
      const loDy = -s.uy * 0.92 + s.ty * swing2 + s.ry * side * 0.15;
      const loDz = -s.uz * 0.92 + s.tz * swing2 + s.rz * side * 0.15;
      const loL = Math.hypot(loDx, loDy, loDz) || 1;
      const wx = elx + (loDx / loL) * LOWER;
      const wy = ely + (loDy / loL) * LOWER;
      const wz = elz + (loDz / loL) * LOWER;

      const ps = project(shx, shy, shz);
      const pe = project(elx, ely, elz);
      const pw = project(wx, wy, wz);
      if (!ps || !pe || !pw) return;

      const limbCol = style.extreme;
      const jointCol = style.extreme;

      ctx.lineCap = "round";

      const upperW = 9 * ((ps.s + pe.s) * 0.5);
      ctx.strokeStyle = rgb(limbCol);
      ctx.lineWidth = upperW;
      ctx.beginPath();
      ctx.moveTo(ps.x, ps.y);
      ctx.lineTo(pe.x, pe.y);
      ctx.stroke();

      const lowerW = 7 * ((pe.s + pw.s) * 0.5);
      ctx.lineWidth = lowerW;
      ctx.beginPath();
      ctx.moveTo(pe.x, pe.y);
      ctx.lineTo(pw.x, pw.y);
      ctx.stroke();

      ctx.fillStyle = rgb(jointCol);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 5.5 * ps.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pe.x, pe.y, 5 * pe.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, 4.5 * pw.s, 0, Math.PI * 2);
      ctx.fill();

      const CLAW = 16;
      const baseX = -s.ux;
      const baseY = -s.uy;
      const baseZ = -s.uz;
      const spreadFwdX = s.tx;
      const spreadFwdY = s.ty;
      const spreadFwdZ = s.tz;
      const spreadSideX = s.rx * side;
      const spreadSideY = s.ry * side;
      const spreadSideZ = s.rz * side;

      for (let c = 0; c < 3; c++) {
        const angF = (c - 1) * 0.55;
        const angS = 0.18;
        const cosF = Math.cos(angF);
        const sinF = Math.sin(angF);
        const cosS = Math.cos(angS);
        const sinS = Math.sin(angS);
        const dx = baseX * cosF * cosS + spreadFwdX * sinF + spreadSideX * sinS * cosF;
        const dy = baseY * cosF * cosS + spreadFwdY * sinF + spreadSideY * sinS * cosF;
        const dz = baseZ * cosF * cosS + spreadFwdZ * sinF + spreadSideZ * sinS * cosF;
        const dl = Math.hypot(dx, dy, dz) || 1;
        const tipX = wx + (dx / dl) * CLAW;
        const tipY = wy + (dy / dl) * CLAW;
        const tipZ = wz + (dz / dl) * CLAW;
        const midX = wx + (dx / dl) * CLAW * 0.5 - s.tx * 1.5;
        const midY = wy + (dy / dl) * CLAW * 0.5 - s.ty * 1.5;
        const midZ = wz + (dz / dl) * CLAW * 0.5 - s.tz * 1.5;
        const pm = project(midX, midY, midZ);
        const pc = project(tipX, tipY, tipZ);
        if (!pc || !pm) continue;
        ctx.strokeStyle = extremeStr();
        ctx.lineWidth = 2.4 * pw.s;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pw.x, pw.y);
        ctx.quadraticCurveTo(pm.x, pm.y, pc.x, pc.y);
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none select-none"
      />

      <div className="fixed bottom-4 left-4 z-30 flex gap-1 bg-white/5 border border-white/10 rounded p-1 backdrop-blur-sm text-[12px]">
        {Object.entries(STYLES).map(([id, s]) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`px-2 py-1 rounded transition ${
              active === id
                ? "bg-white/20 text-white"
                : "text-white/65 hover:text-white hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
