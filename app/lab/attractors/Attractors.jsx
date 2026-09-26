"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import useLabKeys from "lib/useLabKeys";
import LabOptionBar from "components/molecules/LabOptionBar";

const CUBE_HALF = 320;
const CAM_DIST = 1400;
const FOCAL_BASE = 1000;
const POINTS = 200000;
const WARMUP = 1000;
// Toplamali karisimda cizgi basina opaklik carpani. WebGL cizgisi her
// zaman bir aygit pikseli; eski 0.45-1 px'lik Canvas cizgileriyle ayni
// yogunluga bununla ayarlaniyor.
const LINE_GAIN = 0.6;
const NEAR_D = CAM_DIST - CUBE_HALF * 2;
const FAR_D = CAM_DIST + CUBE_HALF * 2;

const ATTRACTORS = {
  lorenz: {
    label: "Lorenz",
    rgb: [110, 200, 255],
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
    rgb: [255, 145, 215],
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
    rgb: [255, 175, 100],
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
    rgb: [150, 240, 180],
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

const ATTRACTOR_IDS = Object.keys(ATTRACTORS);
const ATTRACTOR_OPTIONS = ATTRACTOR_IDS.map((id) => ({ id, label: ATTRACTORS[id].label }));

function buildTrajectory(attractor) {
  const n = POINTS;
  const pos = new Float32Array(n * 3);
  let [x, y, z] = attractor.start;
  for (let i = 0; i < WARMUP; i++) {
    [x, y, z] = attractor.step(x, y, z, attractor.dt);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    [x, y, z] = attractor.step(x, y, z, attractor.dt);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const s = (CUBE_HALF * 1.8) / range;
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] = (pos[i] - cx) * s;
    pos[i + 1] = (pos[i + 1] - cy) * s;
    pos[i + 2] = (pos[i + 2] - cz) * s;
  }
  return { positions: pos, count: n };
}

// Cizgiler toplamali karisiyor: yorunge sik gectigi yerde renk birikip
// beyaza dogru parliyor. Onceden derinlik 6 kovaya bolunup her kova tek
// bir opaklikla ciziliyordu; burada opaklik her noktada surekli.
const LINE_VS = `
  uniform float uNearD;
  uniform float uFarD;
  varying float vNear;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNear = 1.0 - clamp((-mv.z - uNearD) / (uFarD - uNearD), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const LINE_FS = `
  uniform vec3 uColor;
  uniform float uGain;
  varying float vNear;
  void main() {
    gl_FragColor = vec4(uColor, (0.04 + vNear * vNear * 0.42) * uGain);
  }
`;

export default function Attractors() {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const [active, setActive] = useState("lorenz");
  const [ready, setReady] = useState(false);

  const trajRef = useRef(null);
  const attractorRef = useRef(ATTRACTORS.lorenz);

  // Eksen gostergesi ve adim etiketi canvas'a ciziliyor, data-chrome ile
  // gizlenemiyor; H durumunu cizim dongusune ref ile tasiyoruz.
  const chromeHidden = useLabKeys(ATTRACTOR_IDS, setActive);
  const chromeHiddenRef = useRef(false);
  useEffect(() => {
    chromeHiddenRef.current = chromeHidden;
  }, [chromeHidden]);

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
    const container = containerRef.current;
    const overlay = overlayRef.current;
    const octx = overlay.getContext("2d");

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

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 10, CAM_DIST * 4);
    camera.position.set(0, 0, CAM_DIST);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uNearD: { value: NEAR_D },
        uFarD: { value: FAR_D },
        uGain: { value: LINE_GAIN },
      },
      vertexShader: LINE_VS,
      fragmentShader: LINE_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    // Donus matrisi elle yaziliyor: onceki Canvas 2D projeksiyonuyla
    // birebir ayni gorunum (baslangic acisi, surukleme yonu) korunsun diye.
    const line = new THREE.Line(new THREE.BufferGeometry(), material);
    line.matrixAutoUpdate = false;
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);

    let uploaded = null;
    function syncTrajectory() {
      const traj = trajRef.current;
      if (traj === uploaded) return;
      uploaded = traj;
      // Ayni geometride attribute degistirmek eski GPU tamponunu sizdiriyor;
      // her cekici icin yeni geometri, eskisi dispose.
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry();
      if (!traj) {
        line.visible = false;
        return;
      }
      line.geometry.setAttribute("position", new THREE.BufferAttribute(traj.positions, 3));
      const [r, g, b] = attractorRef.current.rgb;
      material.uniforms.uColor.value.setRGB(r / 255, g / 255, b / 255);
      line.visible = true;
    }

    // Eski projeksiyonda odak uzakligi piksel cinsinden sabitti; ayni
    // olcegi tutmak icin gorus acisi yukseklik ve zoom'dan turetiliyor.
    function updateCamera() {
      const fov = 2 * Math.atan(state.height / 2 / (FOCAL_BASE * state.zoom));
      camera.fov = THREE.MathUtils.radToDeg(fov);
      camera.aspect = state.width / Math.max(1, state.height);
      camera.updateProjectionMatrix();
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      state.width = Math.max(1, rect.width);
      state.height = Math.max(1, rect.height);
      renderer.setSize(state.width, state.height, false);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      overlay.width = Math.floor(state.width * dpr);
      overlay.height = Math.floor(state.height * dpr);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateCamera();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

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

      octx.fillStyle = "rgba(255,255,255,0.55)";
      octx.beginPath();
      octx.arc(ox, oy, 1.8, 0, Math.PI * 2);
      octx.fill();

      octx.lineWidth = 1.4;
      octx.font = "10px ui-monospace, monospace";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      for (const t of tips) {
        const depthNorm = Math.max(0, Math.min(1, (t.z + 1) / 2));
        const near = 1 - depthNorm;
        const alpha = 0.35 + near * 0.55;
        octx.strokeStyle = `rgba(${t.rgb}, ${alpha})`;
        octx.beginPath();
        octx.moveTo(ox, oy);
        octx.lineTo(t.sx, t.sy);
        octx.stroke();
        const lx = ox + (t.sx - ox) * 1.28;
        const ly = oy + (t.sy - oy) * 1.28;
        octx.fillStyle = `rgba(${t.rgb}, ${Math.min(1, alpha + 0.2)})`;
        octx.fillText(t.label, lx, ly);
      }
    }

    function drawOverlay() {
      octx.clearRect(0, 0, state.width, state.height);
      if (chromeHiddenRef.current) return;
      drawGnomon();
      const traj = trajRef.current;
      if (!traj) return;
      octx.fillStyle = "rgba(255,255,255,0.45)";
      octx.font = "11px ui-monospace, monospace";
      octx.textAlign = "right";
      octx.textBaseline = "alphabetic";
      octx.fillText(
        `${attractorRef.current.label}   ${traj.count.toLocaleString("tr")} adım`,
        state.width - 16,
        state.height - 18,
      );
    }

    function render() {
      syncTrajectory();

      const cy = Math.cos(state.yaw);
      const sy = Math.sin(state.yaw);
      const cp = Math.cos(state.pitch);
      const sp = Math.sin(state.pitch);
      // Eski projeksiyon: once y ekseninde yaw, sonra x ekseninde pitch,
      // derinlik kameradan uzaga dogru pozitif. three'de kamera -z'ye baktigi
      // icin son satir ters isaretli.
      line.matrix.set(
        cy, 0, -sy, 0,
        -sp * sy, cp, -sp * cy, 0,
        -cp * sy, -sp, -cp * cy, 0,
        0, 0, 0, 1,
      );
      line.matrixWorldNeedsUpdate = true;

      updateCamera();
      renderer.render(scene, camera);
      drawOverlay();
    }

    // Donus ve momentum 60 Hz kare birimiyle yazili; frames ile olcekleniyor.
    // Onceden kare basina uygulaniyordu, 144 Hz ekranda 2.4 kat hizli
    // donuyor ve momentum daha cabuk sonuyordu.
    let raf = 0;
    let prevT = 0;
    function loop(now) {
      const dt = prevT ? Math.min(0.1, (now - prevT) / 1000) : 0;
      prevT = now;
      const frames = dt * 60;
      const idle = !state.dragging && now - state.lastInteractT > 2500;
      if (idle) {
        state.yaw += 0.0015 * frames;
      } else if (!state.dragging) {
        state.yaw += state.vy * frames;
        state.pitch += state.vp * frames;
        const decay = Math.pow(0.95, frames);
        state.vy *= decay;
        state.vp *= decay;
      }
      state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
      render();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function onDown(e) {
      container.setPointerCapture?.(e.pointerId);
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
      container.releasePointerCapture?.(e.pointerId);
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

    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      container.removeEventListener("wheel", onWheel);
      line.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none select-none"
        style={{ cursor: "grab" }}
      />
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {!ready && (
        <div className="fixed inset-0 flex items-center justify-center text-[12px] text-white/55 pointer-events-none">
          Yörünge hesaplanıyor...
        </div>
      )}

      <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-2 items-start">
        <div data-chrome className="text-[12px] text-white/60 px-1 pointer-events-none">
          Sürükleyerek döndür, tekerlekle yakınlaş.
        </div>
        <LabOptionBar options={ATTRACTOR_OPTIONS} active={active} onSelect={setActive} />
      </div>
    </div>
  );
}
