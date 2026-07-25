import * as THREE from "three";
import {
  N_SEGS,
  N_FACETS,
  N_RING,
  CREST_SEG_START,
  FIN_SEG_START,
  radiusAt,
} from "./config";

// Pul dokusunun bir hucresinin dunya boyutu. UV'ler artik segment indeksine
// degil yay uzunluguna baglandigi icin yogunluk govde boyunca sabit kaliyor;
// onceden bas ile kuyruk arasinda dort kata yakin fark vardi.
const SCALE_WORLD = 7;
const TEX_COLS = 12;
const TEX_ROWS = 14;

const CAP_INDEX = N_SEGS * N_RING;

// Sirt sirti duz bir seride basliyor, kuyruga dogru yuzgece aciliyor.
// Anahtar kareyle yazmak formu okunur tutuyor: formullu bir egri, yuzgecin
// basladigi yerde tek segmentte ucten otuza siciyordu.
const CREST_KEYS = [
  [CREST_SEG_START, 0],
  [CREST_SEG_START + 5, 9],
  [FIN_SEG_START - 3, 10],
  [FIN_SEG_START + 1, 20],
  [FIN_SEG_START + 4, 31],
  [N_SEGS - 3, 27],
  [N_SEGS - 1, 0],
];

function crestHeight(i) {
  if (i <= CREST_KEYS[0][0]) return 0;
  for (let k = 1; k < CREST_KEYS.length; k++) {
    const [i1, h1] = CREST_KEYS[k];
    if (i <= i1) {
      const [i0, h0] = CREST_KEYS[k - 1];
      const f = (i - i0) / (i1 - i0);
      return h0 + (h1 - h0) * (f * f * (3 - 2 * f));
    }
  }
  return 0;
}

export function createBody(scene, spine) {
  const positions = new Float32Array((N_SEGS * N_RING + 1) * 3);
  const normals = new Float32Array((N_SEGS * N_RING + 1) * 3);
  const uvs = new Float32Array((N_SEGS * N_RING + 1) * 2);

  const triCount = (N_SEGS - 1) * N_FACETS * 6 + N_FACETS * 3;
  const indices = new Uint32Array(triCount);
  let ii = 0;
  for (let i = 0; i < N_SEGS - 1; i++) {
    for (let k = 0; k < N_FACETS; k++) {
      const a = i * N_RING + k;
      const b = i * N_RING + k + 1;
      const c = (i + 1) * N_RING + k + 1;
      const d = (i + 1) * N_RING + k;
      indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = d;
    }
  }
  // Boyun kapagi. Kafa OBJ'si kaydigi anlarda tupun icine bakiliyordu.
  for (let k = 0; k < N_FACETS; k++) {
    indices[ii++] = CAP_INDEX;
    indices[ii++] = k + 1;
    indices[ii++] = k;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mesh = new THREE.Mesh(geo, null);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // --- Sirt sirti ve kuyruk yuzgeci ---------------------------------------
  const crestRings = N_SEGS - CREST_SEG_START;
  const crestPos = new Float32Array(crestRings * 2 * 3);
  const crestIdx = new Uint32Array((crestRings - 1) * 6);
  let ci = 0;
  for (let i = 0; i < crestRings - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2 + 1;
    const d = (i + 1) * 2;
    crestIdx[ci++] = a; crestIdx[ci++] = b; crestIdx[ci++] = c;
    crestIdx[ci++] = a; crestIdx[ci++] = c; crestIdx[ci++] = d;
  }
  const crestGeo = new THREE.BufferGeometry();
  crestGeo.setAttribute("position", new THREE.BufferAttribute(crestPos, 3));
  crestGeo.setIndex(new THREE.BufferAttribute(crestIdx, 1));
  const crestMesh = new THREE.Mesh(crestGeo, null);
  crestMesh.frustumCulled = false;
  scene.add(crestMesh);

  const cosA = new Float32Array(N_RING);
  const sinA = new Float32Array(N_RING);
  for (let k = 0; k < N_RING; k++) {
    const a = ((k % N_FACETS) / N_FACETS) * Math.PI * 2;
    cosA[k] = Math.cos(a);
    sinA[k] = Math.sin(a);
  }

  function setMaterials(set) {
    mesh.material = set.body;
    crestMesh.material = set.crest;
  }

  function update(now) {
    const segs = spine.segs;
    const pos = geo.attributes.position.array;
    const nrm = geo.attributes.normal.array;
    const uv = geo.attributes.uv.array;

    for (let i = 0; i < N_SEGS; i++) {
      const s = segs[i];
      const t = i / (N_SEGS - 1);
      const r = radiusAt(t);
      const u = s.s / (SCALE_WORLD * TEX_COLS);
      const vSpan = (2 * Math.PI * Math.max(r, 0.6)) / (SCALE_WORLD * TEX_ROWS);
      for (let k = 0; k < N_RING; k++) {
        const ck = cosA[k];
        const sk = sinA[k];
        const nx = ck * s.rx + sk * s.ux;
        const ny = ck * s.ry + sk * s.uy;
        const nz = ck * s.rz + sk * s.uz;
        const idx = (i * N_RING + k) * 3;
        pos[idx] = s.x + nx * r;
        pos[idx + 1] = s.y + ny * r;
        pos[idx + 2] = s.z + nz * r;
        nrm[idx] = nx;
        nrm[idx + 1] = ny;
        nrm[idx + 2] = nz;
        const uidx = (i * N_RING + k) * 2;
        uv[uidx] = u;
        uv[uidx + 1] = (k / N_FACETS) * vSpan;
      }
    }

    const h = segs[0];
    const capR = radiusAt(0);
    const c3 = CAP_INDEX * 3;
    pos[c3] = h.x - h.tx * capR * 0.4;
    pos[c3 + 1] = h.y - h.ty * capR * 0.4;
    pos[c3 + 2] = h.z - h.tz * capR * 0.4;
    nrm[c3] = -h.tx;
    nrm[c3 + 1] = -h.ty;
    nrm[c3 + 2] = -h.tz;
    uv[CAP_INDEX * 2] = 0;
    uv[CAP_INDEX * 2 + 1] = 0;

    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;

    // Yuzgec kuyruk salinimiyla hafif gecikmeli aksin diye tegete dogru
    // kucuk bir suruklenme ekleniyor.
    const cp = crestGeo.attributes.position.array;
    for (let i = 0; i < crestRings; i++) {
      const si = CREST_SEG_START + i;
      const s = segs[si];
      const r = radiusAt(si / (N_SEGS - 1));
      const hgt = crestHeight(si);
      const flutter = Math.sin(now * 0.0021 + si * 0.42) * hgt * 0.13;

      const bx = s.x + s.ux * r * 0.96;
      const by = s.y + s.uy * r * 0.96;
      const bz = s.z + s.uz * r * 0.96;
      const o = i * 6;
      cp[o] = bx; cp[o + 1] = by; cp[o + 2] = bz;
      cp[o + 3] = bx + s.ux * hgt + s.tx * flutter;
      cp[o + 4] = by + s.uy * hgt + s.ty * flutter;
      cp[o + 5] = bz + s.uz * hgt + s.tz * flutter;
    }
    crestGeo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    scene.remove(mesh);
    scene.remove(crestMesh);
    geo.dispose();
    crestGeo.dispose();
  }

  return { mesh, crestMesh, setMaterials, update, dispose };
}
