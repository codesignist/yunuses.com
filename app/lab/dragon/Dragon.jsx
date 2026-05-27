"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

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
const SEG_LEN = 26;
const SEG_GAP = 8;
const CHAIN_DIST = SEG_LEN + SEG_GAP;
const N_FACETS = 16;
const IDLE_DELAY = 1500;
const Z_AMP = 200;

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
    eye: { color: 0xfff0a0, emissive: 0xb09020, intensity: 0.5 },
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
    limb: 0x2a1800,
    eye: { color: 0xfff4c0, emissive: 0xffa820, intensity: 0.7 },
  },
  haku: {
    label: "Haku",
    body: 0xbfe6e0,
    emissive: 0x1a3848,
    emissiveIntensity: 0.08,
    light: 0xdcf0f0,
    lightIntensity: 1.1,
    ambient: 0x182830,
    ambientIntensity: 0.4,
    bg: ["#0e1a1f", "#040a0c"],
    mane: [0x123040, 0x4eaeae, 0xb6eae4],
    limb: 0x1a242e,
    eye: { color: 0xb0e0e8, emissive: 0x3090a8, intensity: 0.55 },
  },
};

const MANE_LAYERS = [
  { count: 210, lenMult: 0.95, baseOff: -0.05, lateralAmp: 0.55, lift: 0.4, alpha: 0.7, seed: 1, colorIdx: 0 },
  { count: 190, lenMult: 1.05, baseOff: 0.05, lateralAmp: 0.4, lift: 0.55, alpha: 0.7, seed: 1000, colorIdx: 1 },
  { count: 160, lenMult: 1.15, baseOff: 0.1, lateralAmp: 0.25, lift: 0.7, alpha: 0.75, seed: 2000, colorIdx: 2 },
];

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const FIRE_BODY_VS = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FIRE_BODY_FS = `
  precision highp float;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorDeep;
  uniform vec3 uColorOuter;
  uniform vec3 uColorInner;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

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
    for (int i = 0; i < 4; i++) {
      v += vnoise(p) * a;
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 np1 = vWorldPos * 0.025 + vec3(0.0, -uTime * 1.2, uTime * 0.25);
    vec3 np2 = vWorldPos * 0.075 + vec3(0.0, -uTime * 2.6, uTime * 0.1);
    float n1 = fbm(np1);
    float n2 = fbm(np2);
    float n = clamp(n1 * 0.7 + n2 * 0.45 - 0.1, 0.0, 1.0);
    n = pow(n, 1.1);

    vec3 color = mix(uColorDeep, uColorOuter, smoothstep(0.0, 0.5, n));
    color = mix(color, uColorInner, smoothstep(0.45, 0.9, n));

    vec3 nn = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float rim = pow(1.0 - max(0.0, dot(nn, v)), 1.6);
    color += uColorInner * rim * 0.45;

    gl_FragColor = vec4(color * uIntensity, 1.0);
  }
`;

const N_LEG_RINGS = 11;
const N_LEG_FACETS = 8;
const N_CLAW_RINGS = 5;
const N_CLAW_FACETS = 5;

const LEG_DEFS = [
  { segIdx: 6, side: -1, phase: 0 },
  { segIdx: 6, side: 1, phase: Math.PI },
  { segIdx: 31, side: -1, phase: Math.PI * 0.5 },
  { segIdx: 31, side: 1, phase: Math.PI * 1.5 },
];

const cosL = new Float32Array(N_LEG_FACETS);
const sinL = new Float32Array(N_LEG_FACETS);
for (let k = 0; k < N_LEG_FACETS; k++) {
  const a = (k / N_LEG_FACETS) * Math.PI * 2;
  cosL[k] = Math.cos(a);
  sinL[k] = Math.sin(a);
}
const cosC = new Float32Array(N_CLAW_FACETS);
const sinC = new Float32Array(N_CLAW_FACETS);
for (let k = 0; k < N_CLAW_FACETS; k++) {
  const a = (k / N_CLAW_FACETS) * Math.PI * 2;
  cosC[k] = Math.cos(a);
  sinC[k] = Math.sin(a);
}

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

const TUBE_SCRATCH_MAX = Math.max(N_LEG_RINGS, N_CLAW_RINGS, N_WHISKER_RINGS);
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
  const [active, setActive] = useState("golge");
  const activeRef = useRef("golge");
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x141a22,
      shininess: 12,
      specular: 0x1a2030,
      flatShading: false,
      side: THREE.FrontSide,
    });
    const body = new THREE.Mesh(geo, bodyMat);
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
      const mPos = new Float32Array(layer.count * 9);
      const mCol = new Float32Array(layer.count * 9);
      const mGeo = new THREE.BufferGeometry();
      mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
      mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3));
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
      flatShading: false,
      side: THREE.FrontSide,
    });

    const legData = LEG_DEFS.map((def) => {
      const legGeom = buildTubeGeom(N_LEG_RINGS, N_LEG_FACETS);
      const legMesh = new THREE.Mesh(legGeom, limbMat);
      legMesh.frustumCulled = false;
      scene.add(legMesh);
      const claws = [];
      for (let c = 0; c < 3; c++) {
        const cGeom = buildTubeGeom(N_CLAW_RINGS, N_CLAW_FACETS);
        const cMesh = new THREE.Mesh(cGeom, limbMat);
        cMesh.frustumCulled = false;
        scene.add(cMesh);
        claws.push({ geom: cGeom, mesh: cMesh });
      }
      return {
        def,
        legGeom,
        legMesh,
        claws,
        legPts: new Float32Array(N_LEG_RINGS * 3),
        legR: new Float32Array(N_LEG_RINGS),
        clawPts: new Float32Array(N_CLAW_RINGS * 3),
        clawR: new Float32Array(N_CLAW_RINGS),
      };
    });

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
    const eyeGeo = new THREE.SphereGeometry(2.5, 10, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-17, 4, 55);
    headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(17, 4, 55);
    headGroup.add(rightEye);

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

    const fireBodyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uColorDeep: { value: new THREE.Color(0x6a0c00) },
        uColorOuter: { value: new THREE.Color(0xff5a14) },
        uColorInner: { value: new THREE.Color(0xfff080) },
      },
      vertexShader: FIRE_BODY_VS,
      fragmentShader: FIRE_BODY_FS,
      side: THREE.FrontSide,
    });

    const bodyParts = [
      { mesh: body, original: bodyMat },
      { mesh: headMesh, original: headMat },
      { mesh: leftHorn, original: hornMat },
      { mesh: rightHorn, original: hornMat },
    ];
    for (const leg of legData) {
      bodyParts.push({ mesh: leg.legMesh, original: limbMat });
      for (const claw of leg.claws) {
        bodyParts.push({ mesh: claw.mesh, original: limbMat });
      }
    }

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
      hornMat.color.setHex(s.limb);
      eyeMat.color.setHex(s.eye.color);
      eyeMat.emissive.setHex(s.eye.emissive);
      eyeMat.emissiveIntensity = s.eye.intensity;
      const useFire = !!s.flicker;
      for (const part of bodyParts) {
        part.mesh.material = useFire ? fireBodyMat : part.original;
      }
      const bgTarget = container.parentElement || container;
      bgTarget.style.background = `linear-gradient(to bottom, ${s.bg[0]} 0%, ${s.bg[1]} 100%)`;
      for (const data of maneLayerData) {
        tmpColor.setHex(s.mane[data.layer.colorIdx]);
        const colArr = data.geom.attributes.color.array;
        const n = data.layer.count * 3;
        for (let v = 0; v < n; v++) {
          const off = v * 3;
          colArr[off] = tmpColor.r;
          colArr[off + 1] = tmpColor.g;
          colArr[off + 2] = tmpColor.b;
        }
        data.geom.attributes.color.needsUpdate = true;
      }
    }
    let currentStyleId = active;
    applyStyle(STYLES[active]);

    let idleBlend = 1;
    const HEAD_LERP = 0.07;
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
      const idleCx = driftCx + ampX * 0.55 * Math.sin(now * 0.00126);
      const idleCy = driftCy + ampY * 0.55 * Math.sin(now * 0.00126 + 1.2);

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
      geo.computeBoundingSphere();

      if (style.flicker) {
        const f = 0.82 + 0.18 * Math.sin(now * 0.011) + 0.08 * Math.sin(now * 0.024);
        const fClamp = Math.max(0.3, f);
        bodyMat.emissiveIntensity = style.emissiveIntensity * fClamp;
        headMat.emissiveIntensity = style.emissiveIntensity * fClamp;
        eyeMat.emissiveIntensity = style.eye.intensity * (0.75 + 0.25 * Math.sin(now * 0.006));
        dirLight.intensity = style.lightIntensity * (0.9 + 0.1 * Math.sin(now * 0.018));
      }

      const maneStart = 0;
      const maneEnd = Math.min(N_SEGS - 4, 36);
      const maneRange = maneEnd - maneStart;
      let flickDark = null;
      let flickLit = null;
      if (style.flicker) {
        flickDark = new THREE.Color(style.mane[0]);
        flickLit = new THREE.Color(style.mane[2]);
      }
      for (const data of maneLayerData) {
        const { layer, params, geom } = data;
        const pos = geom.attributes.position.array;
        const col = style.flicker ? geom.attributes.color.array : null;
        for (let i = 0; i < layer.count; i++) {
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

          const strokeLen = r * 2.2 * p.lenRand * layer.lenMult * (1.1 - p.baseT * 0.3);
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
          const baseAx = baseX + sdx * baseHalf;
          const baseAy = baseY + sdy * baseHalf;
          const baseAz = baseZ + sdz * baseHalf;
          const baseBx = baseX - sdx * baseHalf;
          const baseBy = baseY - sdy * baseHalf;
          const baseBz = baseZ - sdz * baseHalf;

          const off = i * 9;
          pos[off] = baseAx;
          pos[off + 1] = baseAy;
          pos[off + 2] = baseAz;
          pos[off + 3] = tipX;
          pos[off + 4] = tipY;
          pos[off + 5] = tipZ;
          pos[off + 6] = baseBx;
          pos[off + 7] = baseBy;
          pos[off + 8] = baseBz;

          if (col) {
            const flick = 0.45 + 0.55 * Math.sin(now * 0.009 + i * 1.7 + p.phaseRand * 4);
            const mix = Math.max(0, Math.min(1, p.baseT * 0.3 + flick * 0.85));
            const cr = flickDark.r + (flickLit.r - flickDark.r) * mix;
            const cg = flickDark.g + (flickLit.g - flickDark.g) * mix;
            const cb = flickDark.b + (flickLit.b - flickDark.b) * mix;
            col[off] = cr; col[off + 1] = cg; col[off + 2] = cb;
            col[off + 3] = cr; col[off + 4] = cg; col[off + 5] = cb;
            col[off + 6] = cr; col[off + 7] = cg; col[off + 8] = cb;
          }
        }
        geom.attributes.position.needsUpdate = true;
        if (col) geom.attributes.color.needsUpdate = true;
      }

      for (const leg of legData) {
        const def = leg.def;
        if (def.segIdx >= N_SEGS) continue;
        const s = segs[def.segIdx];

        const ATT_OUT = BODY_R * 0.88;
        const ATT_DOWN = BODY_R * 0.4;
        const shx = s.x + s.rx * def.side * ATT_OUT - s.ux * ATT_DOWN;
        const shy = s.y + s.ry * def.side * ATT_OUT - s.uy * ATT_DOWN;
        const shz = s.z + s.rz * def.side * ATT_OUT - s.uz * ATT_DOWN;

        const ph = now * 0.0022 + def.phase;
        const swing1 = Math.sin(ph) * 0.45;
        const swing2 = Math.sin(ph * 1.3 + 0.7) * 0.35;

        const UPPER = 32;
        const LOWER = 28;

        const upDx = -s.ux * 0.55 + s.rx * def.side * 0.5 + s.tx * swing1;
        const upDy = -s.uy * 0.55 + s.ry * def.side * 0.5 + s.ty * swing1;
        const upDz = -s.uz * 0.55 + s.rz * def.side * 0.5 + s.tz * swing1;
        const upL = Math.hypot(upDx, upDy, upDz) || 1;
        const elx = shx + (upDx / upL) * UPPER;
        const ely = shy + (upDy / upL) * UPPER;
        const elz = shz + (upDz / upL) * UPPER;

        const loDx = -s.ux * 0.92 + s.tx * swing2 + s.rx * def.side * 0.15;
        const loDy = -s.uy * 0.92 + s.ty * swing2 + s.ry * def.side * 0.15;
        const loDz = -s.uz * 0.92 + s.tz * swing2 + s.rz * def.side * 0.15;
        const loL = Math.hypot(loDx, loDy, loDz) || 1;
        const wx = elx + (loDx / loL) * LOWER;
        const wy = ely + (loDy / loL) * LOWER;
        const wz = elz + (loDz / loL) * LOWER;

        for (let i = 0; i < N_LEG_RINGS; i++) {
          const t = i / (N_LEG_RINGS - 1);
          let px, py, pz;
          if (t <= 0.5) {
            const tt = t * 2;
            px = shx + (elx - shx) * tt;
            py = shy + (ely - shy) * tt;
            pz = shz + (elz - shz) * tt;
          } else {
            const tt = (t - 0.5) * 2;
            px = elx + (wx - elx) * tt;
            py = ely + (wy - ely) * tt;
            pz = elz + (wz - elz) * tt;
          }
          leg.legPts[i * 3] = px;
          leg.legPts[i * 3 + 1] = py;
          leg.legPts[i * 3 + 2] = pz;
          leg.legR[i] = t <= 0.5 ? 5 - t * 2 : 4 - (t - 0.5) * 2;
        }
        updateTubeRings(
          leg.legGeom, leg.legPts, leg.legR,
          N_LEG_RINGS, N_LEG_FACETS, cosL, sinL,
          s.rx * def.side, s.ry * def.side, s.rz * def.side,
        );

        const CLAW = 16;
        const baseCX = -s.ux;
        const baseCY = -s.uy;
        const baseCZ = -s.uz;
        const spreadFX = s.tx;
        const spreadFY = s.ty;
        const spreadFZ = s.tz;
        const spreadSX = s.rx * def.side;
        const spreadSY = s.ry * def.side;
        const spreadSZ = s.rz * def.side;
        const sinS = Math.sin(0.18);
        const cosS = Math.cos(0.18);

        for (let c = 0; c < 3; c++) {
          const angF = (c - 1) * 0.55;
          const cosF = Math.cos(angF);
          const sinF = Math.sin(angF);
          const dx = baseCX * cosF * cosS + spreadFX * sinF + spreadSX * sinS * cosF;
          const dy = baseCY * cosF * cosS + spreadFY * sinF + spreadSY * sinS * cosF;
          const dz = baseCZ * cosF * cosS + spreadFZ * sinF + spreadSZ * sinS * cosF;
          const dl = Math.hypot(dx, dy, dz) || 1;
          const tipX = wx + (dx / dl) * CLAW;
          const tipY = wy + (dy / dl) * CLAW;
          const tipZ = wz + (dz / dl) * CLAW;
          const midX = wx + (dx / dl) * CLAW * 0.5 - s.tx * 1.5;
          const midY = wy + (dy / dl) * CLAW * 0.5 - s.ty * 1.5;
          const midZ = wz + (dz / dl) * CLAW * 0.5 - s.tz * 1.5;

          for (let i = 0; i < N_CLAW_RINGS; i++) {
            const t = i / (N_CLAW_RINGS - 1);
            const u = 1 - t;
            const bx = u * u * wx + 2 * u * t * midX + t * t * tipX;
            const by = u * u * wy + 2 * u * t * midY + t * t * tipY;
            const bz = u * u * wz + 2 * u * t * midZ + t * t * tipZ;
            leg.clawPts[i * 3] = bx;
            leg.clawPts[i * 3 + 1] = by;
            leg.clawPts[i * 3 + 2] = bz;
            leg.clawR[i] = 1.6 - t * 1.3;
          }
          updateTubeRings(
            leg.claws[c].geom, leg.clawPts, leg.clawR,
            N_CLAW_RINGS, N_CLAW_FACETS, cosC, sinC,
            s.ux, s.uy, s.uz,
          );
        }
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
            const fwdOff = 56 * snoutInfl;
            const baseLat = 10 + (BODY_R * 2.0 - 10) * (1 - snoutInfl);
            const baseDown = -6 + (-BODY_R * 0.35 - (-6)) * (1 - snoutInfl);

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

      if (style.flicker) {
        fireBodyMat.uniforms.uTime.value = now * 0.001;
        const f = 0.82 + 0.18 * Math.sin(now * 0.011) + 0.08 * Math.sin(now * 0.024);
        fireBodyMat.uniforms.uIntensity.value = Math.max(0.55, f);
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
      for (const leg of legData) {
        leg.legGeom.dispose();
        for (const claw of leg.claws) claw.geom.dispose();
      }
      for (const w of whiskerData) w.geom.dispose();
      limbMat.dispose();
      headGeo.dispose();
      headMat.dispose();
      hornGeo.dispose();
      hornMat.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      fireBodyMat.dispose();
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
