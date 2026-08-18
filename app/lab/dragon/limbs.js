import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { N_SEGS, LEG_DEFS, BODY_R } from "./config";

const LIMB_SCALE = 0.78;
// Omuz govdenin icinde kalmali. Disarida oldugunda uzuv govdeye degmeyen,
// yaninda yuzen ayri bir nesne gibi okunuyordu.
const ATT_OUT = BODY_R * 0.52;
const ATT_UP = BODY_R * 0.18;

/**
 * Isaretli hacim (diverjans teoremi). Negatif ise ucgen sarimi ice donuk,
 * yani three geriye donuk yuzleri ayiklarken nesnenin arka duvarini
 * gosteriyor ve computeVertexNormals ice bakan normal uretiyor.
 */
function signedVolume(geom) {
  const pos = geom.attributes.position.array;
  const idx = geom.index.array;
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    v +=
      pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) -
      pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) +
      pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return v / 6;
}

function flipWinding(geom) {
  const idx = geom.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i];
    idx[i] = idx[i + 2];
    idx[i + 2] = t;
  }
  geom.index.needsUpdate = true;
}

function mirrorGeomX(src) {
  const g = src.clone();
  const a = g.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) a[i] = -a[i];
  g.attributes.position.needsUpdate = true;
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

export function createLimbs(scene, spine, styleRef) {
  const legs = LEG_DEFS.map((def, i) => ({
    def,
    wrap: null,
    phase: i * 1.7,
  }));

  const baseGeoms = [];
  const mirrorGeoms = [];
  const meshes = [];
  let disposed = false;

  const basisR = new THREE.Vector3();
  const basisU = new THREE.Vector3();
  const basisF = new THREE.Vector3();
  const basisM = new THREE.Matrix4();
  const sway = new THREE.Quaternion();
  const AXIS_X = new THREE.Vector3(1, 0, 0);

  new OBJLoader().load(
    "/lab/dragon/limb.obj",
    (loaded) => {
      if (disposed) return;
      const sources = [];
      loaded.traverse((c) => {
        if (c.isMesh && c.geometry) {
          // OBJLoader indekssiz geometri uretir ve OBJ'de vn olmasa bile
          // per-face duz normal ekler. mergeVertices normalleri de hash'ledigi
          // icin ayni pozisyondaki vertexleri kaynatmaz; once normali silip
          // pozisyona gore kaynatiyoruz, sonra yumusak normal uretiyoruz.
          c.geometry.deleteAttribute("normal");
          const smoothed = mergeVertices(c.geometry);
          // limb.obj ice donuk sarimla gelmis: hacmi -27527. Duzeltilmeden
          // normaller ice bakiyor ve uzuvlar ters yuz gorunuyor.
          if (signedVolume(smoothed) < 0) flipWinding(smoothed);
          smoothed.computeVertexNormals();
          sources.push(smoothed);
        }
      });
      if (!sources.length) return;

      // Kafa OBJ'si hedef boyuta olceklenirken uzuvlar ham OBJ birimlerinde
      // birakilmisti. Pivotu omuza tasiyip olcegi tek yerden kontrol ediyoruz.
      const box = new THREE.Box3();
      for (const g of sources) {
        g.computeBoundingBox();
        box.union(g.boundingBox);
      }
      const pivot = new THREE.Vector3(0, box.max.y, 0);
      for (const g of sources) {
        g.translate(-pivot.x, -pivot.y, -pivot.z);
        g.scale(LIMB_SCALE, LIMB_SCALE, LIMB_SCALE);
        baseGeoms.push(g);
        mirrorGeoms.push(mirrorGeomX(g));
      }

      for (const leg of legs) {
        const wrap = new THREE.Group();
        const use = leg.def.side === 1 ? mirrorGeoms : baseGeoms;
        for (const g of use) {
          const mesh = new THREE.Mesh(g, styleRef.current.limb);
          mesh.frustumCulled = false;
          wrap.add(mesh);
          meshes.push(mesh);
        }
        scene.add(wrap);
        leg.wrap = wrap;
      }
    },
    undefined,
    (err) => console.warn("Dragon limb OBJ load failed:", err),
  );

  function setMaterials(set) {
    for (const m of meshes) m.material = set.limb;
  }

  function update(now) {
    const segs = spine.segs;
    for (const leg of legs) {
      if (!leg.wrap) continue;
      const def = leg.def;
      if (def.segIdx >= N_SEGS) continue;
      const s = segs[def.segIdx];

      // Paralel tasinan cerceve degil, dunya yukarisina gore turetilmis
      // cerceve. Oncekinde "asagi" diye bir bilgi olmadigi icin govde
      // kivrildikca bacaklar govdeden kopmus gibi rastgele yone doniyordu.
      leg.wrap.position.set(
        s.x + s.wrx * def.side * ATT_OUT + s.wux * ATT_UP,
        s.y + s.wry * def.side * ATT_OUT + s.wuy * ATT_UP,
        s.z + s.wrz * def.side * ATT_OUT + s.wuz * ATT_UP,
      );
      basisR.set(s.wrx, s.wry, s.wrz);
      basisU.set(s.wux, s.wuy, s.wuz);
      basisF.set(-s.tx, -s.ty, -s.tz);
      basisM.makeBasis(basisR, basisU, basisF);
      leg.wrap.quaternion.setFromRotationMatrix(basisM);

      sway.setFromAxisAngle(AXIS_X, Math.sin(now * 0.0013 + leg.phase) * 0.17);
      leg.wrap.quaternion.multiply(sway);
    }
  }

  function dispose() {
    disposed = true;
    for (const leg of legs) if (leg.wrap) scene.remove(leg.wrap);
    for (const g of baseGeoms) g.dispose();
    for (const g of mirrorGeoms) g.dispose();
  }

  return { setMaterials, update, dispose };
}
