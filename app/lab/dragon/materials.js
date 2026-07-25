import * as THREE from "three";
import { STYLES } from "./config";

// --- Prosedurel dokular ---------------------------------------------------

export function makeScaleBumpCanvas(size = 512) {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const COLS = 12;
  const ROWS = 14;
  const cellW = size / COLS;
  const cellH = size / ROWS;
  for (let r = -1; r <= ROWS + 1; r++) {
    for (let col = -1; col <= COLS + 1; col++) {
      const offX = (((r % 2) + 2) % 2) * cellW * 0.5;
      const cx = col * cellW + offX + cellW * 0.5;
      const cy = r * cellH + cellH * 0.5;
      const grad = ctx.createRadialGradient(cx, cy - cellH * 0.2, 1, cx, cy, cellW * 0.62);
      grad.addColorStop(0, "#f2f2f2");
      grad.addColorStop(0.55, "#909090");
      grad.addColorStop(1, "#1c1c1c");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.6, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return cv;
}

export function makeRadialCanvas(size, stops) {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  const h = size / 2;
  const grad = ctx.createRadialGradient(h, h, 0, h, h, h);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return cv;
}

/**
 * Isik yonunden equirect bir gokyuzu uretir. Uc sey icin lazim:
 * metalin yansitacak bir seyi olmasi, camin kiracak bir seyi olmasi,
 * ve yansimanin isikla ayni yerden gelmesi.
 * three'nin equirect konvansiyonu: u = atan2(z,x)/2pi + 0.5, v = asin(y)/pi + 0.5.
 */
export function makeEnvCanvas(envDef, lightDir, w = 1024, h = 512) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");

  const vert = ctx.createLinearGradient(0, 0, 0, h);
  vert.addColorStop(0.0, envDef.zenith);
  vert.addColorStop(0.42, envDef.horizon);
  vert.addColorStop(0.56, envDef.horizon);
  vert.addColorStop(1.0, envDef.zenith);
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, w, h);

  const d = lightDir.clone().normalize();
  const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5;
  const v = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI + 0.5;
  const px = u * w;
  const py = (1 - v) * h;

  // Genis yumusak parlama: metalin govde boyunca renk almasini bu saglıyor,
  // kucuk parlak disk tek basina sadece nokta highlight verir.
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(px, py, 0, px, py, w * 0.42);
  glow.addColorStop(0.0, hexToRgba(envDef.glow, 0.85 * envDef.gain));
  glow.addColorStop(0.25, hexToRgba(envDef.glow, 0.32 * envDef.gain));
  glow.addColorStop(0.6, hexToRgba(envDef.glow, 0.08 * envDef.gain));
  glow.addColorStop(1.0, hexToRgba(envDef.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Ay diski: keskin spekuler nokta.
  const discR = w * 0.028 * envDef.disc;
  const disc = ctx.createRadialGradient(px, py, 0, px, py, discR);
  disc.addColorStop(0.0, "rgba(255,255,255,1)");
  disc.addColorStop(0.7, "rgba(255,255,255,0.85)");
  disc.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = disc;
  ctx.fillRect(0, 0, w, h);

  // Karsi yonde zayif bir dolgu, aksi halde govdenin golge tarafi olu siyah.
  const fx = (px + w * 0.5) % w;
  const fill = ctx.createRadialGradient(fx, h * 0.62, 0, fx, h * 0.62, w * 0.34);
  fill.addColorStop(0.0, hexToRgba(envDef.horizon, 0.5 * envDef.gain));
  fill.addColorStop(1.0, hexToRgba(envDef.horizon, 0));
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  return cv;
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// --- Materyal fabrikasi ---------------------------------------------------

/**
 * Her stil icin {body, head, limb, crest} seti uretir. Onceden ucu de elle
 * yazilmis, neredeyse birebir ayni uc blok halindeydi; tek fark govde/kafa/uzuv
 * olmasina ragmen cam'da bump hic yoktu, kafada hicbir stilde yoktu.
 */
export function createMaterialSets(renderer, lightDir) {
  const bumpCanvas = makeScaleBumpCanvas();

  const bodyBump = new THREE.CanvasTexture(bumpCanvas);
  bodyBump.wrapS = THREE.RepeatWrapping;
  bodyBump.wrapT = THREE.RepeatWrapping;
  bodyBump.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Kafa OBJ'si kendi UV duzenini kullaniyor, govdenin bakilmis UV'si ile ayni
  // tekrar degeri tutmaz; ayri bir ornek gerekiyor.
  const headBump = new THREE.CanvasTexture(bumpCanvas);
  headBump.wrapS = THREE.RepeatWrapping;
  headBump.wrapT = THREE.RepeatWrapping;
  headBump.repeat.set(6, 6);
  headBump.anisotropy = bodyBump.anisotropy;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const sets = {};
  const envTargets = [];

  for (const [id, style] of Object.entries(STYLES)) {
    const envCanvas = makeEnvCanvas(style.env ?? STYLES.golge.env, lightDir);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    const target = pmrem.fromEquirectangular(envTex);
    envTex.dispose();
    envTargets.push(target);
    const envMap = target.texture;

    const isGlass = !!style.glass;
    const make = (part) => {
      const cfg = style[part] ?? {};
      if (isGlass) {
        const g = style.glass;
        return new THREE.MeshPhysicalMaterial({
          color: g.color,
          metalness: 0,
          roughness: g.roughness,
          transmission: cfg.transmission ?? g.transmission,
          thickness: cfg.thickness ?? 12,
          ior: g.ior,
          attenuationColor: new THREE.Color(g.attenuationColor),
          attenuationDistance: 45,
          clearcoat: g.clearcoat,
          clearcoatRoughness: g.clearcoatRoughness,
          envMap,
          envMapIntensity: g.envMapIntensity,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: cfg.color,
        metalness: cfg.metalness,
        roughness: cfg.roughness,
        envMap,
        envMapIntensity: cfg.envMapIntensity,
      });
    };

    const body = make("body");
    const head = make("head");
    const limb = make("limb");

    // Pul kabartmasi artik uc stilde de, hem govdede hem kafada.
    body.bumpMap = bodyBump;
    body.bumpScale = style.bumpScale;
    head.bumpMap = headBump;
    head.bumpScale = style.bumpScale * 0.6;

    const crestCfg = style.crest;
    const crest = new THREE.MeshStandardMaterial({
      color: crestCfg.color,
      metalness: crestCfg.metalness,
      roughness: crestCfg.roughness,
      envMap,
      envMapIntensity: isGlass ? 1.2 : (style.body.envMapIntensity ?? 1),
      side: THREE.DoubleSide,
      flatShading: true,
    });

    sets[id] = { body, head, limb, crest, envMap };
  }

  pmrem.dispose();

  function dispose() {
    for (const set of Object.values(sets)) {
      set.body.dispose();
      set.head.dispose();
      set.limb.dispose();
      set.crest.dispose();
    }
    for (const t of envTargets) t.dispose();
    bodyBump.dispose();
    headBump.dispose();
  }

  return { sets, dispose };
}
