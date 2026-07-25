import * as THREE from "three";
import { MOUTH_FWD, MOUTH_DOWN } from "./head";

const POOL = 160;
const CYCLE = 3.8;
const EXHALE_DUR = 1.2;
const BURST = 80;

const VS = `
  attribute vec3 iOffset;
  attribute float iScale;
  attribute float iAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vAlpha = iAlpha;
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 world = iOffset + (position.x * camRight + position.y * camUp) * iScale;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FS = `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, vUv).a * vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function makePuffCanvas() {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  grad.addColorStop(0.0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.42)");
  grad.addColorStop(0.75, "rgba(255,255,255,0.11)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 28;
    img.data[i + 3] = Math.max(0, Math.min(255, img.data[i + 3] + n));
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * Onceden her parcacik icin ayri bir SpriteMaterial uretiliyordu (500 adet) ve
 * hepsinin tepe opakligi 0.01 ile carpiliyordu: gorunmeyen duman icin her kare
 * onlarca draw call. Simdi tek instanced mesh, tek cizim.
 */
export function createBreath(scene, spine) {
  const tex = new THREE.CanvasTexture(makePuffCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;

  const base = new THREE.PlaneGeometry(1, 1);
  const geom = new THREE.InstancedBufferGeometry();
  geom.index = base.index;
  geom.attributes.position = base.attributes.position;
  geom.attributes.uv = base.attributes.uv;
  geom.instanceCount = POOL;

  const offsets = new Float32Array(POOL * 3);
  const scales = new Float32Array(POOL);
  const alphas = new Float32Array(POOL);
  geom.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  geom.setAttribute("iScale", new THREE.InstancedBufferAttribute(scales, 1));
  geom.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uColor: { value: new THREE.Color(0xeaf2ff) },
    },
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 15;
  scene.add(mesh);

  const parts = [];
  for (let i = 0; i < POOL; i++) {
    parts.push({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      life: -1, maxLife: 0, sizeStart: 0, sizeEnd: 0,
    });
  }

  let emitTimer = 0;
  let hasPrevHead = false;
  const prevHead = { x: 0, y: 0, z: 0 };
  const headVel = { x: 0, y: 0, z: 0 };

  function emit() {
    let p = null;
    for (const c of parts) {
      if (c.life < 0) { p = c; break; }
    }
    if (!p) return;
    const h = spine.segs[0];
    const fX = -h.tx, fY = -h.ty, fZ = -h.tz;
    p.x = h.x + fX * MOUTH_FWD - h.ux * MOUTH_DOWN;
    p.y = h.y + fY * MOUTH_FWD - h.uy * MOUTH_DOWN;
    p.z = h.z + fZ * MOUTH_FWD - h.uz * MOUTH_DOWN;
    const fwd = 400 + Math.random() * 80;
    const up = -240 + Math.random() * 10;
    const lat = (Math.random() - 0.5) * 18;
    p.vx = fX * fwd + h.ux * up + h.rx * lat + headVel.x;
    p.vy = fY * fwd + h.uy * up + h.ry * lat + headVel.y;
    p.vz = fZ * fwd + h.uz * up + h.rz * lat + headVel.z;
    p.life = 0;
    p.maxLife = 1.4 + Math.random() * 0.8;
    p.sizeStart = 50 + Math.random() * 12;
    p.sizeEnd = 360 + Math.random() * 60;
  }

  function applyStyle(style) {
    mat.uniforms.uColor.value.setHex(style.moonTint);
  }

  function update(now, dt) {
    const h = spine.segs[0];
    if (hasPrevHead && dt > 1e-4) {
      headVel.x = (h.x - prevHead.x) / dt;
      headVel.y = (h.y - prevHead.y) / dt;
      headVel.z = (h.z - prevHead.z) / dt;
    } else {
      headVel.x = 0; headVel.y = 0; headVel.z = 0;
    }
    prevHead.x = h.x;
    prevHead.y = h.y;
    prevHead.z = h.z;
    hasPrevHead = true;

    const cycleT = (now / 1000) % CYCLE;
    if (cycleT < EXHALE_DUR) {
      emitTimer += dt;
      const interval = EXHALE_DUR / BURST;
      while (emitTimer >= interval) {
        emitTimer -= interval;
        emit();
      }
    } else {
      emitTimer = 0;
    }

    for (let i = 0; i < POOL; i++) {
      const p = parts[i];
      if (p.life < 0) {
        alphas[i] = 0;
        continue;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = -1;
        alphas[i] = 0;
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

      const tl = p.life / p.maxLife;
      offsets[i * 3] = p.x;
      offsets[i * 3 + 1] = p.y;
      offsets[i * 3 + 2] = p.z;
      scales[i] = p.sizeStart + (p.sizeEnd - p.sizeStart) * tl;
      const fade = tl < 0.2 ? tl / 0.2 : 1 - (tl - 0.2) / 0.8;
      // Bilerek cok dusuk: nefes bir efekt olarak degil, agzin onunde zar zor
      // secilen bir pus olarak okunsun isteniyor.
      alphas[i] = Math.max(0, fade) * 0.01;
    }

    geom.attributes.iOffset.needsUpdate = true;
    geom.attributes.iScale.needsUpdate = true;
    geom.attributes.iAlpha.needsUpdate = true;
  }

  function dispose() {
    scene.remove(mesh);
    base.dispose();
    geom.dispose();
    mat.dispose();
    tex.dispose();
  }

  return { applyStyle, update, dispose };
}
