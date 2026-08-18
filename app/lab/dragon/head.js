import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import {
  N_SEGS,
  HEAD_PROFILES,
  N_HEAD_RINGS,
  N_HEAD_FACETS,
  N_WHISKER_RINGS,
  N_WHISKER_FACETS,
  N_WHISKER_SPAN,
  WHISKER_DEFS,
  BODY_R,
} from "./config";
import { makeRadialCanvas } from "./materials";

export const MOUTH_FWD = 55;
export const MOUTH_DOWN = 40;

const EYE_R = 5.2;

// --- Boru yardimcilari (biyiklar icin) ------------------------------------

const _tx = new Float32Array(N_WHISKER_RINGS);
const _ty = new Float32Array(N_WHISKER_RINGS);
const _tz = new Float32Array(N_WHISKER_RINGS);
const _ux = new Float32Array(N_WHISKER_RINGS);
const _uy = new Float32Array(N_WHISKER_RINGS);
const _uz = new Float32Array(N_WHISKER_RINGS);

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
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
      indices[ii++] = a; indices[ii++] = d; indices[ii++] = c;
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
    const dx = pts[ni] - pts[pi];
    const dy = pts[ni + 1] - pts[pi + 1];
    const dz = pts[ni + 2] - pts[pi + 2];
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

// --- Goz --------------------------------------------------------------------

/**
 * Goz kuresine dogrudan iris + yarik bebek dokusu basiliyor. Duz bir disk
 * kullanmak kafa dondugunde kenardan bakildiginda kaybolurdu; kure uzerinde
 * cizince bebek gercek bir 3B ozellik gibi golge aliyor.
 */
function makeEyeCanvas() {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const iris = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.3);
  iris.addColorStop(0.0, "#ffffff");
  iris.addColorStop(0.35, "#ffe9a8");
  iris.addColorStop(0.75, "#c98a2a");
  iris.addColorStop(1.0, "#2a1604");
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Iris lifleri
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * size * 0.09, cy + Math.sin(a) * size * 0.09);
    ctx.lineTo(cx + Math.cos(a) * size * 0.29, cy + Math.sin(a) * size * 0.29);
    ctx.stroke();
  }

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.052, size * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();

  return cv;
}

export function createHead(scene, spine, styleRef) {
  const group = new THREE.Group();
  scene.add(group);

  const basisR = new THREE.Vector3();
  const basisU = new THREE.Vector3();
  const basisF = new THREE.Vector3();
  const basisM = new THREE.Matrix4();

  // Yedek prosedurel kafa: OBJ inene kadar gorunur.
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
      headIndices.push(
        i * N_HEAD_FACETS + k,
        i * N_HEAD_FACETS + k2,
        (i + 1) * N_HEAD_FACETS + k2,
        i * N_HEAD_FACETS + k,
        (i + 1) * N_HEAD_FACETS + k2,
        (i + 1) * N_HEAD_FACETS + k,
      );
    }
  }
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(headPositions, 3));
  headGeo.setIndex(headIndices);
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, null);
  group.add(headMesh);

  const hornGeo = new THREE.ConeGeometry(3.5, 22, 6);
  const horns = [-1, 1].map((side) => {
    const horn = new THREE.Mesh(hornGeo, null);
    const dx = side * 0.6, dy = 1.2, dz = -1.3;
    const dl = Math.hypot(dx, dy, dz);
    const n = new THREE.Vector3(dx / dl, dy / dl, dz / dl);
    horn.position.set(side * 11 + n.x * 11, 22 + n.y * 11, 20 + n.z * 11);
    horn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    group.add(horn);
    return horn;
  });

  // --- Gozler ---
  const eyeTex = new THREE.CanvasTexture(makeEyeCanvas());
  eyeTex.colorSpace = THREE.SRGBColorSpace;
  const eyeMat = new THREE.MeshStandardMaterial({
    map: eyeTex,
    emissiveMap: eyeTex,
    emissive: 0xffc040,
    emissiveIntensity: 2.2,
    roughness: 0.12,
    metalness: 0.0,
  });
  const eyeGeo = new THREE.SphereGeometry(EYE_R, 24, 18);
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 13, -8, 53);
    // Dokudaki iris merkezi kurenin +X noktasina dusuyor; ileri cevirip
    // her goze hafif disa bakis veriyoruz.
    eye.rotation.y = -Math.PI / 2 + side * 0.38;
    eye.renderOrder = 5;
    group.add(eye);
    return eye;
  });

  const haloTex = new THREE.CanvasTexture(
    makeRadialCanvas(128, [
      [0.0, "rgba(255,255,255,1.0)"],
      [0.3, "rgba(255,255,255,0.5)"],
      [0.65, "rgba(255,255,255,0.16)"],
      [1.0, "rgba(255,255,255,0)"],
    ]),
  );
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    color: 0xff8000,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halos = eyes.map((eye) => {
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(78, 78, 1);
    halo.position.copy(eye.position);
    halo.renderOrder = 20;
    group.add(halo);
    return halo;
  });

  // --- Biyiklar ---
  const cosW = new Float32Array(N_WHISKER_FACETS);
  const sinW = new Float32Array(N_WHISKER_FACETS);
  for (let k = 0; k < N_WHISKER_FACETS; k++) {
    const a = (k / N_WHISKER_FACETS) * Math.PI * 2;
    cosW[k] = Math.cos(a);
    sinW[k] = Math.sin(a);
  }
  const whiskers = WHISKER_DEFS.map((def) => {
    const geom = buildTubeGeom(N_WHISKER_RINGS, N_WHISKER_FACETS);
    const mesh = new THREE.Mesh(geom, null);
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

  // --- OBJ kafa ---
  let objWrap = null;
  let disposed = false;
  new OBJLoader().load(
    "/lab/dragon/dragon.obj",
    (loaded) => {
      if (disposed) return;
      loaded.traverse((c) => {
        if (c.isMesh) {
          c.material = styleRef.current.head;
          c.castShadow = false;
          c.receiveShadow = false;
          // dragon.obj yumusak normallerle geliyor (31591 ucgen). OBJLoader
          // indekssiz geometri urettigi icin computeVertexNormals cagrisi
          // onlari per-face duz normallerle eziyordu, kafa fasetli cikiyordu.
          if (c.geometry && !c.geometry.attributes.normal) {
            c.geometry.computeVertexNormals();
          }
        }
      });
      const box = new THREE.Box3().setFromObject(loaded);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const scale = 230 / (Math.max(size.x, size.y, size.z) || 1);
      loaded.position.set(-center.x, -center.y, -center.z);

      const wrap = new THREE.Group();
      wrap.add(loaded);
      wrap.scale.setScalar(scale);
      wrap.rotation.y = Math.PI / 2;
      wrap.position.set(0, 0, -20);

      headMesh.visible = false;
      horns[0].visible = false;
      horns[1].visible = false;
      group.add(wrap);
      objWrap = wrap;
    },
    undefined,
    (err) => console.warn("Dragon head OBJ load failed:", err),
  );

  function setMaterials(set) {
    headMesh.material = set.head;
    horns[0].material = set.limb;
    horns[1].material = set.limb;
    for (const w of whiskers) w.mesh.material = set.limb;
    if (objWrap) {
      objWrap.traverse((c) => {
        if (c.isMesh) c.material = set.head;
      });
    }
  }

  function applyStyle(style) {
    eyeMat.emissive.setHex(style.eye.emissive);
    eyeMat.emissiveIntensity = style.eye.intensity;
    eyeMat.color.setHex(style.eye.color);
    haloMat.color.setHex(style.eye.emissive);
    haloMat.opacity = style.eye.halo;
  }

  function update(now, style) {
    const segs = spine.segs;
    const h = segs[0];
    group.position.set(h.x, h.y, h.z);
    basisR.set(h.rx, h.ry, h.rz);
    basisU.set(h.ux, h.uy, h.uz);
    basisF.set(-h.tx, -h.ty, -h.tz);
    basisM.makeBasis(basisR, basisU, basisF);
    group.quaternion.setFromRotationMatrix(basisM);

    eyeMat.emissiveIntensity = style.eye.intensity * (0.86 + 0.14 * Math.sin(now * 0.005));

    const tWave = now * 0.0034;
    for (const w of whiskers) {
      for (let i = 0; i < N_WHISKER_RINGS; i++) {
        const t = i / (N_WHISKER_RINGS - 1);
        const segF = t * N_WHISKER_SPAN;
        const segI = Math.min(N_SEGS - 2, Math.floor(segF));
        const f2 = segF - segI;
        const f1 = 1 - f2;
        const sA = segs[segI];
        const sB = segs[segI + 1];

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

        const snout = Math.max(0, 1 - t * 7);
        const fwdOff = 90 * snout;
        const baseLat = 5 + (BODY_R * 2.0 - 10) * (1 - snout);
        const baseDown = -18 + (-BODY_R * 0.35 + 10) * (1 - snout);

        const wavL = Math.sin(tWave + t * 6.8 + w.def.phase) * (6 + t * 32);
        const wavU = Math.cos(tWave * 0.72 + t * 5.0 + w.def.phase * 1.4) * (3 + t * 12);

        const lat = w.def.side * (baseLat + wavL);
        const down = baseDown + wavU;

        w.pts[i * 3] = bx - btx * fwdOff + brx * lat + bux * down;
        w.pts[i * 3 + 1] = by - bty * fwdOff + bry * lat + buy * down;
        w.pts[i * 3 + 2] = bz - btz * fwdOff + brz * lat + buz * down;
        w.radii[i] = Math.max(0.28, 1.6 * (1 - t * 0.82));
      }
      const seed = segs[Math.min(N_SEGS - 1, Math.floor(N_WHISKER_SPAN * 0.5))];
      updateTubeRings(
        w.geom, w.pts, w.radii,
        N_WHISKER_RINGS, N_WHISKER_FACETS, cosW, sinW,
        seed.ux, seed.uy, seed.uz,
      );
    }
  }

  function dispose() {
    disposed = true;
    scene.remove(group);
    for (const w of whiskers) {
      scene.remove(w.mesh);
      w.geom.dispose();
    }
    headGeo.dispose();
    hornGeo.dispose();
    eyeGeo.dispose();
    eyeMat.dispose();
    eyeTex.dispose();
    haloMat.dispose();
    haloTex.dispose();
    if (objWrap) {
      objWrap.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
      });
    }
  }

  return { group, setMaterials, applyStyle, update, dispose };
}
