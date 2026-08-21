import * as THREE from "three";
import { N_SEGS, MANE_LAYERS, MANE_SEG_END, radiusAt } from "./config";

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Silueti belirleyen sey en uzun tellerin zarfi. Zarf sabit oldugu icin yele
// testere disi gibi okunuyordu; dusuk frekansli bir profil tellere obek
// karakteri veriyor.
function maneProfile(t) {
  const envelope = Math.sin(Math.PI * Math.pow(0.14 + 0.86 * t, 0.85));
  const clusters =
    0.72 +
    0.2 * Math.sin(t * 13.7 + 0.6) +
    0.12 * Math.sin(t * 5.1 + 2.2) +
    0.08 * Math.sin(t * 29.3 + 4.1);
  return envelope * clusters;
}

const FIRE_VS = `
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

const FIRE_FS = `
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

    // Additive karisim HDR tamponda birikiyor; bloom esigini tek basina
    // asmamasi icin olcek dusuk tutuluyor.
    gl_FragColor = vec4(col * uIntensity * 0.5, 1.0);
  }
`;

export function createMane(scene, spine) {
  const layers = MANE_LAYERS.map((layer) => {
    const params = [];
    for (let i = 0; i < layer.count; i++) {
      const idx = i + layer.seed;
      params.push({
        baseT: hash(idx),
        lateralRand: (hash(idx + 73) - 0.5) * 2,
        // Genis dagilim: birkac tel belirgin sekilde uzun olsun diye kuvvet alindi.
        lenRand: 0.5 + Math.pow(hash(idx + 149), 1.7) * 1.5,
        widthRand: 1.6 + hash(idx + 211) * 1.3,
        phaseRand: hash(idx + 307) * Math.PI * 2,
        rotAngle: hash(idx + 401) * Math.PI * 2,
        tipTilt: (hash(idx + 547) - 0.5) * 1.6,
        sweep: 0.35 + hash(idx + 631) * 0.5,
      });
    }

    const pos = new Float32Array(layer.count * 12);
    const col = new Float32Array(layer.count * 12);
    const tip = new Float32Array(layer.count * 4);
    const idxArr = new Uint32Array(layer.count * 12);
    for (let i = 0; i < layer.count; i++) {
      const v0 = i * 4;
      tip[v0] = 0; tip[v0 + 1] = 0; tip[v0 + 2] = 0; tip[v0 + 3] = 1;
      const o = i * 12;
      idxArr[o] = v0;     idxArr[o + 1] = v0 + 1; idxArr[o + 2] = v0 + 2;
      idxArr[o + 3] = v0; idxArr[o + 4] = v0 + 3; idxArr[o + 5] = v0 + 1;
      idxArr[o + 6] = v0 + 1; idxArr[o + 7] = v0 + 3; idxArr[o + 8] = v0 + 2;
      idxArr[o + 9] = v0 + 2; idxArr[o + 10] = v0 + 3; idxArr[o + 11] = v0;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geom.setAttribute("aTip", new THREE.BufferAttribute(tip, 1));
    geom.setIndex(new THREE.BufferAttribute(idxArr, 1));

    // Teller aslinda hacimli birer diken; onceden isiksiz bir malzemeyle
    // cizildigi icin o hacim tamamen kayboluyor ve duz ucgen gibi duruyorlardi.
    // flatShading turevlerden normal urettigi icin normal attribute'u gerekmiyor.
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4 + layer.colorIdx;
    scene.add(mesh);
    return { layer, params, geom, mat, mesh };
  });

  const fireMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
      uColorBase: { value: new THREE.Color(0x6a1800) },
      uColorMid: { value: new THREE.Color(0xff5a14) },
      uColorTip: { value: new THREE.Color(0xfff080) },
    },
    vertexShader: FIRE_VS,
    fragmentShader: FIRE_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    // Additive + depthWrite:true celiskili bir kombinasyondu ve siralama
    // artefakti uretiyordu.
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Yele katmanlari tek bir tel kafes malzemesini paylasiyor: her diken
  // dort ucgen, uc katman toplaminda 1230 diken. Katman basina ayri
  // malzeme tutmanin gorsel karsiligi yok, rengi stilden aliyoruz.
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x6fdcff,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const tmpColor = new THREE.Color();

  function applyStyle(style) {
    const useFlame = !!style.maneFlame;
    const useWire = !!style.wireframe;
    if (useWire) {
      wireMat.color.setHex(style.mane[1]);
      wireMat.opacity = style.maneOpacity ?? 0.22;
    }
    for (const data of layers) {
      data.mesh.material = useFlame ? fireMat : useWire ? wireMat : data.mat;
      tmpColor.setHex(style.mane[data.layer.colorIdx]);
      const arr = data.geom.attributes.color.array;
      for (let v = 0; v < data.layer.count * 4; v++) {
        const o = v * 3;
        arr[o] = tmpColor.r;
        arr[o + 1] = tmpColor.g;
        arr[o + 2] = tmpColor.b;
      }
      data.geom.attributes.color.needsUpdate = true;
      // Kullanilmayan teller onceden sifirlaniyor ama index buffer'dan
      // cikmadigi icin origin'de dejenere ucgen olarak ciziliyordu.
      // Teller baseT'ye gore rastgele dagildigi icin bastan bir dilim almak
      // yeleyi duzgun seyreltiyor.
      const frac = style.maneFraction ?? 1;
      const drawn = Math.max(1, Math.floor(data.layer.count * frac));
      data.geom.setDrawRange(0, drawn * 12);
    }
  }

  function update(now, style) {
    const segs = spine.segs;
    if (style.maneFlame) {
      fireMat.uniforms.uTime.value = now * 0.001;
      const ff = 0.85 + 0.15 * Math.sin(now * 0.013) + 0.07 * Math.sin(now * 0.027 + 1.2);
      fireMat.uniforms.uIntensity.value = Math.max(0.6, ff);
    }

    for (const data of layers) {
      const { layer, params, geom } = data;
      const pos = geom.attributes.position.array;
      for (let i = 0; i < layer.count; i++) {
        const p = params[i];
        const segIdxF = MANE_SEG_END * p.baseT;
        const segI = Math.floor(segIdxF);
        if (segI >= N_SEGS - 2) continue;
        const f2 = segIdxF - segI;
        const f1 = 1 - f2;
        const sA = segs[segI];
        const sB = segs[segI + 1];

        const r = radiusAt(segIdxF / (N_SEGS - 1));

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
        const baseUp = 0.85 + layer.baseOff;
        const baseX = sx + sux * r * baseUp + srx * lateralOff;
        const baseY = sy + suy * r * baseUp + sry * lateralOff;
        const baseZ = sz + suz * r * baseUp + srz * lateralOff;

        const strokeLen =
          r * 1.15 * p.lenRand * layer.lenMult * maneProfile(p.baseT);
        const wave = Math.sin(now * 0.0011 + p.phaseRand) * 0.2;

        const cosR = Math.cos(p.rotAngle);
        const sinR = Math.sin(p.rotAngle);
        const sdx = stx * cosR + srx * sinR;
        const sdy = sty * cosR + sry * sinR;
        const sdz = stz * cosR + srz * sinR;
        const ppx = -stx * sinR + srx * cosR;
        const ppy = -sty * sinR + sry * cosR;
        const ppz = -stz * sinR + srz * cosR;

        const tipExtra = strokeLen * 0.4 * p.tipTilt;
        const back = p.sweep + wave;
        const tipX = baseX + stx * strokeLen * back + sux * strokeLen * layer.lift + srx * lateralOff * 1.3 + ppx * tipExtra;
        const tipY = baseY + sty * strokeLen * back + suy * strokeLen * layer.lift + sry * lateralOff * 1.3 + ppy * tipExtra;
        const tipZ = baseZ + stz * strokeLen * back + suz * strokeLen * layer.lift + srz * lateralOff * 1.3 + ppz * tipExtra;

        const halfW = r * 0.11 * p.widthRand;
        const HEX_H = 0.8660254;
        const o = i * 12;
        pos[o] = baseX + sdx * halfW;
        pos[o + 1] = baseY + sdy * halfW;
        pos[o + 2] = baseZ + sdz * halfW;
        pos[o + 3] = baseX + (-sdx * 0.5 + ppx * HEX_H) * halfW;
        pos[o + 4] = baseY + (-sdy * 0.5 + ppy * HEX_H) * halfW;
        pos[o + 5] = baseZ + (-sdz * 0.5 + ppz * HEX_H) * halfW;
        pos[o + 6] = baseX + (-sdx * 0.5 - ppx * HEX_H) * halfW;
        pos[o + 7] = baseY + (-sdy * 0.5 - ppy * HEX_H) * halfW;
        pos[o + 8] = baseZ + (-sdz * 0.5 - ppz * HEX_H) * halfW;
        pos[o + 9] = tipX;
        pos[o + 10] = tipY;
        pos[o + 11] = tipZ;
      }
      geom.attributes.position.needsUpdate = true;
    }
  }

  function dispose() {
    for (const data of layers) {
      scene.remove(data.mesh);
      data.geom.dispose();
      data.mat.dispose();
    }
    fireMat.dispose();
    wireMat.dispose();
  }

  return { applyStyle, update, dispose };
}
