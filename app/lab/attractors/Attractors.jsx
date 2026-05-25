"use client";
import { useEffect, useRef, useState } from "react";

const CUBE_HALF = 320;
const CAM_DIST = 1400;
const FOCAL_BASE = 1000;
const POINTS = 200000;
const WARMUP = 1000;
const BUCKETS = 6;
const NEAR_D = CAM_DIST - CUBE_HALF * 2;
const FAR_D = CAM_DIST + CUBE_HALF * 2;

const ATTRACTORS = {
  lorenz: {
    label: "Lorenz",
    rgb: "110, 200, 255",
    dt: 0.005,
    start: [0.1, 0, 0],
    step: (x, y, z, dt) => {
      const dx = 10 * (y - x);
      const dy = x * (28 - z) - y;
      const dz = x * y - (8 / 3) * z;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
  },
  aizawa: {
    label: "Aizawa",
    rgb: "255, 145, 215",
    dt: 0.01,
    start: [0.1, 0, 0],
    step: (x, y, z, dt) => {
      const a = 0.95;
      const b = 0.7;
      const c = 0.6;
      const d = 3.5;
      const e = 0.25;
      const f = 0.1;
      const dx = (z - b) * x - d * y;
      const dy = d * x + (z - b) * y;
      const dz =
        c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
  },
  halvorsen: {
    label: "Halvorsen",
    rgb: "255, 175, 100",
    dt: 0.005,
    start: [-1.48, -1.51, 2.04],
    step: (x, y, z, dt) => {
      const a = 1.4;
      const dx = -a * x - 4 * y - 4 * z - y * y;
      const dy = -a * y - 4 * z - 4 * x - z * z;
      const dz = -a * z - 4 * x - 4 * y - x * x;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
  },
  thomas: {
    label: "Thomas",
    rgb: "150, 240, 180",
    dt: 0.05,
    start: [0.1, 0, 0],
    step: (x, y, z, dt) => {
      const b = 0.208186;
      const dx = Math.sin(y) - b * x;
      const dy = Math.sin(z) - b * y;
      const dz = Math.sin(x) - b * z;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
  },
};

function buildTrajectory(attractor) {
  const n = POINTS;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const zs = new Float32Array(n);
  let [x, y, z] = attractor.start;
  for (let i = 0; i < WARMUP; i++) {
    [x, y, z] = attractor.step(x, y, z, attractor.dt);
  }
  for (let i = 0; i < n; i++) {
    [x, y, z] = attractor.step(x, y, z, attractor.dt);
    xs[i] = x;
    ys[i] = y;
    zs[i] = z;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
    if (zs[i] < minZ) minZ = zs[i];
    if (zs[i] > maxZ) maxZ = zs[i];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const s = (CUBE_HALF * 1.8) / range;
  for (let i = 0; i < n; i++) {
    xs[i] = (xs[i] - cx) * s;
    ys[i] = (ys[i] - cy) * s;
    zs[i] = (zs[i] - cz) * s;
  }
  return { xs, ys, zs, count: n };
}

export default function Attractors() {
  const canvasRef = useRef(null);
  const [active, setActive] = useState("lorenz");
  const [ready, setReady] = useState(false);

  const trajRef = useRef(null);
  const attractorRef = useRef(ATTRACTORS.lorenz);

  useEffect(() => {
    setReady(false);
    const id = setTimeout(() => {
      trajRef.current = buildTrajectory(ATTRACTORS[active]);
      attractorRef.current = ATTRACTORS[active];
      setReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const state = {
      yaw: 0.7,
      pitch: -0.35,
      vy: 0.0015,
      vp: 0,
      zoom: 1,
      dragging: false,
      lastX: 0,
      lastY: 0,
      lastInteractT: 0,
      width: 0,
      height: 0,
      pointers: new Map(),
      pinchStart: 0,
      pinchZoomStart: 1,
    };

    const bucketArrays = [];
    for (let b = 0; b < BUCKETS; b++) bucketArrays.push([]);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      state.width = rect.width;
      state.height = rect.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function drawGnomon() {
      const ox = state.width - 56;
      const oy = state.height - 70;
      const len = 28;
      const cyy = Math.cos(state.yaw);
      const syy = Math.sin(state.yaw);
      const cpp = Math.cos(state.pitch);
      const spp = Math.sin(state.pitch);

      const axes = [
        { v: [1, 0, 0], rgb: "255, 110, 110", label: "x" },
        { v: [0, 1, 0], rgb: "130, 220, 150", label: "y" },
        { v: [0, 0, 1], rgb: "150, 170, 255", label: "z" },
      ];

      const tips = axes.map((a) => {
        const x = a.v[0];
        const y = a.v[1];
        const z = a.v[2];
        const x1 = x * cyy - z * syy;
        const z1 = x * syy + z * cyy;
        const y2 = y * cpp - z1 * spp;
        const z2 = y * spp + z1 * cpp;
        return {
          rgb: a.rgb,
          label: a.label,
          sx: ox + x1 * len,
          sy: oy - y2 * len,
          z: z2,
        };
      });
      tips.sort((a, b) => a.z - b.z);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(ox, oy, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 1.4;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const t of tips) {
        const depthNorm = Math.max(0, Math.min(1, (t.z + 1) / 2));
        const near = 1 - depthNorm;
        const alpha = 0.35 + near * 0.55;
        ctx.strokeStyle = `rgba(${t.rgb}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(t.sx, t.sy);
        ctx.stroke();
        const lx = ox + (t.sx - ox) * 1.28;
        const ly = oy + (t.sy - oy) * 1.28;
        ctx.fillStyle = `rgba(${t.rgb}, ${Math.min(1, alpha + 0.2)})`;
        ctx.fillText(t.label, lx, ly);
      }
    }

    function render() {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, state.width, state.height);

      const traj = trajRef.current;
      const att = attractorRef.current;
      if (!traj) {
        drawGnomon();
        return;
      }

      const cy = Math.cos(state.yaw);
      const sy = Math.sin(state.yaw);
      const cp = Math.cos(state.pitch);
      const sp = Math.sin(state.pitch);
      const fBase = FOCAL_BASE * state.zoom;
      const halfW = state.width / 2;
      const halfH = state.height / 2;

      const xs = traj.xs;
      const ys = traj.ys;
      const zs = traj.zs;
      const n = traj.count;
      const depthRange = FAR_D - NEAR_D;

      for (let b = 0; b < BUCKETS; b++) bucketArrays[b].length = 0;

      let prevSx = 0;
      let prevSy = 0;
      let prevBucket = 0;
      let havePrev = false;

      for (let i = 0; i < n; i++) {
        const x = xs[i];
        const y = ys[i];
        const z = zs[i];
        const x1 = x * cy - z * sy;
        const z1 = x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const camZ = z2 + CAM_DIST;
        if (camZ <= 10) {
          havePrev = false;
          continue;
        }
        const f = fBase / camZ;
        const sx = x1 * f + halfW;
        const sy_ = -y2 * f + halfH;
        let bIdx = ((camZ - NEAR_D) / depthRange) * BUCKETS;
        bIdx = bIdx < 0 ? 0 : bIdx >= BUCKETS ? BUCKETS - 1 : bIdx | 0;

        if (havePrev) {
          const useBucket = prevBucket < bIdx ? prevBucket : bIdx;
          const arr = bucketArrays[useBucket];
          arr.push(prevSx, prevSy, sx, sy_);
        }
        prevSx = sx;
        prevSy = sy_;
        prevBucket = bIdx;
        havePrev = true;
      }

      ctx.lineCap = "round";
      for (let b = BUCKETS - 1; b >= 0; b--) {
        const arr = bucketArrays[b];
        if (arr.length === 0) continue;
        const t = b / (BUCKETS - 1);
        const near = 1 - t;
        const alpha = 0.04 + near * near * 0.42;
        const lw = 0.45 + near * 0.55;
        ctx.strokeStyle = `rgba(${att.rgb}, ${alpha})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let k = 0; k < arr.length; k += 4) {
          ctx.moveTo(arr[k], arr[k + 1]);
          ctx.lineTo(arr[k + 2], arr[k + 3]);
        }
        ctx.stroke();
      }

      drawGnomon();

      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(
        `${att.label}   ${n.toLocaleString("tr")} adım`,
        state.width - 16,
        state.height - 18,
      );
    }

    let raf = 0;
    function loop() {
      const now = performance.now();
      const idle = !state.dragging && now - state.lastInteractT > 2500;
      if (idle) {
        state.yaw += 0.0015;
      } else if (!state.dragging) {
        state.yaw += state.vy;
        state.pitch += state.vp;
        state.vy *= 0.95;
        state.vp *= 0.95;
      }
      state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
      render();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function onDown(e) {
      canvas.setPointerCapture?.(e.pointerId);
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 1) {
        state.dragging = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.vy = 0;
        state.vp = 0;
      } else if (state.pointers.size === 2) {
        const pts = [...state.pointers.values()];
        state.pinchStart = Math.hypot(
          pts[0].x - pts[1].x,
          pts[0].y - pts[1].y,
        );
        state.pinchZoomStart = state.zoom;
        state.dragging = false;
      }
      state.lastInteractT = performance.now();
    }

    function onMove(e) {
      if (state.pointers.has(e.pointerId)) {
        state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (state.pointers.size === 2 && state.pinchStart > 0) {
        const pts = [...state.pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        state.zoom = Math.max(
          0.4,
          Math.min(5, state.pinchZoomStart * (d / state.pinchStart)),
        );
        state.lastInteractT = performance.now();
        return;
      }
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      const k = 0.006;
      state.yaw += dx * k;
      state.pitch -= dy * k;
      state.vy = dx * k * 0.5;
      state.vp = -dy * k * 0.5;
      state.lastInteractT = performance.now();
    }

    function onUp(e) {
      state.pointers.delete(e.pointerId);
      canvas.releasePointerCapture?.(e.pointerId);
      if (state.pointers.size < 2) state.pinchStart = 0;
      if (state.pointers.size === 0) {
        state.dragging = false;
      } else if (state.pointers.size === 1) {
        const rem = [...state.pointers.values()][0];
        state.lastX = rem.x;
        state.lastY = rem.y;
        state.dragging = true;
      }
      state.lastInteractT = performance.now();
    }

    function onWheel(e) {
      e.preventDefault();
      const k = e.deltaY > 0 ? 0.92 : 1.08;
      state.zoom = Math.max(0.4, Math.min(5, state.zoom * k));
      state.lastInteractT = performance.now();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none select-none"
        style={{ cursor: "grab" }}
      />

      {!ready && (
        <div className="fixed inset-0 flex items-center justify-center text-[12px] text-white/55 pointer-events-none">
          Yörünge hesaplanıyor...
        </div>
      )}

      <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-2 items-start">
        <div className="text-[12px] text-white/60 px-1 pointer-events-none">
          Sürükleyerek döndür, tekerlekle yakınlaş.
        </div>
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded p-1 backdrop-blur-sm text-[12px]">
          {Object.entries(ATTRACTORS).map(([id, a]) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`px-2 py-1 rounded transition ${
                active === id
                  ? "bg-white/20 text-white"
                  : "text-white/65 hover:text-white hover:bg-white/10"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
