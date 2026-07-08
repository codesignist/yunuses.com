"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const HEAD_PROFILES = [
  [-14, 10],
  [-7,  17],
  [0,   22],
  [10,  25],
  [22,  26],
  [38,  24],
  [55,  19],
  [72,  13],
  [88,   7],
  [100,  2],
];
const N_HEAD_RINGS = HEAD_PROFILES.length;
const N_HEAD_FACETS = 16;

const N_SEGS = 48;
const SEG_LEN = 16;
const SEG_GAP = 5;
const CHAIN_DIST = SEG_LEN + SEG_GAP;
const N_FACETS = 16;
const IDLE_DELAY = 1500;
const Z_AMP = 200;

const MAX_BEND_RAD = (25 * Math.PI) / 180;
const MAX_BEND_COS = Math.cos(MAX_BEND_RAD);
const MAX_BEND_SIN = Math.sin(MAX_BEND_RAD);

const BODY_R = 20;
const TAPER_START = 0.7;

function radiusAt(t) {
  if (t < TAPER_START) return BODY_R;
  const k = (t - TAPER_START) / (1 - TAPER_START);
  return Math.max(2, BODY_R * (1 - k * k));
}

const STYLES = {
  golge: {
    label: "Gölge",
    body: 0x141a22,
    emissive: 0x000000,
    emissiveIntensity: 0,
    light: 0xb6bccc,
    lightIntensity: 1.1,
    ambient: 0x10141c,
    ambientIntensity: 0.3,
    bg: ["#181f2c", "#080c14"],
    mane: [0x010204, 0x05070b, 0x0c0e12],
    limb: 0x080a0e,
    eye: { color: 0xeaf4ff, emissive: 0xa8c8f0, intensity: 1.2, halo: 0.22 },
    pbr: "shadow",
  },
  altin: {
    label: "Altın",
    body: 0xc8941a,
    emissive: 0x402000,
    emissiveIntensity: 0.18,
    light: 0xfff0c8,
    lightIntensity: 1.25,
    ambient: 0x2a1c08,
    ambientIntensity: 0.4,
    bg: ["#1a1408", "#0a0602"],
    mane: [0x3a2000, 0xb87614, 0xffd870],
    maneCounts: [210, 190, 160],
    limb: 0x2a1800,
    eye: { color: 0xfff4c0, emissive: 0xffc040, intensity: 1.4, halo: 0.26 },
    pbr: "gold",
    maneFlame: true,
  },
  cam: {
    label: "Cam",
    body: 0xb8d8e4,
    emissive: 0x0a1a26,
    emissiveIntensity: 0,
    light: 0xeaf6ff,
    lightIntensity: 1.35,
    ambient: 0x1a2a3a,
    ambientIntensity: 0.55,
    bg: ["#0c1a26", "#03080e"],
    mane: [0x1a3848, 0x6a98a8, 0xc0e0e8],
    maneCounts: [210, 190, 160],
    limb: 0x4a78a0,
    eye: { color: 0xe0f4f8, emissive: 0x60b8d8, intensity: 1.3, halo: 0.24 },
    pbr: "glass",
  },
};

const MANE_LAYERS = [
  { count: 460, lenMult: 0.95, baseOff: -0.05, lateralAmp: 0.55, lift: 0.4, alpha: 0.7, seed: 1, colorIdx: 0 },
  { count: 420, lenMult: 1.05, baseOff: 0.05, lateralAmp: 0.4, lift: 0.55, alpha: 0.7, seed: 1000, colorIdx: 1 },
  { count: 350, lenMult: 1.15, baseOff: 0.1, lateralAmp: 0.25, lift: 0.7, alpha: 0.75, seed: 2000, colorIdx: 2 },
];

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const MANE_FIRE_VS = `
  attribute float aTip;
  varying float vTip;
  varying vec3 vWorldPos;
  void main() {
    vTip = aTip;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const MANE_FIRE_FS = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColorBase;
  uniform vec3 uColorMid;
  uniform vec3 uColorTip;
  uniform float uIntensity;
  varying float vTip;
  varying vec3 vWorldPos;

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash3(i);
    float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += vnoise(p) * a;
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 np = vWorldPos * 0.09 + vec3(uTime * 0.6, -uTime * 1.8, uTime * 0.4);
    float n = fbm(np);
    float heat = vTip + (n - 0.5) * 0.45;
    heat = clamp(heat, 0.0, 1.0);

    vec3 col = mix(uColorBase, uColorMid, smoothstep(0.0, 0.55, heat));
    col = mix(col, uColorTip, smoothstep(0.55, 1.0, heat));
    col += uColorTip * pow(heat, 5.0) * 0.7;

    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

const LEG_DEFS = [
  { segIdx: 6, side: -1 },
  { segIdx: 6, side: 1 },
  { segIdx: 31, side: -1 },
  { segIdx: 31, side: 1 },
];

const N_WHISKER_RINGS = 18;
const N_WHISKER_FACETS = 6;
const N_WHISKER_SPAN = 14;
const WHISKER_DEFS = [
  { side: -1, phase: 0 },
  { side: 1, phase: 0.9 },
];

const cosW = new Float32Array(N_WHISKER_FACETS);
const sinW = new Float32Array(N_WHISKER_FACETS);
for (let k = 0; k < N_WHISKER_FACETS; k++) {
  const a = (k / N_WHISKER_FACETS) * Math.PI * 2;
  cosW[k] = Math.cos(a);
  sinW[k] = Math.sin(a);
}

const TUBE_SCRATCH_MAX = N_WHISKER_RINGS;
const _tx = new Float32Array(TUBE_SCRATCH_MAX);
const _ty = new Float32Array(TUBE_SCRATCH_MAX);
const _tz = new Float32Array(TUBE_SCRATCH_MAX);
const _ux = new Float32Array(TUBE_SCRATCH_MAX);
const _uy = new Float32Array(TUBE_SCRATCH_MAX);
const _uz = new Float32Array(TUBE_SCRATCH_MAX);

function buildTubeGeom(nRings, nFacets) {
  const positions = new Float32Array(nRings * nFacets * 3);
  const normals = new Float32Array(nRings * nFacets * 3);
  const indices = new Uint32Array((nRings - 1) * nFacets * 6);
  let ii = 0;
  for (let i = 0; i < nRings - 1; i++) {
    for (let k = 0; k < nFacets; k++) {
      const k2 = (k + 1) % nFacets;
      const a = i * nFacets + k;
      const b = i * nFacets + k2;
      const c = (i + 1) * nFacets + k2;
      const d = (i + 1) * nFacets + k;
      indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

function updateTubeRings(geom, pts, radii, nRings, nFacets, cosTab, sinTab, refUx, refUy, refUz) {
  const pos = geom.attributes.position.array;
  const nrm = geom.attributes.normal.array;

  for (let i = 0; i < nRings; i++) {
    const pi = Math.max(0, i - 1) * 3;
    const ni = Math.min(nRings - 1, i + 1) * 3;
    let dx = pts[ni] - pts[pi];
    let dy = pts[ni + 1] - pts[pi + 1];
    let dz = pts[ni + 2] - pts[pi + 2];
    const l = Math.hypot(dx, dy, dz) || 1;
    _tx[i] = dx / l;
    _ty[i] = dy / l;
    _tz[i] = dz / l;
  }

  let ux = refUx, uy = refUy, uz = refUz;
  let dot0 = ux * _tx[0] + uy * _ty[0] + uz * _tz[0];
  ux -= dot0 * _tx[0];
  uy -= dot0 * _ty[0];
  uz -= dot0 * _tz[0];
  let ul = Math.hypot(ux, uy, uz);
  if (ul < 0.01) {
    if (Math.abs(_tx[0]) < 0.9) { ux = 1; uy = 0; uz = 0; }
    else { ux = 0; uy = 1; uz = 0; }
    dot0 = ux * _tx[0] + uy * _ty[0] + uz * _tz[0];
    ux -= dot0 * _tx[0]; uy -= dot0 * _ty[0]; uz -= dot0 * _tz[0];
    ul = Math.hypot(ux, uy, uz) || 1;
  }
  _ux[0] = ux / ul;
  _uy[0] = uy / ul;
  _uz[0] = uz / ul;

  for (let i = 1; i < nRings; i++) {
    const t1x = _tx[i - 1], t1y = _ty[i - 1], t1z = _tz[i - 1];
    const t2x = _tx[i], t2y = _ty[i], t2z = _tz[i];
    const ax = t1y * t2z - t1z * t2y;
    const ay = t1z * t2x - t1x * t2z;
    const az = t1x * t2y - t1y * t2x;
    const al = Math.hypot(ax, ay, az);
    let nUx = _ux[i - 1], nUy = _uy[i - 1], nUz = _uz[i - 1];
    if (al > 1e-6) {
      const c = t1x * t2x + t1y * t2y + t1z * t2z;
      const angle = Math.atan2(al, c);
      const cs = Math.cos(angle);
      const sn = Math.sin(angle);
      const nax = ax / al, nay = ay / al, naz = az / al;
      const dotAU = nax * nUx + nay * nUy + naz * nUz;
      const rxx = nUx * cs + (nay * nUz - naz * nUy) * sn + nax * dotAU * (1 - cs);
      const ryy = nUy * cs + (naz * nUx - nax * nUz) * sn + nay * dotAU * (1 - cs);
      const rzz = nUz * cs + (nax * nUy - nay * nUx) * sn + naz * dotAU * (1 - cs);
      nUx = rxx; nUy = ryy; nUz = rzz;
    }
    const dot = nUx * t2x + nUy * t2y + nUz * t2z;
    nUx -= dot * t2x; nUy -= dot * t2y; nUz -= dot * t2z;
    const l = Math.hypot(nUx, nUy, nUz) || 1;
    _ux[i] = nUx / l;
    _uy[i] = nUy / l;
    _uz[i] = nUz / l;
  }

  for (let i = 0; i < nRings; i++) {
    const tX = _tx[i], tY = _ty[i], tZ = _tz[i];
    const uX = _ux[i], uY = _uy[i], uZ = _uz[i];
    const rX = tY * uZ - tZ * uY;
    const rY = tZ * uX - tX * uZ;
    const rZ = tX * uY - tY * uX;
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2];
    const r = radii[i];
    for (let k = 0; k < nFacets; k++) {
      const ck = cosTab[k];
      const sk = sinTab[k];
      const nx = ck * rX + sk * uX;
      const ny = ck * rY + sk * uY;
      const nz = ck * rZ + sk * uZ;
      const idx = (i * nFacets + k) * 3;
      pos[idx] = px + nx * r;
      pos[idx + 1] = py + ny * r;
      pos[idx + 2] = pz + nz * r;
      nrm[idx] = nx;
      nrm[idx + 1] = ny;
      nrm[idx + 2] = nz;
    }
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.normal.needsUpdate = true;
}

export default function Dragon() {
  const containerRef = useRef(null);
  const branchRef = useRef(null);
  const [active, setActive] = useState("golge");
  const activeRef = useRef("golge");
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // 1 / 2 / 3 tuslari ile stil degistir (Golge / Altin / Cam)
  useEffect(() => {
    const ids = Object.keys(STYLES);
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < ids.length) setActive(ids[idx]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0;
    let curX = 0, curY = 0;
    const MAX = 9;

    function onMove(e) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;
      tx = -nx * MAX;
      ty = -ny * MAX;
    }
    function onTouch(e) {
      if (!e.touches || !e.touches[0]) return;
      onMove(e.touches[0]);
    }
    function tick() {
      curX += (tx - curX) * 0.06;
      curY += (ty - curY) * 0.06;
      const el = branchRef.current;
      if (el) {
        el.style.transform = `scale(1.06) translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const initRect = container.getBoundingClientRect();
    renderer.setSize(initRect.width, initRect.height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      initRect.width / Math.max(1, initRect.height),
      1,
      5000,
    );
    camera.position.set(0, 0, 1150);
    camera.lookAt(0, 0, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(440, 290, 320);
    scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambLight);

    const positions = new Float32Array(N_SEGS * N_FACETS * 3);
    const normals = new Float32Array(N_SEGS * N_FACETS * 3);
    const uvs = new Float32Array(N_SEGS * N_FACETS * 2);
    for (let i = 0; i < N_SEGS; i++) {
      for (let k = 0; k < N_FACETS; k++) {
        const u = i / (N_SEGS - 1);
        const v = k / N_FACETS;
        const idx = (i * N_FACETS + k) * 2;
        uvs[idx] = u;
        uvs[idx + 1] = v;
      }
    }
    const indices = new Uint32Array((N_SEGS - 1) * N_FACETS * 6);
    let ii = 0;
    for (let i = 0; i < N_SEGS - 1; i++) {
      for (let k = 0; k < N_FACETS; k++) {
        const k2 = (k + 1) % N_FACETS;
        const a = i * N_FACETS + k;
        const b = i * N_FACETS + k2;
        const c = (i + 1) * N_FACETS + k2;
        const d = (i + 1) * N_FACETS + k;
        indices[ii++] = a;
        indices[ii++] = b;
        indices[ii++] = c;
        indices[ii++] = a;
        indices[ii++] = c;
        indices[ii++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x141a22,
      shininess: 12,
      specular: 0x1a2030,
      flatShading: false,
      side: THREE.FrontSide,
    });
    const body = new THREE.Mesh(geo, bodyMat);
    // Gövde her zaman sahnenin merkezinde; frustum culling kapatınca
    // her frame computeBoundingSphere cagrisina gerek kalmiyor.
    body.frustumCulled = false;
    scene.add(body);

    const maneLayerData = MANE_LAYERS.map((layer) => {
      const params = [];
      for (let i = 0; i < layer.count; i++) {
        const idx = i + layer.seed;
        params.push({
          baseT: hash(idx),
          lateralRand: (hash(idx + 73) - 0.5) * 2,
          lenRand: 0.65 + hash(idx + 149) * 0.7,
          widthRand: 1.7 + hash(idx + 211) * 1.2,
          phaseRand: hash(idx + 307) * Math.PI * 2,
          rotAngle: hash(idx + 401) * Math.PI * 2,
          tipTilt: (hash(idx + 547) - 0.5) * 1.4,
        });
      }
      const mPos = new Float32Array(layer.count * 12);
      const mCol = new Float32Array(layer.count * 12);
      const mTip = new Float32Array(layer.count * 4);
      const mIdx = new Uint32Array(layer.count * 12);
      for (let i = 0; i < layer.count; i++) {
        const v0 = i * 4;
        const v1 = v0 + 1;
        const v2 = v0 + 2;
        const v3 = v0 + 3;
        mTip[v0] = 0; mTip[v1] = 0; mTip[v2] = 0; mTip[v3] = 1;
        const o = i * 12;
        mIdx[o] = v0;     mIdx[o + 1] = v1;  mIdx[o + 2] = v2;
        mIdx[o + 3] = v0; mIdx[o + 4] = v3;  mIdx[o + 5] = v1;
        mIdx[o + 6] = v1; mIdx[o + 7] = v3;  mIdx[o + 8] = v2;
        mIdx[o + 9] = v2; mIdx[o + 10] = v3; mIdx[o + 11] = v0;
      }
      const mGeo = new THREE.BufferGeometry();
      mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
      mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3));
      mGeo.setAttribute("aTip", new THREE.BufferAttribute(mTip, 1));
      mGeo.setIndex(new THREE.BufferAttribute(mIdx, 1));
      const mMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: layer.alpha,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(mGeo, mMat);
      mesh.renderOrder = 10 + layer.colorIdx;
      scene.add(mesh);
      return { layer, params, geom: mGeo, mat: mMat, mesh };
    });

    const limbMat = new THREE.MeshPhongMaterial({
      color: 0x080a0e,
      shininess: 8,
      specular: 0x0a0c10,
      side: THREE.FrontSide,
    });

    const goldBodyMat = new THREE.MeshStandardMaterial({
      color: 0xffd070,
      metalness: 1.0,
      roughness: 0.22,
      envMapIntensity: 1.4,
    });
    const goldHeadMat = new THREE.MeshStandardMaterial({
      color: 0xffd070,
      metalness: 1.0,
      roughness: 0.26,
      envMapIntensity: 1.3,
    });
    const goldLimbMat = new THREE.MeshStandardMaterial({
      color: 0xa07820,
      metalness: 1.0,
      roughness: 0.4,
      envMapIntensity: 1.0,
    });

    const shadowBodyMat = new THREE.MeshStandardMaterial({
      color: 0x161c26,
      metalness: 0.22,
      roughness: 0.42,
      envMapIntensity: 0.55,
    });
    const shadowHeadMat = new THREE.MeshStandardMaterial({
      color: 0x161c26,
      metalness: 0.26,
      roughness: 0.38,
      envMapIntensity: 0.6,
    });
    const shadowLimbMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      metalness: 0.18,
      roughness: 0.55,
      envMapIntensity: 0.4,
    });

    const glassBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xd0e4ec,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.95,
      thickness: 1.5,
      ior: 1.5,
      attenuationColor: new THREE.Color(0x4a90a8),
      attenuationDistance: 22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });
    const glassHeadMat = new THREE.MeshPhysicalMaterial({
      color: 0xd0e4ec,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.95,
      thickness: 1.5,
      ior: 1.5,
      attenuationColor: new THREE.Color(0x4a90a8),
      attenuationDistance: 22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });
    // Kollar/bacaklar govde/kafa ile ayni cam gorunumu icin ayni optik
    // parametreleri kullaniyor. thickness govdeye (1.5) gore biraz yuksek
    // tutuldu (masif hacim oldugu icin), geri kalan her sey esit.
    const glassLimbMat = new THREE.MeshPhysicalMaterial({
      color: 0xd0e4ec,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.95,
      thickness: 3,
      ior: 1.5,
      attenuationColor: new THREE.Color(0x4a90a8),
      attenuationDistance: 22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });

    const pbrMatSets = {
      gold: { body: goldBodyMat, head: goldHeadMat, limb: goldLimbMat },
      shadow: { body: shadowBodyMat, head: shadowHeadMat, limb: shadowLimbMat },
      glass: { body: glassBodyMat, head: glassHeadMat, limb: glassLimbMat },
    };

    const scaleBumpCanvas = document.createElement("canvas");
    scaleBumpCanvas.width = 256;
    scaleBumpCanvas.height = 256;
    {
      const ctx = scaleBumpCanvas.getContext("2d");
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 256, 256);
      const COLS = 12;
      const ROWS = 14;
      const cellW = 256 / COLS;
      const cellH = 256 / ROWS;
      for (let r = -1; r <= ROWS + 1; r++) {
        for (let col = -1; col <= COLS + 1; col++) {
          const offX = (((r % 2) + 2) % 2) * cellW * 0.5;
          const cx = col * cellW + offX + cellW * 0.5;
          const cy = r * cellH + cellH * 0.5;
          const grad = ctx.createRadialGradient(
            cx,
            cy - cellH * 0.18,
            1,
            cx,
            cy,
            cellW * 0.62,
          );
          grad.addColorStop(0, "#f4f4f4");
          grad.addColorStop(0.55, "#929292");
          grad.addColorStop(1, "#1e1e1e");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(cx, cy, cellW * 0.6, cellH * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const scaleBumpTex = new THREE.CanvasTexture(scaleBumpCanvas);
    scaleBumpTex.wrapS = THREE.RepeatWrapping;
    scaleBumpTex.wrapT = THREE.RepeatWrapping;
    scaleBumpTex.repeat.set(14, 2);
    scaleBumpTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    bodyMat.bumpMap = scaleBumpTex;
    bodyMat.bumpScale = 1.6;
    bodyMat.needsUpdate = true;
    goldBodyMat.bumpMap = scaleBumpTex;
    goldBodyMat.bumpScale = 1.4;
    goldBodyMat.needsUpdate = true;
    shadowBodyMat.bumpMap = scaleBumpTex;
    shadowBodyMat.bumpScale = 1.5;
    shadowBodyMat.needsUpdate = true;

    let envDisposed = false;
    let envRenderTarget = null;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTexLoader = new THREE.TextureLoader();
    envTexLoader.load("/lab/dragon/moon.jpg", (tex) => {
      if (envDisposed) {
        tex.dispose();
        return;
      }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      envRenderTarget = pmrem.fromEquirectangular(tex);
      const envMap = envRenderTarget.texture;
      scene.environment = envMap;
      for (const set of Object.values(pbrMatSets)) {
        set.body.envMap = envMap;
        set.head.envMap = envMap;
        set.limb.envMap = envMap;
        set.body.needsUpdate = true;
        set.head.needsUpdate = true;
        set.limb.needsUpdate = true;
      }
      tex.dispose();
    });

    const legData = LEG_DEFS.map((def) => ({ def, objWrap: null }));

    const headGroup = new THREE.Group();
    scene.add(headGroup);
    const headBasisR = new THREE.Vector3();
    const headBasisU = new THREE.Vector3();
    const headBasisF = new THREE.Vector3();
    const headBasisM = new THREE.Matrix4();

    const headPositions = new Float32Array(N_HEAD_RINGS * N_HEAD_FACETS * 3);
    const headIndices = [];
    for (let i = 0; i < N_HEAD_RINGS; i++) {
      const [hz, hr] = HEAD_PROFILES[i];
      for (let k = 0; k < N_HEAD_FACETS; k++) {
        const a = (k / N_HEAD_FACETS) * Math.PI * 2;
        const idx = (i * N_HEAD_FACETS + k) * 3;
        headPositions[idx] = Math.cos(a) * hr;
        headPositions[idx + 1] = Math.sin(a) * hr;
        headPositions[idx + 2] = hz;
      }
    }
    for (let i = 0; i < N_HEAD_RINGS - 1; i++) {
      for (let k = 0; k < N_HEAD_FACETS; k++) {
        const k2 = (k + 1) % N_HEAD_FACETS;
        const a = i * N_HEAD_FACETS + k;
        const b = i * N_HEAD_FACETS + k2;
        const c = (i + 1) * N_HEAD_FACETS + k2;
        const d = (i + 1) * N_HEAD_FACETS + k;
        headIndices.push(a, b, c, a, c, d);
      }
    }
    const headGeo = new THREE.BufferGeometry();
    headGeo.setAttribute("position", new THREE.BufferAttribute(headPositions, 3));
    headGeo.setIndex(headIndices);
    headGeo.computeVertexNormals();

    const headMat = new THREE.MeshPhongMaterial({
      color: 0x141a22,
      shininess: 12,
      specular: 0x1a2030,
      flatShading: true,
      side: THREE.FrontSide,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headGroup.add(headMesh);

    const hornMat = new THREE.MeshPhongMaterial({
      color: 0x080a0e,
      shininess: 6,
      flatShading: true,
    });
    const hornGeo = new THREE.ConeGeometry(3.5, 22, 6);
    function placeHorn(side) {
      const horn = new THREE.Mesh(hornGeo, hornMat);
      const baseX = side * 11;
      const baseY = 22;
      const baseZ = 20;
      const dx = side * 0.6;
      const dy = 1.2;
      const dz = -1.3;
      const dl = Math.hypot(dx, dy, dz);
      const ndx = dx / dl, ndy = dy / dl, ndz = dz / dl;
      const half = 11;
      horn.position.set(
        baseX + ndx * half,
        baseY + ndy * half,
        baseZ + ndz * half,
      );
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(ndx, ndy, ndz),
      );
      horn.quaternion.copy(q);
      headGroup.add(horn);
      return horn;
    }
    const leftHorn = placeHorn(-1);
    const rightHorn = placeHorn(1);

    const eyeMat = new THREE.MeshPhongMaterial({
      color: 0xfff0a0,
      emissive: 0xff8000,
      emissiveIntensity: 0.6,
      flatShading: true,
    });
    const eyeGeo = new THREE.SphereGeometry(5, 16, 12);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-13, -8, 53);
    leftEye.renderOrder = 5;
    headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(13, -8, 53);
    rightEye.renderOrder = 5;
    headGroup.add(rightEye);

    const eyeHaloCanvas = document.createElement("canvas");
    eyeHaloCanvas.width = 128;
    eyeHaloCanvas.height = 128;
    {
      const ctx = eyeHaloCanvas.getContext("2d");
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
      grad.addColorStop(0.3, "rgba(255,255,255,0.55)");
      grad.addColorStop(0.65, "rgba(255,255,255,0.18)");
      grad.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const eyeHaloTex = new THREE.CanvasTexture(eyeHaloCanvas);
    eyeHaloTex.colorSpace = THREE.SRGBColorSpace;

    const eyeHaloMat = new THREE.SpriteMaterial({
      map: eyeHaloTex,
      color: 0xff8000,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const leftEyeHalo = new THREE.Sprite(eyeHaloMat);
    leftEyeHalo.scale.set(95, 95, 1);
    leftEyeHalo.position.copy(leftEye.position);
    leftEyeHalo.renderOrder = 20;
    headGroup.add(leftEyeHalo);
    const rightEyeHalo = new THREE.Sprite(eyeHaloMat);
    rightEyeHalo.scale.set(95, 95, 1);
    rightEyeHalo.position.copy(rightEye.position);
    rightEyeHalo.renderOrder = 20;
    headGroup.add(rightEyeHalo);

    const breathCanvas = document.createElement("canvas");
    breathCanvas.width = 128;
    breathCanvas.height = 128;
    {
      const ctx = breathCanvas.getContext("2d");
      const grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
      grad.addColorStop(0.0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
      grad.addColorStop(0.75, "rgba(255,255,255,0.12)");
      grad.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const imgData = ctx.getImageData(0, 0, 128, 128);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 28;
        imgData.data[i + 3] = Math.max(0, Math.min(255, imgData.data[i + 3] + n));
      }
      ctx.putImageData(imgData, 0, 0);
    }
    const breathTex = new THREE.CanvasTexture(breathCanvas);
    breathTex.colorSpace = THREE.SRGBColorSpace;

    const MOUTH_FWD = 55;
    const MOUTH_DOWN = 40;

    const BREATH_POOL = 500;
    const BREATH_CYCLE = 3.8;
    const BREATH_EXHALE_DUR = 1.2;
    const BREATH_BURST_COUNT = 80;
    const breathParticles = [];
    for (let i = 0; i < BREATH_POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: breathTex,
        color: 0xeaf2ff,
        transparent: true,
        opacity: 0,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 15;
      scene.add(sprite);
      breathParticles.push({
        sprite,
        mat,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: -1,
        maxLife: 0,
        sizeStart: 0,
        sizeEnd: 0,
      });
    }
    let breathEmitTimer = 0;
    let prevStepTime = -1;
    let prevHeadX = 0, prevHeadY = 0, prevHeadZ = 0;
    let headVx = 0, headVy = 0, headVz = 0;

    function emitBreathParticle() {
      let p = null;
      for (const cand of breathParticles) {
        if (cand.life < 0) { p = cand; break; }
      }
      if (!p) return;
      const h = segs[0];
      const fX = -h.tx, fY = -h.ty, fZ = -h.tz;
      const uX = h.ux, uY = h.uy, uZ = h.uz;
      const rX = h.rx, rY = h.ry, rZ = h.rz;
      p.x = h.x + fX * MOUTH_FWD - uX * MOUTH_DOWN;
      p.y = h.y + fY * MOUTH_FWD - uY * MOUTH_DOWN;
      p.z = h.z + fZ * MOUTH_FWD - uZ * MOUTH_DOWN;
      const fwdSpeed = 400 + Math.random() * 80;
      const upSpeed = -240 + Math.random() * 10;
      const latSpread = (Math.random() - 0.5) * 18;
      p.vx = fX * fwdSpeed + uX * upSpeed + rX * latSpread + headVx;
      p.vy = fY * fwdSpeed + uY * upSpeed + rY * latSpread + headVy;
      p.vz = fZ * fwdSpeed + uZ * upSpeed + rZ * latSpread + headVz;
      p.life = 0;
      p.maxLife = 1.4 + Math.random() * 0.8;
      p.sizeStart = 50 + Math.random() * 12;
      p.sizeEnd = 360 + Math.random() * 60;
      p.sprite.position.set(p.x, p.y, p.z);
      p.sprite.scale.set(p.sizeStart, p.sizeStart, 1);
      p.mat.opacity = 0;
      p.sprite.visible = true;
    }

    const objHeadMat = new THREE.MeshPhongMaterial({
      color: 0x141a22,
      shininess: 18,
      specular: 0x232a36,
      flatShading: false,
      side: THREE.FrontSide,
    });
    let objHeadWrap = null;
    let objHeadDisposed = false;

    const objLoader = new OBJLoader();
    objLoader.load(
      "/lab/dragon/dragon.obj",
      (loaded) => {
        if (objHeadDisposed) return;
        const curStyle = STYLES[activeRef.current];
        const curPbr = curStyle?.pbr ? pbrMatSets[curStyle.pbr] : null;
        const startMat = curPbr ? curPbr.head : objHeadMat;
        loaded.traverse((c) => {
          if (c.isMesh) {
            c.material = startMat;
            c.castShadow = false;
            c.receiveShadow = false;
            if (c.geometry) {
              c.geometry.computeVertexNormals();
            }
          }
        });

        const box = new THREE.Box3().setFromObject(loaded);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const TARGET_LEN = 230;
        const longest = Math.max(size.x, size.y, size.z) || 1;
        const scale = TARGET_LEN / longest;

        loaded.position.set(-center.x, -center.y, -center.z);

        const wrap = new THREE.Group();
        wrap.add(loaded);
        wrap.scale.setScalar(scale);
        wrap.rotation.y = Math.PI / 2;
        wrap.position.set(0, 0, -20);

        headMesh.visible = false;
        leftHorn.visible = false;
        rightHorn.visible = false;

        headGroup.add(wrap);
        objHeadWrap = wrap;
      },
      undefined,
      (err) => {
        console.warn("Dragon head OBJ load failed:", err);
      },
    );

    let objLimbDisposed = false;
    const objLimbGeomsBase = [];
    const objLimbGeomsMirror = [];
    const objLimbMeshes = [];

    function mirrorGeomX(srcGeom) {
      const g = srcGeom.clone();
      const pos = g.attributes.position;
      const a = pos.array;
      for (let i = 0; i < a.length; i += 3) a[i] = -a[i];
      pos.needsUpdate = true;
      if (g.index) {
        const ia = g.index.array;
        for (let i = 0; i < ia.length; i += 3) {
          const t = ia[i]; ia[i] = ia[i + 2]; ia[i + 2] = t;
        }
        g.index.needsUpdate = true;
      }
      g.computeVertexNormals();
      return g;
    }

    const objLimbLoader = new OBJLoader();
    objLimbLoader.load(
      "/lab/dragon/limb.obj",
      (loaded) => {
        if (objLimbDisposed) return;
        const sourceGeoms = [];
        loaded.traverse((c) => {
          if (c.isMesh && c.geometry) {
            // OBJLoader indekssiz geometri uretir ve OBJ'de vn olmasa bile
            // per-face (duz) bir normal attribute ekler. mergeVertices normalleri
            // de hash'ledigi icin ayni pozisyondaki vertexleri kaynatmaz (4086->4033).
            // Once normali silip pozisyona gore kaynatiyoruz (4086->731), sonra
            // computeVertexNormals ile ortalanmis yumusak normaller uretiyoruz.
            c.geometry.deleteAttribute("normal");
            const smoothed = mergeVertices(c.geometry);
            smoothed.computeVertexNormals();
            sourceGeoms.push(smoothed);
          }
        });
        if (sourceGeoms.length === 0) return;

        for (const sg of sourceGeoms) {
          objLimbGeomsBase.push(sg);
          objLimbGeomsMirror.push(mirrorGeomX(sg));
        }

        const curStyle = STYLES[activeRef.current];
        const curPbr = curStyle?.pbr ? pbrMatSets[curStyle.pbr] : null;
        const startMat = curPbr ? curPbr.limb : limbMat;

        for (const leg of legData) {
          const wrap = new THREE.Group();
          const useGeoms = leg.def.side === 1 ? objLimbGeomsMirror : objLimbGeomsBase;
          for (const g of useGeoms) {
            const mesh = new THREE.Mesh(g, startMat);
            mesh.frustumCulled = false;
            wrap.add(mesh);
            objLimbMeshes.push(mesh);
          }
          scene.add(wrap);
          leg.objWrap = wrap;
        }
      },
      undefined,
      (err) => {
        console.warn("Dragon limb OBJ load failed:", err);
      },
    );

    const whiskerData = WHISKER_DEFS.map((def) => {
      const geom = buildTubeGeom(N_WHISKER_RINGS, N_WHISKER_FACETS);
      const mesh = new THREE.Mesh(geom, limbMat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return {
        def,
        geom,
        mesh,
        pts: new Float32Array(N_WHISKER_RINGS * 3),
        radii: new Float32Array(N_WHISKER_RINGS),
      };
    });

    const maneFireMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
        uColorBase: { value: new THREE.Color(0x6a1800) },
        uColorMid: { value: new THREE.Color(0xff5a14) },
        uColorTip: { value: new THREE.Color(0xfff080) },
      },
      vertexShader: MANE_FIRE_VS,
      fragmentShader: MANE_FIRE_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    const cosA = new Float32Array(N_FACETS);
    const sinA = new Float32Array(N_FACETS);
    for (let k = 0; k < N_FACETS; k++) {
      const a = (k / N_FACETS) * Math.PI * 2;
      cosA[k] = Math.cos(a);
      sinA[k] = Math.sin(a);
    }

    const segs = [];
    for (let i = 0; i < N_SEGS; i++) {
      segs.push({
        x: -i * CHAIN_DIST,
        y: 0,
        z: 0,
        tx: 1,
        ty: 0,
        tz: 0,
        ux: 0,
        uy: 1,
        uz: 0,
        rx: 0,
        ry: 0,
        rz: 1,
      });
    }

    const mouseNDC = new THREE.Vector2(0, 0);
    const mouse = { wx: 0, wy: 0, t: -Infinity, inside: false };
    const raycaster = new THREE.Raycaster();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planeHit = new THREE.Vector3();

    function updateMouseWorld() {
      raycaster.setFromCamera(mouseNDC, camera);
      if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
        mouse.wx = planeHit.x;
        mouse.wy = planeHit.y;
      }
    }

    function ndcFromEvent(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((clientX - r.left) / r.width) * 2 - 1;
      mouseNDC.y = -((clientY - r.top) / r.height) * 2 + 1;
    }

    function onMove(e) {
      ndcFromEvent(e.clientX, e.clientY);
      updateMouseWorld();
      mouse.t = performance.now();
      mouse.inside = true;
    }
    function onLeave() {
      mouse.inside = false;
    }
    function onTouch(e) {
      if (!e.touches || !e.touches[0]) return;
      ndcFromEvent(e.touches[0].clientX, e.touches[0].clientY);
      updateMouseWorld();
      mouse.t = performance.now();
      mouse.inside = true;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });

    function resize() {
      const r = container.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      updateMouseWorld();
    }
    window.addEventListener("resize", resize);

    const tmpColor = new THREE.Color();
    function applyStyle(s) {
      bodyMat.color.setHex(s.body);
      bodyMat.emissive.setHex(s.emissive);
      bodyMat.emissiveIntensity = s.emissiveIntensity;
      dirLight.color.setHex(s.light);
      dirLight.intensity = s.lightIntensity;
      ambLight.color.setHex(s.ambient);
      ambLight.intensity = s.ambientIntensity;
      limbMat.color.setHex(s.limb);
      headMat.color.setHex(s.body);
      headMat.emissive.setHex(s.emissive);
      headMat.emissiveIntensity = s.emissiveIntensity;
      objHeadMat.color.setHex(s.body);
      objHeadMat.emissive.setHex(s.emissive);
      objHeadMat.emissiveIntensity = s.emissiveIntensity;
      hornMat.color.setHex(s.limb);
      eyeMat.color.setHex(s.eye.color);
      eyeMat.emissive.setHex(s.eye.emissive);
      eyeMat.emissiveIntensity = s.eye.intensity;
      eyeHaloMat.color.setHex(s.eye.emissive);
      eyeHaloMat.opacity = s.eye.halo ?? 0.45;
      const pbrSet = s.pbr ? pbrMatSets[s.pbr] : null;
      if (pbrSet) {
        body.material = pbrSet.body;
        headMesh.material = pbrSet.head;
        if (objHeadWrap) {
          objHeadWrap.traverse((c) => {
            if (c.isMesh) c.material = pbrSet.head;
          });
        }
        leftHorn.material = pbrSet.limb;
        rightHorn.material = pbrSet.limb;
        for (const mesh of objLimbMeshes) {
          mesh.material = pbrSet.limb;
        }
      } else {
        body.material = bodyMat;
        headMesh.material = headMat;
        leftHorn.material = hornMat;
        rightHorn.material = hornMat;
        if (objHeadWrap) {
          objHeadWrap.traverse((c) => {
            if (c.isMesh) c.material = objHeadMat;
          });
        }
      }
      const bgTarget = container.parentElement || container;
      bgTarget.style.background = `linear-gradient(to bottom, ${s.bg[0]} 0%, ${s.bg[1]} 100%)`;
      const useManeFlame = !!s.maneFlame;
      for (const data of maneLayerData) {
        data.mesh.visible = true;
        data.mesh.material = useManeFlame ? maneFireMat : data.mat;
        tmpColor.setHex(s.mane[data.layer.colorIdx]);
        const colArr = data.geom.attributes.color.array;
        const n = data.layer.count * 4;
        for (let v = 0; v < n; v++) {
          const off = v * 3;
          colArr[off] = tmpColor.r;
          colArr[off + 1] = tmpColor.g;
          colArr[off + 2] = tmpColor.b;
        }
        data.geom.attributes.color.needsUpdate = true;
        const drawCount = s.maneCounts ? s.maneCounts[data.layer.colorIdx] : data.layer.count;
        if (drawCount < data.layer.count) {
          const posArr = data.geom.attributes.position.array;
          for (let i = drawCount; i < data.layer.count; i++) {
            const off = i * 12;
            for (let j = 0; j < 12; j++) posArr[off + j] = 0;
          }
          data.geom.attributes.position.needsUpdate = true;
        }
      }
    }
    let currentStyleId = active;
    applyStyle(STYLES[active]);

    let idleBlend = 1;
    const HEAD_LERP = 0.045;
    let raf = 0;

    function step(now) {
      if (activeRef.current !== currentStyleId) {
        currentStyleId = activeRef.current;
        applyStyle(STYLES[currentStyleId]);
      }
      const style = STYLES[currentStyleId];

      const sinceMouse = now - mouse.t;
      const wantIdle = sinceMouse > IDLE_DELAY || !mouse.inside;
      idleBlend += (wantIdle ? 1 : -1) * 0.018;
      if (idleBlend < 0) idleBlend = 0;
      if (idleBlend > 1) idleBlend = 1;

      const ampX = 550;
      const ampY = 320;
      const driftCx = ampX * 0.6 * Math.sin(now * 0.00014);
      const driftCy = ampY * 0.6 * Math.cos(now * 0.00018 + 1.7);
      const idleCx = driftCx + ampX * 0.55 * Math.sin(now * 0.00082);
      const idleCy = driftCy + ampY * 0.55 * Math.sin(now * 0.00082 + 1.2);

      const tx = mouse.wx + (idleCx - mouse.wx) * idleBlend;
      const ty = mouse.wy + (idleCy - mouse.wy) * idleBlend;

      const head = segs[0];
      head.x += (tx - head.x) * HEAD_LERP;
      head.y += (ty - head.y) * HEAD_LERP;
      head.z = Math.sin(now * 0.00095) * Z_AMP;

      for (let i = 1; i < N_SEGS; i++) {
        const a = segs[i - 1];
        const b = segs[i];
        const tb = i / (N_SEGS - 1);
        const cd = CHAIN_DIST * Math.max(0.25, radiusAt(tb) / BODY_R);

        let dirX = b.x - a.x;
        let dirY = b.y - a.y;
        let dirZ = b.z - a.z;
        const dl = Math.hypot(dirX, dirY, dirZ) || 1;
        dirX /= dl; dirY /= dl; dirZ /= dl;

        let inX, inY, inZ;
        if (i === 1) {
          inX = segs[0].tx; inY = segs[0].ty; inZ = segs[0].tz;
        } else {
          const aa = segs[i - 2];
          inX = a.x - aa.x;
          inY = a.y - aa.y;
          inZ = a.z - aa.z;
          const il = Math.hypot(inX, inY, inZ) || 1;
          inX /= il; inY /= il; inZ /= il;
        }

        const cosA = inX * dirX + inY * dirY + inZ * dirZ;
        if (cosA < MAX_BEND_COS) {
          let axX = inY * dirZ - inZ * dirY;
          let axY = inZ * dirX - inX * dirZ;
          let axZ = inX * dirY - inY * dirX;
          const axL = Math.hypot(axX, axY, axZ);
          if (axL > 1e-6) {
            axX /= axL; axY /= axL; axZ /= axL;
            const kxvX = axY * inZ - axZ * inY;
            const kxvY = axZ * inX - axX * inZ;
            const kxvZ = axX * inY - axY * inX;
            dirX = inX * MAX_BEND_COS + kxvX * MAX_BEND_SIN;
            dirY = inY * MAX_BEND_COS + kxvY * MAX_BEND_SIN;
            dirZ = inZ * MAX_BEND_COS + kxvZ * MAX_BEND_SIN;
          }
        }

        b.x = a.x + dirX * cd;
        b.y = a.y + dirY * cd;
        b.z = a.z + dirZ * cd;
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
      let pUy = t0.uy * 0.985 + 1 * 0.015;
      let pUz = t0.uz * 0.985 + 0 * 0.015;
      const dotU0 = pUx * t0.tx + pUy * t0.ty + pUz * t0.tz;
      pUx -= dotU0 * t0.tx;
      pUy -= dotU0 * t0.ty;
      pUz -= dotU0 * t0.tz;
      const l0 = Math.hypot(pUx, pUy, pUz) || 1;
      t0.ux = pUx / l0;
      t0.uy = pUy / l0;
      t0.uz = pUz / l0;

      for (let i = 1; i < N_SEGS; i++) {
        const a = segs[i - 1];
        const b = segs[i];
        const t1x = a.tx, t1y = a.ty, t1z = a.tz;
        const t2x = b.tx, t2y = b.ty, t2z = b.tz;
        const ax_ = t1y * t2z - t1z * t2y;
        const ay_ = t1z * t2x - t1x * t2z;
        const az_ = t1x * t2y - t1y * t2x;
        const al = Math.hypot(ax_, ay_, az_);
        let ux = a.ux, uy = a.uy, uz = a.uz;
        if (al > 1e-6) {
          const c = t1x * t2x + t1y * t2y + t1z * t2z;
          const angle = Math.atan2(al, c);
          const cs = Math.cos(angle);
          const sn = Math.sin(angle);
          const nax = ax_ / al, nay = ay_ / al, naz = az_ / al;
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

      const pos = geo.attributes.position.array;
      const nrm = geo.attributes.normal.array;
      for (let i = 0; i < N_SEGS; i++) {
        const s = segs[i];
        const t = i / (N_SEGS - 1);
        const r = radiusAt(t);
        for (let k = 0; k < N_FACETS; k++) {
          const ck = cosA[k];
          const sk = sinA[k];
          const nx = ck * s.rx + sk * s.ux;
          const ny = ck * s.ry + sk * s.uy;
          const nz = ck * s.rz + sk * s.uz;
          const idx = (i * N_FACETS + k) * 3;
          pos[idx] = s.x + nx * r;
          pos[idx + 1] = s.y + ny * r;
          pos[idx + 2] = s.z + nz * r;
          nrm[idx] = nx;
          nrm[idx + 1] = ny;
          nrm[idx + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;

      eyeMat.emissiveIntensity = style.eye.intensity * (0.85 + 0.15 * Math.sin(now * 0.005));

      const maneStart = 0;
      const maneEnd = Math.min(N_SEGS - 4, 36);
      const maneRange = maneEnd - maneStart;
      for (const data of maneLayerData) {
        const { layer, params, geom } = data;
        const pos = geom.attributes.position.array;
        const drawCount = style.maneCounts ? style.maneCounts[layer.colorIdx] : layer.count;
        for (let i = 0; i < drawCount; i++) {
          const p = params[i];
          const segIdxF = maneStart + maneRange * p.baseT;
          const segI = Math.floor(segIdxF);
          if (segI >= N_SEGS - 2) continue;
          const segFrac = segIdxF - segI;
          const sA = segs[segI];
          const sB = segs[segI + 1];
          const f1 = 1 - segFrac;
          const f2 = segFrac;

          const tProg = segIdxF / (N_SEGS - 1);
          const r = radiusAt(tProg);

          const sx = sA.x * f1 + sB.x * f2;
          const sy = sA.y * f1 + sB.y * f2;
          const sz = sA.z * f1 + sB.z * f2;
          const sux = sA.ux * f1 + sB.ux * f2;
          const suy = sA.uy * f1 + sB.uy * f2;
          const suz = sA.uz * f1 + sB.uz * f2;
          const srx = sA.rx * f1 + sB.rx * f2;
          const sry = sA.ry * f1 + sB.ry * f2;
          const srz = sA.rz * f1 + sB.rz * f2;
          const stx = sA.tx * f1 + sB.tx * f2;
          const sty = sA.ty * f1 + sB.ty * f2;
          const stz = sA.tz * f1 + sB.tz * f2;

          const lateralOff = p.lateralRand * layer.lateralAmp * r;
          const baseUpFactor = 0.85 + layer.baseOff;
          const baseX = sx + sux * r * baseUpFactor + srx * lateralOff;
          const baseY = sy + suy * r * baseUpFactor + sry * lateralOff;
          const baseZ = sz + suz * r * baseUpFactor + srz * lateralOff;

          const strokeLen = r * 0.9 * p.lenRand * layer.lenMult * (1.1 - p.baseT * 0.3);
          const wave = Math.sin(now * 0.0011 + p.phaseRand) * 0.18;

          const cosR = Math.cos(p.rotAngle);
          const sinR = Math.sin(p.rotAngle);
          const sdx = stx * cosR + srx * sinR;
          const sdy = sty * cosR + sry * sinR;
          const sdz = stz * cosR + srz * sinR;
          const ptpx = -stx * sinR + srx * cosR;
          const ptpy = -sty * sinR + sry * cosR;
          const ptpz = -stz * sinR + srz * cosR;

          const tipExtra = strokeLen * 0.4 * p.tipTilt;
          const tipX = baseX + stx * strokeLen * (0.55 + wave) + sux * strokeLen * layer.lift + srx * lateralOff * 1.3 + ptpx * tipExtra;
          const tipY = baseY + sty * strokeLen * (0.55 + wave) + suy * strokeLen * layer.lift + sry * lateralOff * 1.3 + ptpy * tipExtra;
          const tipZ = baseZ + stz * strokeLen * (0.55 + wave) + suz * strokeLen * layer.lift + srz * lateralOff * 1.3 + ptpz * tipExtra;

          const baseHalf = r * 0.12 * p.widthRand;
          const HEX_H = 0.8660254;
          const b0x = baseX + sdx * baseHalf;
          const b0y = baseY + sdy * baseHalf;
          const b0z = baseZ + sdz * baseHalf;
          const b1x = baseX + (-sdx * 0.5 + ptpx * HEX_H) * baseHalf;
          const b1y = baseY + (-sdy * 0.5 + ptpy * HEX_H) * baseHalf;
          const b1z = baseZ + (-sdz * 0.5 + ptpz * HEX_H) * baseHalf;
          const b2x = baseX + (-sdx * 0.5 - ptpx * HEX_H) * baseHalf;
          const b2y = baseY + (-sdy * 0.5 - ptpy * HEX_H) * baseHalf;
          const b2z = baseZ + (-sdz * 0.5 - ptpz * HEX_H) * baseHalf;

          const off = i * 12;
          pos[off] = b0x;      pos[off + 1] = b0y;   pos[off + 2] = b0z;
          pos[off + 3] = b1x;  pos[off + 4] = b1y;   pos[off + 5] = b1z;
          pos[off + 6] = b2x;  pos[off + 7] = b2y;   pos[off + 8] = b2z;
          pos[off + 9] = tipX; pos[off + 10] = tipY; pos[off + 11] = tipZ;
        }
        geom.attributes.position.needsUpdate = true;
      }

      for (const leg of legData) {
        if (!leg.objWrap) continue;
        const def = leg.def;
        if (def.segIdx >= N_SEGS) continue;
        const s = segs[def.segIdx];

        const ATT_OUT = BODY_R * 0.88;
        const ATT_DOWN = BODY_R * 0.4;
        const ox = s.x + s.rx * def.side * ATT_OUT - s.ux * ATT_DOWN;
        const oy = s.y + s.ry * def.side * ATT_OUT - s.uy * ATT_DOWN;
        const oz = s.z + s.rz * def.side * ATT_OUT - s.uz * ATT_DOWN;
        leg.objWrap.position.set(ox, oy, oz);
        headBasisR.set(s.rx, s.ry, s.rz);
        headBasisU.set(s.ux, s.uy, s.uz);
        headBasisF.set(-s.tx, -s.ty, -s.tz);
        headBasisM.makeBasis(headBasisR, headBasisU, headBasisF);
        leg.objWrap.quaternion.setFromRotationMatrix(headBasisM);
      }

      {
        const h = segs[0];
        const fx = -h.tx, fy = -h.ty, fz = -h.tz;
        headGroup.position.set(h.x, h.y, h.z);
        headBasisR.set(h.rx, h.ry, h.rz);
        headBasisU.set(h.ux, h.uy, h.uz);
        headBasisF.set(fx, fy, fz);
        headBasisM.makeBasis(headBasisR, headBasisU, headBasisF);
        headGroup.quaternion.setFromRotationMatrix(headBasisM);
      }

      {
        const tWave = now * 0.0034;

        for (const w of whiskerData) {
          const def = w.def;

          for (let i = 0; i < N_WHISKER_RINGS; i++) {
            const t = i / (N_WHISKER_RINGS - 1);

            const segF = t * N_WHISKER_SPAN;
            const segI = Math.min(N_SEGS - 2, Math.floor(segF));
            const segFrac = segF - segI;
            const sA = segs[segI];
            const sB = segs[segI + 1];
            const f1 = 1 - segFrac, f2 = segFrac;

            const bx = sA.x * f1 + sB.x * f2;
            const by = sA.y * f1 + sB.y * f2;
            const bz = sA.z * f1 + sB.z * f2;
            const brx = sA.rx * f1 + sB.rx * f2;
            const bry = sA.ry * f1 + sB.ry * f2;
            const brz = sA.rz * f1 + sB.rz * f2;
            const bux = sA.ux * f1 + sB.ux * f2;
            const buy = sA.uy * f1 + sB.uy * f2;
            const buz = sA.uz * f1 + sB.uz * f2;
            const btx = sA.tx * f1 + sB.tx * f2;
            const bty = sA.ty * f1 + sB.ty * f2;
            const btz = sA.tz * f1 + sB.tz * f2;

            const snoutInfl = Math.max(0, 1 - t * 7);
            const fwdOff = 90 * snoutInfl;
            const baseLat = 5 + (BODY_R * 2.0 - 10) * (1 - snoutInfl);
            const baseDown = -18 + (-BODY_R * 0.35 - (-10)) * (1 - snoutInfl);

            const wavL = Math.sin(tWave + t * 6.8 + def.phase) * (6 + t * 32);
            const wavU = Math.cos(tWave * 0.72 + t * 5.0 + def.phase * 1.4) * (3 + t * 12);

            const totalLat = def.side * (baseLat + wavL);
            const totalDown = baseDown + wavU;
            const fX = -btx, fY = -bty, fZ = -btz;

            w.pts[i * 3]     = bx + fX * fwdOff + brx * totalLat + bux * totalDown;
            w.pts[i * 3 + 1] = by + fY * fwdOff + bry * totalLat + buy * totalDown;
            w.pts[i * 3 + 2] = bz + fZ * fwdOff + brz * totalLat + buz * totalDown;
            w.radii[i] = Math.max(0.28, 1.5 * (1 - t * 0.82));
          }

          const seedS = segs[Math.min(N_SEGS - 1, Math.floor(N_WHISKER_SPAN * 0.5))];
          updateTubeRings(
            w.geom, w.pts, w.radii,
            N_WHISKER_RINGS, N_WHISKER_FACETS, cosW, sinW,
            seedS.ux, seedS.uy, seedS.uz,
          );
        }
      }

      if (style.maneFlame) {
        maneFireMat.uniforms.uTime.value = now * 0.001;
        const ff = 0.85 + 0.15 * Math.sin(now * 0.013) + 0.07 * Math.sin(now * 0.027 + 1.2);
        maneFireMat.uniforms.uIntensity.value = Math.max(0.6, ff);
      }

      if (prevStepTime < 0) {
        prevStepTime = now;
        prevHeadX = segs[0].x;
        prevHeadY = segs[0].y;
        prevHeadZ = segs[0].z;
      }
      const dt = Math.min(0.1, (now - prevStepTime) / 1000);
      prevStepTime = now;

      {
        const h = segs[0];
        if (dt > 1e-4) {
          headVx = (h.x - prevHeadX) / dt;
          headVy = (h.y - prevHeadY) / dt;
          headVz = (h.z - prevHeadZ) / dt;
        } else {
          headVx = 0; headVy = 0; headVz = 0;
        }
        prevHeadX = h.x;
        prevHeadY = h.y;
        prevHeadZ = h.z;
      }

      const breathCycleT = (now / 1000) % BREATH_CYCLE;
      const inExhale = breathCycleT < BREATH_EXHALE_DUR;
      if (inExhale) {
        breathEmitTimer += dt;
        const emitInterval = BREATH_EXHALE_DUR / BREATH_BURST_COUNT;
        while (breathEmitTimer >= emitInterval) {
          breathEmitTimer -= emitInterval;
          emitBreathParticle();
        }
      } else {
        breathEmitTimer = 0;
      }

      for (const p of breathParticles) {
        if (p.life < 0) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.life = -1;
          p.sprite.visible = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const drag = Math.pow(0.15, dt);
        p.vx *= drag;
        p.vy *= drag;
        p.vz *= drag;
        p.vy += 600 * dt;
        p.sprite.position.set(p.x, p.y, p.z);
        const tLife = p.life / p.maxLife;
        const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * tLife;
        p.sprite.scale.set(size, size, 1);
        const fade = tLife < 0.2 ? tLife / 0.2 : 1 - (tLife - 0.2) / 0.8;
        p.mat.opacity = Math.max(0, fade) * 0.01;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchstart", onTouch);
      geo.dispose();
      bodyMat.dispose();
      for (const data of maneLayerData) {
        data.geom.dispose();
        data.mat.dispose();
      }
      objLimbDisposed = true;
      for (const g of objLimbGeomsBase) g.dispose();
      for (const g of objLimbGeomsMirror) g.dispose();
      for (const w of whiskerData) w.geom.dispose();
      limbMat.dispose();
      headGeo.dispose();
      headMat.dispose();
      hornGeo.dispose();
      hornMat.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      eyeHaloTex.dispose();
      eyeHaloMat.dispose();
      breathTex.dispose();
      for (const p of breathParticles) {
        p.mat.dispose();
      }
      objHeadDisposed = true;
      if (objHeadWrap) {
        objHeadWrap.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
        });
      }
      objHeadMat.dispose();
      envDisposed = true;
      goldBodyMat.dispose();
      goldHeadMat.dispose();
      goldLimbMat.dispose();
      shadowBodyMat.dispose();
      shadowHeadMat.dispose();
      shadowLimbMat.dispose();
      glassBodyMat.dispose();
      glassHeadMat.dispose();
      glassLimbMat.dispose();
      scaleBumpTex.dispose();
      if (envRenderTarget) envRenderTarget.dispose();
      pmrem.dispose();
      scene.environment = null;
      maneFireMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <img
        src="/lab/dragon/moon.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vmin] h-[160vmin] object-cover"
        style={{ mixBlendMode: "screen" }}
      />
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full touch-none select-none"
      />

      <img
        ref={branchRef}
        src="/lab/dragon/branches.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover z-20 will-change-transform"
        style={{ mixBlendMode: "multiply", transform: "scale(1.06)" }}
      />

      <div className="fixed bottom-4 left-4 z-30 flex gap-1 bg-white/5 border border-white/10 rounded p-1 backdrop-blur-sm text-[12px]">
        {Object.entries(STYLES).map(([id, s], i) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition ${
              active === id
                ? "bg-white/20 text-white"
                : "text-white/65 hover:text-white hover:bg-white/10"
            }`}
          >
            <kbd className="text-[10px] leading-none px-1 py-0.5 rounded bg-white/10 border border-white/15 text-white/60">
              {i + 1}
            </kbd>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
