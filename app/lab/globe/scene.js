import * as THREE from "three";
import { popAt } from "./data";

const R = 500;
const D2R = Math.PI / 180;
const FOV = 30;
// Duz haritada zemin arkaya yatiyor ki sutunlar boylariyla gorunsun; tam
// karsidan bakinca hepsi kameraya dogru uzanip noktaya donuyordu.
const TILT = -0.92;
// Haritanin dikey merkezi: kara noktalari -58 ile 84 arasinda.
const LAT_C = 13 * D2R;
const LAT_SPAN = 142 * D2R;
const MAX_H = R * 0.42;
const LAND_STEP = 0.7 * D2R;
const MORPH_SECONDS = 1.1;
const FLY_SECONDS = 1.2;

const COLORS = {
  backdrop: 0x0c1828,
  body: 0x03060b,
  rim: 0x1a2c46,
  atmosphere: 0x5682c0,
  land: 0x9db3d4,
  grid: 0x9db3d4,
  // Sodyum lamba rampasi: kucuk sehir koyu kehribar, mega kent beyaza
  // yakin. Gece uydudan gorunen sehir isiklarinin rengi.
  low: 0xa14d17,
  mid: 0xf39a3d,
  high: 0xffe9c8,
};

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Kure ve harita konumu ayni golgelendiricide karisiyor; gecis tek bir
// uniform (uMorph). Boylam uLon0'a gore goreli: haritaya gecerken ekranda
// o an ne varsa haritanin ortasina o geliyor, dikis arkada kaliyor.
const MORPH_GLSL = /* glsl */ `
  uniform float uMorph;
  uniform float uLon0;
  uniform float uR;
  uniform float uLatC;
  const float PI = 3.141592653589793;
  float wrapLon(float l) { return mod(l + PI, 2.0 * PI) - PI; }
  vec3 sphereDir(float lat, float lon) {
    float c = cos(lat);
    return vec3(sin(lon) * c, sin(lat), cos(lon) * c);
  }
  vec3 morphPosRel(float lat, float lonRel, float lift) {
    vec3 g = sphereDir(lat, lonRel) * (uR + lift);
    vec3 m = vec3(lonRel * uR, (lat - uLatC) * uR, lift);
    return mix(g, m, uMorph);
  }
  vec3 morphPos(float lat, float lon, float lift) {
    return morphPosRel(lat, wrapLon(lon - uLon0), lift);
  }
  vec3 morphUp(float lat, float lon) {
    return normalize(mix(sphereDir(lat, lon - uLon0), vec3(0.0, 0.0, 1.0), uMorph));
  }
  // Kenara yaklastikca noktalar sikisiyor; orada sonumlenince kure
  // hacimli okunuyor. Haritada etkisiz.
  float limbFade(vec3 worldPos, vec3 worldNormal) {
    float f = dot(normalize(worldNormal), normalize(cameraPosition - worldPos));
    return mix(smoothstep(0.0, 0.5, f), 1.0, uMorph);
  }
`;

const RAMP_GLSL = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  vec3 ramp(float t) {
    return t < 0.5 ? mix(uLow, uMid, t * 2.0) : mix(uMid, uHigh, t * 2.0 - 1.0);
  }
`;

// Nufus orani (0..1) ile renk konumu: renk logaritmik, boy dogrusal. Boy
// gercek buyuklugu tasiyor; renk olmasa 300 binlik sehirlerin hepsi ayni
// sonuk tonda kalirdi.
const MAG_GLSL = /* glsl */ `
  uniform float uLogSpan;
  float magnitude(float h) {
    return h > 0.0 ? clamp(1.0 + log(h) / uLogSpan, 0.0, 1.0) : 0.0;
  }
  uniform float uHover;
  uniform float uSel;
  float highlight(float idx) {
    return max(1.0 - step(0.5, abs(idx - uHover)), 1.0 - step(0.5, abs(idx - uSel)));
  }
`;

const LAND_VS = /* glsl */ `
  ${MORPH_GLSL}
  attribute vec2 aLL;
  uniform float uSize;
  varying float vA;
  void main() {
    vec4 wp = modelMatrix * vec4(morphPos(aLL.x, aLL.y, 0.6), 1.0);
    vA = limbFade(wp.xyz, mat3(modelMatrix) * morphUp(aLL.x, aLL.y));
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_PointSize = uSize;
  }
`;

const LAND_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.2, d) * vA * uAlpha);
  }
`;

// Enlem cizgilerinde parca dikise denk gelirse iki ucu haritanin iki
// kenarina dusup ekrani bastan basa cizecekti. Iki uc da parcanin orta
// noktasinin tarafina gore sariliyor.
const GRID_VS = /* glsl */ `
  ${MORPH_GLSL}
  attribute vec2 aLL;
  attribute float aMid;
  varying float vA;
  void main() {
    float lonRel = wrapLon(aMid - uLon0) + (aLL.y - aMid);
    vec4 wp = modelMatrix * vec4(morphPosRel(aLL.x, lonRel, 0.3), 1.0);
    vec3 n = normalize(mix(sphereDir(aLL.x, lonRel), vec3(0.0, 0.0, 1.0), uMorph));
    vA = limbFade(wp.xyz, mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GRID_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vA;
  void main() {
    gl_FragColor = vec4(uColor, uAlpha * vA);
  }
`;

const BASE_VS = /* glsl */ `
  ${MORPH_GLSL}
  ${MAG_GLSL}
  attribute vec2 aLL;
  attribute float aH;
  attribute float aIdx;
  uniform float uSize;
  varying float vMag;
  varying float vHi;
  varying float vA;
  void main() {
    vec4 wp = modelMatrix * vec4(morphPos(aLL.x, aLL.y, 0.9), 1.0);
    vA = limbFade(wp.xyz, mat3(modelMatrix) * morphUp(aLL.x, aLL.y));
    vMag = magnitude(aH);
    vHi = highlight(aIdx);
    gl_Position = projectionMatrix * viewMatrix * wp;
    // Sprite cekirdegin iki kati: kalan yer hale icin.
    gl_PointSize = uSize * (1.0 + 2.2 * vMag) * (1.0 + vHi * 1.4) * 2.0;
    // Boyu sifir olan nokta bile en az 1 px ciziliyor; kirpma alaninin
    // disina at.
    if (aH <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const BASE_FS = /* glsl */ `
  ${RAMP_GLSL}
  varying float vMag;
  varying float vHi;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.3, 0.5, d);
    float halo = pow(1.0 - d, 2.0) * 0.45;
    vec3 col = mix(ramp(vMag), vec3(1.0), vHi * 0.6);
    gl_FragColor = vec4(col, (core + halo) * vA * mix(0.8, 1.0, vHi));
  }
`;

// Her sutun kameraya donen tek bir dortgen: genislik ekranda sabit
// kaliyor, 2600 sutun icin tek cizim cagrisi.
const SPIKE_VS = /* glsl */ `
  ${MORPH_GLSL}
  ${MAG_GLSL}
  attribute vec2 aLL;
  attribute float aH;
  attribute float aIdx;
  uniform float uMaxH;
  uniform float uWidth;
  varying float vT;
  varying float vX;
  varying float vMag;
  varying float vHi;
  void main() {
    vec3 wb = (modelMatrix * vec4(morphPos(aLL.x, aLL.y, 0.9), 1.0)).xyz;
    vec3 wu = normalize(mat3(modelMatrix) * morphUp(aLL.x, aLL.y));
    vec3 side = cross(wu, normalize(cameraPosition - wb));
    float sl = length(side);
    side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
    vMag = magnitude(aH);
    vHi = highlight(aIdx);
    // Dortgen cekirdegin uc kati genis: kenarlar yumusak hale.
    float w = uWidth * (0.7 + 1.5 * vMag) * (1.0 + vHi * 0.9) * 3.0;
    vec3 p = wb + wu * (aH * uMaxH * position.y) + side * (w * position.x);
    vT = position.y;
    vX = position.x * 2.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const SPIKE_FS = /* glsl */ `
  ${RAMP_GLSL}
  varying float vT;
  varying float vX;
  varying float vMag;
  varying float vHi;
  void main() {
    float ax = abs(vX);
    float core = 1.0 - smoothstep(0.2, 0.34, ax);
    float halo = pow(1.0 - ax, 3.0) * 0.3;
    // Uca dogru parlayan sutun: deger tepede okunuyor.
    float lift = mix(0.45, 1.0, vT);
    vec3 col = mix(ramp(vMag), vec3(1.0), vHi * 0.7);
    float a = (core + halo) * lift * mix(0.65 + 0.35 * vMag, 1.0, vHi);
    gl_FragColor = vec4(col, a);
  }
`;

const BODY_VS = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BODY_FS = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
    gl_FragColor = vec4(uBody + uRim * pow(f, 3.0), 1.0);
  }
`;

// Arka yuzleri cizilen biraz buyuk bir kure. Parlama kurenin kenarinda en
// guclu, dis sinira dogru sifira iniyor; kurenin arkasina dusen kismi
// derinlik testi saklıyor.
const ATMO_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uEdge;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = -dot(normalize(vN), normalize(vV));
    float g = pow(smoothstep(0.0, uEdge, f), 2.4);
    gl_FragColor = vec4(uColor, g * uOpacity);
  }
`;

// Kurenin arkasinda cok hafif lacivert bir isima; siyah zemine derinlik
// veriyor. Koyu degradede bant olusmasin diye bir bitlik gurultu.
const BG_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BG_FS = /* glsl */ `
  uniform float uAspect;
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;
    float g = (1.0 - smoothstep(0.0, 0.8, length(p))) * uStrength;
    float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(uColor * g + (noise - 0.5) / 255.0, 1.0);
  }
`;

function buildGrid() {
  const ll = [];
  const mid = [];
  const seg = 2 * D2R;
  function push(lat1, lon1, lat2, lon2) {
    const m = (lon1 + lon2) / 2;
    ll.push(lat1, lon1, lat2, lon2);
    mid.push(m, m);
  }
  for (let lat = -30; lat <= 60; lat += 30) {
    const la = lat * D2R;
    for (let lon = -Math.PI; lon < Math.PI - 1e-6; lon += seg) push(la, lon, la, lon + seg);
  }
  const top = 84 * D2R;
  const bottom = -58 * D2R;
  for (let lonDeg = -180; lonDeg < 180; lonDeg += 30) {
    const lo = lonDeg * D2R;
    for (let la = bottom; la < top - 1e-6; la += seg) push(la, lo, Math.min(top, la + seg), lo);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("aLL", new THREE.Float32BufferAttribute(ll, 2));
  g.setAttribute("aMid", new THREE.Float32BufferAttribute(mid, 1));
  // three'nin cizim sayisini konumdan almasi icin; golgelendirici kullanmiyor.
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((ll.length / 2) * 3), 3));
  return g;
}

/**
 * Kureyi container'a kurar. data: loadGlobeData() ciktisi.
 * on: { hover(i), select(i), frame() }; i yoksa -1.
 * WebGL acilamazsa null doner.
 */
export function createGlobeScene(container, data, on) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    return null;
  }
  const maxPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(maxPR);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 60000);
  const group = new THREE.Group();
  scene.add(group);

  const n = data.count;
  const morphUniforms = {
    uMorph: { value: 0 },
    uLon0: { value: 0 },
    uR: { value: R },
    uLatC: { value: LAT_C },
  };
  const rampUniforms = {
    uLow: { value: new THREE.Color(COLORS.low) },
    uMid: { value: new THREE.Color(COLORS.mid) },
    uHigh: { value: new THREE.Color(COLORS.high) },
  };
  const magUniforms = {
    uLogSpan: { value: Math.log(data.maxPop / 300) },
    uHover: { value: -1 },
    uSel: { value: -1 },
  };

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uAspect: { value: 1 },
        uColor: { value: new THREE.Color(COLORS.backdrop) },
        uStrength: { value: 1 },
      },
      vertexShader: BG_VS,
      fragmentShader: BG_FS,
      depthTest: false,
      depthWrite: false,
    }),
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  // --- Kure govdesi ve atmosfer ---
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        uBody: { value: new THREE.Color(COLORS.body) },
        uRim: { value: new THREE.Color(COLORS.rim) },
      },
      vertexShader: BODY_VS,
      fragmentShader: BODY_FS,
    }),
  );
  body.renderOrder = 0;
  scene.add(body);

  const ATMO_SCALE = 1.16;
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * ATMO_SCALE, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(COLORS.atmosphere) },
        uEdge: { value: Math.sqrt(1 - 1 / (ATMO_SCALE * ATMO_SCALE)) },
        uOpacity: { value: 0.4 },
      },
      vertexShader: BODY_VS,
      fragmentShader: ATMO_FS,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  atmo.renderOrder = 1;
  scene.add(atmo);

  // --- Enlem/boylam cizgileri ---
  const gridGeo = buildGrid();
  const grid = new THREE.LineSegments(
    gridGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        ...morphUniforms,
        uColor: { value: new THREE.Color(COLORS.grid) },
        uAlpha: { value: 0.09 },
      },
      vertexShader: GRID_VS,
      fragmentShader: GRID_FS,
      transparent: true,
      depthWrite: false,
    }),
  );
  grid.frustumCulled = false;
  grid.renderOrder = 2;
  group.add(grid);

  // --- Kara noktalari ---
  const landCount = data.land.length / 2;
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute("aLL", new THREE.BufferAttribute(data.land, 2));
  landGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(landCount * 3), 3));
  const landMat = new THREE.ShaderMaterial({
    uniforms: {
      ...morphUniforms,
      uColor: { value: new THREE.Color(COLORS.land) },
      uAlpha: { value: 0.85 },
      uSize: { value: 2 },
    },
    vertexShader: LAND_VS,
    fragmentShader: LAND_FS,
    transparent: true,
    depthWrite: false,
  });
  const land = new THREE.Points(landGeo, landMat);
  land.frustumCulled = false;
  land.renderOrder = 3;
  group.add(land);

  // --- Sehirler: taban noktasi + sutun ---
  const ll = new Float32Array(n * 2);
  const idx = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ll[i * 2] = data.lat[i];
    ll[i * 2 + 1] = data.lon[i];
    idx[i] = i;
  }
  const heights = new Float32Array(n);
  const targets = new Float32Array(n);

  const baseGeo = new THREE.BufferGeometry();
  baseGeo.setAttribute("aLL", new THREE.BufferAttribute(ll, 2));
  const baseH = new THREE.BufferAttribute(heights, 1);
  baseH.setUsage(THREE.DynamicDrawUsage);
  baseGeo.setAttribute("aH", baseH);
  baseGeo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));
  baseGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const baseMat = new THREE.ShaderMaterial({
    uniforms: { ...morphUniforms, ...rampUniforms, ...magUniforms, uSize: { value: 2 } },
    vertexShader: BASE_VS,
    fragmentShader: BASE_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bases = new THREE.Points(baseGeo, baseMat);
  bases.frustumCulled = false;
  bases.renderOrder = 4;
  group.add(bases);

  const spikeGeo = new THREE.InstancedBufferGeometry();
  spikeGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
  );
  spikeGeo.setIndex([0, 1, 2, 0, 2, 3]);
  spikeGeo.setAttribute("aLL", new THREE.InstancedBufferAttribute(ll, 2));
  const spikeH = new THREE.InstancedBufferAttribute(heights, 1);
  spikeH.setUsage(THREE.DynamicDrawUsage);
  spikeGeo.setAttribute("aH", spikeH);
  spikeGeo.setAttribute("aIdx", new THREE.InstancedBufferAttribute(idx, 1));
  spikeGeo.instanceCount = n;
  const spikeMat = new THREE.ShaderMaterial({
    uniforms: {
      ...morphUniforms,
      ...rampUniforms,
      ...magUniforms,
      uMaxH: { value: MAX_H },
      uWidth: { value: 2.4 },
    },
    vertexShader: SPIKE_VS,
    fragmentShader: SPIKE_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spikes = new THREE.Mesh(spikeGeo, spikeMat);
  spikes.frustumCulled = false;
  spikes.renderOrder = 5;
  group.add(spikes);

  // Ayni uniform nesneleri butun malzemelerde paylasiliyor (spread degeri
  // degil nesneyi kopyaliyor), tek yerden guncellemek yetiyor.
  const U = { ...morphUniforms, ...magUniforms };

  // --- Durum ---
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const st = {
    view: "globe",
    morph: 0,
    e: 0,
    // Baslangicta Turkiye, Orta Dogu ve Hindistan ortada; Avrupa sol ustte.
    yaw: -45 * D2R,
    pitch: 24 * D2R,
    vy: 0,
    vp: 0,
    lon0: 0,
    panX: 0,
    panY: 0,
    zoom: 1,
    zoomTarget: 1,
    width: 1,
    height: 1,
    dGlobe: 3000,
    dMap: 4000,
    // Arayuzun kapladigi kenarlar: sagda liste (genis ekran), altta panel
    // (dar ekran). Kure ve harita kalan alanin ortasina yerlesiyor.
    safeRight: 0,
    safeBottom: 0,
    globeShiftX: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    downX: 0,
    downY: 0,
    downT: 0,
    moved: 0,
    pointers: new Map(),
    pinchStart: 0,
    pinchZoom: 1,
    lastInteract: -Infinity,
    pointer: { x: 0, y: 0, inside: false, mouse: false },
    hoverPick: -1,
    hover: -1,
    selected: -1,
    fly: null,
    heightsDirty: true,
    cursor: "",
    shiftX: 0,
    shiftY: 0,
  };

  // --- Boyut ve kamera ---
  const tanHalf = Math.tan((FOV / 2) * D2R);
  function layout() {
    const rect = container.getBoundingClientRect();
    st.width = Math.max(1, rect.width);
    st.height = Math.max(1, rect.height);
    renderer.setSize(st.width, st.height, false);
    camera.aspect = st.width / st.height;
    st.shiftX = st.shiftY = -1;
    camera.clearViewOffset();
    backdrop.material.uniforms.uAspect.value = camera.aspect;
    const freeW = Math.max(1, st.width - st.safeRight);
    const freeH = Math.max(1, st.height - st.safeBottom);
    // Kure capi bos alanin kisa kenarinin ~%60'i; dikey telefonda
    // genisligin cogu.
    const frac = freeW / freeH < 0.8 ? 0.84 : 0.6;
    const minSide = Math.min(freeW, freeH);
    st.dGlobe = (2 * R * st.height) / (frac * minSide) / (2 * tanHalf);
    // Kure ortada duruyor; sutunlar listeye tasacaksa yalniz o kadar sola.
    const reach = (frac * minSide) / 2 + (MAX_H / R) * ((frac * minSide) / 2);
    st.globeShiftX = Math.min(st.safeRight / 2, Math.max(0, st.width / 2 + reach - freeW));
    // Harita genislige sigiyor; dar ekranda o kadar uzaklasmak her seyi
    // kucultecegi icin yukseklige gore sinirlaniyor, gerisi kaydirarak. Pay
    // genis: egik zeminin guney kenari kameraya yakin, ortadan genis gorunuyor.
    const fitW = (2 * Math.PI * R * 1.15 * st.height) / (2 * tanHalf * freeW);
    const depth = LAT_SPAN * R * Math.cos(TILT) + MAX_H * Math.sin(-TILT);
    const fitH = (depth * 1.35 * st.height) / (2 * tanHalf * freeH);
    st.dMap = Math.min(fitW, fitH * (freeW < freeH ? 1.2 : 1.9));
  }
  const ro = new ResizeObserver(layout);
  ro.observe(container);
  layout();

  const distance = () => (st.dGlobe + (st.dMap - st.dGlobe) * st.e) / st.zoom;
  const pxPerUnit = () => st.height / (2 * distance() * tanHalf);

  // --- Yansitma (secim ve kart konumu icin) ---
  const mvp = new THREE.Matrix4();
  const invGroup = new THREE.Matrix4();
  const camLocal = new THREE.Vector3();
  const tmp = { x: 0, y: 0, ok: false };

  function updateProjection() {
    group.updateMatrixWorld();
    camera.updateMatrixWorld();
    mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(group.matrixWorld);
    invGroup.copy(group.matrixWorld).invert();
    camLocal.copy(camera.position).applyMatrix4(invGroup);
  }

  function project(x, y, z, out) {
    const m = mvp.elements;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) {
      out.ok = false;
      return out;
    }
    out.x = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) * 0.5 * st.width;
    out.y = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5 * st.height;
    out.ok = true;
    return out;
  }

  // Golgelendiricideki morphPos/morphUp'in CPU karsiligi.
  const city = { bx: 0, by: 0, bz: 0, tx: 0, ty: 0, tz: 0, facing: true };
  function cityGeom(i) {
    const lat = data.lat[i];
    const l = wrap(data.lon[i] - st.lon0);
    const e = st.e;
    const c = Math.cos(lat);
    const nx = Math.sin(l) * c;
    const ny = Math.sin(lat);
    const nz = Math.cos(l) * c;
    const lift = R + 0.9;
    city.bx = nx * lift + (l * R - nx * lift) * e;
    city.by = ny * lift + ((lat - LAT_C) * R - ny * lift) * e;
    city.bz = nz * lift + (0.9 - nz * lift) * e;
    let ux = nx * (1 - e);
    let uy = ny * (1 - e);
    let uz = nz * (1 - e) + e;
    const ul = Math.hypot(ux, uy, uz) || 1;
    const h = heights[i] * MAX_H;
    city.tx = city.bx + (ux / ul) * h;
    city.ty = city.by + (uy / ul) * h;
    city.tz = city.bz + (uz / ul) * h;
    city.facing =
      e > 0.5 ||
      nx * (camLocal.x - city.bx) + ny * (camLocal.y - city.by) + nz * (camLocal.z - city.bz) > 0;
    return city;
  }

  const pa = { x: 0, y: 0, ok: false };
  const pb = { x: 0, y: 0, ok: false };
  function pick(px, py, radius) {
    let best = -1;
    let bestD = radius * radius;
    let bestH = 0;
    for (let i = 0; i < n; i++) {
      if (heights[i] <= 0) continue;
      const g = cityGeom(i);
      if (!g.facing) continue;
      project(g.bx, g.by, g.bz, pa);
      project(g.tx, g.ty, g.tz, pb);
      if (!pa.ok || !pb.ok) continue;
      // Imlecin taban-tepe dogru parcasina uzakligi.
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? clamp(((px - pa.x) * dx + (py - pa.y) * dy) / len2, 0, 1) : 0;
      const ex = pa.x + dx * t - px;
      const ey = pa.y + dy * t - py;
      const d = ex * ex + ey * ey;
      if (d < bestD - 1 || (d <= bestD + 1 && heights[i] > bestH)) {
        best = i;
        bestD = d;
        bestH = heights[i];
      }
    }
    return best;
  }

  function anchor(i, out) {
    if (i < 0 || i >= n) {
      out.ok = false;
      return out;
    }
    const g = cityGeom(i);
    project(g.tx, g.ty, g.tz, out);
    if (out.ok && !g.facing) out.ok = false;
    return out;
  }

  // --- Etkilesim ---
  function setHighlight() {
    U.uHover.value = st.hover;
    U.uSel.value = st.selected;
  }

  function onDown(e) {
    container.setPointerCapture?.(e.pointerId);
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    st.pointer.mouse = e.pointerType === "mouse";
    if (st.pointers.size === 1) {
      st.dragging = true;
      st.lastX = st.downX = e.clientX;
      st.lastY = st.downY = e.clientY;
      st.downT = performance.now();
      st.moved = 0;
      st.vy = 0;
      st.vp = 0;
      st.fly = null;
    } else if (st.pointers.size === 2) {
      const [a, b] = [...st.pointers.values()];
      st.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      st.pinchZoom = st.zoom;
      st.dragging = false;
      st.moved = Infinity;
    }
    st.lastInteract = performance.now();
  }

  function onMove(e) {
    const rect = container.getBoundingClientRect();
    st.pointer.x = e.clientX - rect.left;
    st.pointer.y = e.clientY - rect.top;
    st.pointer.inside = true;
    st.pointer.mouse = e.pointerType === "mouse";
    if (st.pointers.has(e.pointerId)) st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.pointers.size === 2 && st.pinchStart > 0) {
      const [a, b] = [...st.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(st.pinchZoom * (d / st.pinchStart));
      st.zoom = st.zoomTarget;
      return;
    }
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX;
    const dy = e.clientY - st.lastY;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.moved += Math.abs(dx) + Math.abs(dy);
    if (st.morph > 0 && st.morph < 1) return;
    if (st.view === "globe") {
      // Imlecin altindaki nokta parmakla birlikte gitsin: aci = piksel / yaricap.
      const k = 1 / (R * pxPerUnit());
      st.yaw += dx * k;
      st.pitch += dy * k;
      st.vy = dx * k;
      st.vp = dy * k;
    } else {
      const u = 1 / pxPerUnit();
      st.panX += dx * u;
      st.panY -= dy * u;
    }
    st.lastInteract = performance.now();
  }

  function onUp(e) {
    st.pointers.delete(e.pointerId);
    container.releasePointerCapture?.(e.pointerId);
    if (st.pointers.size < 2) st.pinchStart = 0;
    if (st.pointers.size === 0) {
      const tap = st.dragging && st.moved < 6 && performance.now() - st.downT < 600;
      st.dragging = false;
      if (tap) {
        const rect = container.getBoundingClientRect();
        updateProjection();
        const hit = pick(
          e.clientX - rect.left,
          e.clientY - rect.top,
          e.pointerType === "mouse" ? 9 : 22,
        );
        on.select?.(hit);
      }
    } else if (st.pointers.size === 1) {
      const [rem] = [...st.pointers.values()];
      st.lastX = rem.x;
      st.lastY = rem.y;
      st.dragging = true;
    }
    st.lastInteract = performance.now();
  }

  function onLeave() {
    st.pointer.inside = false;
  }

  function setZoom(z) {
    const [lo, hi] = st.view === "globe" ? [0.6, 4] : [0.7, 6];
    st.zoomTarget = clamp(z, lo, hi);
    st.lastInteract = performance.now();
  }

  // Attractors'taki ayar: adim kaydirma miktariyla orantili, ctrl+wheel
  // (trackpad'de iki parmak) daha hassas.
  function onWheel(e) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
    const lim = e.ctrlKey ? 20 : 150;
    const d = clamp(e.deltaY * unit, -lim, lim);
    const k = e.ctrlKey ? 0.01 : 0.0012;
    setZoom(st.zoom * Math.exp(-d * k));
  }

  container.addEventListener("pointerdown", onDown);
  container.addEventListener("pointermove", onMove);
  container.addEventListener("pointerup", onUp);
  container.addEventListener("pointercancel", onUp);
  container.addEventListener("pointerleave", onLeave);
  container.addEventListener("wheel", onWheel, { passive: false });

  // --- Dongu ---
  let raf = 0;
  let prevT = 0;
  const qGlobe = new THREE.Quaternion();
  const qMap = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0));
  const euler = new THREE.Euler(0, 0, 0, "XYZ");

  function step(now) {
    const dt = prevT ? Math.min(0.1, (now - prevT) / 1000) : 0;
    prevT = now;
    const frames = dt * 60;
    const still = reduceMotion.matches;

    // Gecis
    const target = st.view === "map" ? 1 : 0;
    if (st.morph !== target) {
      const d = still ? 1 : dt / MORPH_SECONDS;
      st.morph = target > st.morph ? Math.min(1, st.morph + d) : Math.max(0, st.morph - d);
      if (st.morph === 0) st.panY = 0;
    }
    st.e = easeInOutCubic(st.morph);

    // Ucus
    if (st.fly) {
      const f = st.fly;
      const t = still ? 1 : Math.min(1, (now - f.t0) / (FLY_SECONDS * 1000));
      const k = easeInOutCubic(t);
      for (const key of f.keys) st[key] = f.from[key] + (f.to[key] - f.from[key]) * k;
      if (t >= 1) st.fly = null;
    }

    // Donus ve atalet (60 Hz kare birimiyle yazili, frames ile olcekli)
    if (st.view === "globe" && st.morph === 0 && !st.dragging && !st.fly) {
      st.yaw += st.vy * frames;
      st.pitch += st.vp * frames;
      const decay = Math.pow(0.94, frames);
      st.vy *= decay;
      st.vp *= decay;
      const idle = now - st.lastInteract > 3000;
      if (idle && !still && st.hover < 0 && st.selected < 0) st.yaw += 0.0007 * frames;
    }
    if (st.zoom !== st.zoomTarget) {
      const k = still ? 1 : 1 - Math.pow(0.78, frames);
      st.zoom += (st.zoomTarget - st.zoom) * k;
      if (Math.abs(st.zoomTarget - st.zoom) < 1e-4) st.zoom = st.zoomTarget;
    }
    st.pitch = clamp(st.pitch, -1.25, 1.25);
    st.panX = clamp(st.panX, -Math.PI * R, Math.PI * R);
    st.panY = clamp(st.panY, -LAT_SPAN * R * 0.5, LAT_SPAN * R * 0.5);

    // Boylar: yil degisince hedefe yumusak yaklasiyor; ilk acilista
    // sutunlar sifirdan buyuyor.
    if (st.heightsDirty) {
      const k = still ? 1 : 1 - Math.pow(1 - 0.14, frames);
      let moving = false;
      for (let i = 0; i < n; i++) {
        const d = targets[i] - heights[i];
        if (Math.abs(d) > 1e-5) {
          heights[i] += d * k;
          moving = true;
        } else {
          heights[i] = targets[i];
        }
      }
      baseH.needsUpdate = true;
      spikeH.needsUpdate = true;
      st.heightsDirty = moving;
    }

    // Grup ve kamera
    euler.set(st.pitch, st.yaw, 0);
    qGlobe.setFromEuler(euler);
    group.quaternion.slerpQuaternions(qGlobe, qMap, st.e);
    group.position.set(st.panX * st.e, st.panY * st.e, 0);
    camera.position.set(0, 0, distance());
    camera.lookAt(0, 0, 0);
    // Sahnenin ortasi bos alanin ortasina kayiyor: haritada listenin soluna,
    // dar ekranda alt panelin ustune.
    const shiftX = Math.round(st.globeShiftX + (st.safeRight / 2 - st.globeShiftX) * st.e);
    const shiftY = Math.round(st.safeBottom / 2);
    if (shiftX !== st.shiftX || shiftY !== st.shiftY) {
      st.shiftX = shiftX;
      st.shiftY = shiftY;
      if (shiftX || shiftY) camera.setViewOffset(st.width, st.height, shiftX, shiftY, st.width, st.height);
      else camera.clearViewOffset();
    }
    const s = Math.max(0.001, 1 - st.e * 1.6);
    body.scale.setScalar(s);
    atmo.scale.setScalar(s);
    atmo.material.uniforms.uOpacity.value = 0.4 * (1 - st.e);
    body.visible = s > 0.002;
    atmo.visible = body.visible;

    U.uMorph.value = st.e;
    U.uLon0.value = st.lon0;

    // Nokta boyu kara noktalarinin ekrandaki araligindan: yakinlasinca
    // buyuyor, haritada kuculuyor.
    const ppu = pxPerUnit();
    const spacing = LAND_STEP * R * ppu;
    landMat.uniforms.uSize.value = clamp(spacing * 0.48, 1.2, 3.6) * maxPR;
    baseMat.uniforms.uSize.value = clamp(spacing * 0.42, 1.3, 3) * maxPR;
    // Sutun cekirdegi dunya biriminde; ekranda ~1.5 px'ten ince kalmasin.
    spikeMat.uniforms.uWidth.value = Math.max(2.4, 1.5 / ppu);

    updateProjection();

    // Imlec hareketsizken de kure altinda donuyor; secimi her karede yenile.
    let hp = -1;
    if (st.pointer.inside && st.pointer.mouse && !st.dragging && st.pointers.size === 0) {
      hp = pick(st.pointer.x, st.pointer.y, 9);
    }
    if (hp !== st.hoverPick) {
      st.hoverPick = hp;
      on.hover?.(hp);
    }
    const cursor = st.dragging ? "grabbing" : hp >= 0 ? "pointer" : "grab";
    if (cursor !== st.cursor) {
      st.cursor = cursor;
      container.style.cursor = cursor;
    }

    renderer.render(scene, camera);
    on.frame?.();
    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);

  // --- Disari acilan arayuz ---
  return {
    setYear(year) {
      const inv = 1 / data.maxPop;
      for (let i = 0; i < n; i++) targets[i] = popAt(data, i, year) * inv;
      st.heightsDirty = true;
    },
    setView(view) {
      if (view === st.view) return;
      if (view === "map") {
        // Ekranin ortasindaki boylam haritanin ortasi olsun.
        st.lon0 = wrap(st.lon0 - st.yaw);
        st.yaw = 0;
        st.panX = 0;
        st.panY = 0;
      } else {
        st.lon0 = wrap(st.lon0 - st.panX / R);
        st.panX = 0;
        st.yaw = 0;
      }
      st.vy = 0;
      st.vp = 0;
      st.fly = null;
      st.zoomTarget = 1;
      st.view = view;
    },
    setHighlight(hover, selected) {
      st.hover = hover;
      st.selected = selected;
      setHighlight();
    },
    flyTo(i) {
      if (i < 0 || i >= n) return;
      const lat = data.lat[i];
      const lon = data.lon[i];
      if (st.view === "globe") {
        const yaw = st.yaw + wrap(st.lon0 - lon - st.yaw);
        st.fly = {
          t0: performance.now(),
          keys: ["yaw", "pitch"],
          from: { yaw: st.yaw, pitch: st.pitch },
          // Sehir tam ortada olsa sutunu kameraya bakar, nokta gibi gorunur;
          // biraz yukarida durunca sutun boyuyla okunuyor.
          to: { yaw, pitch: clamp(lat - 0.42, -1.25, 1.25) },
        };
      } else {
        st.fly = {
          t0: performance.now(),
          keys: ["panX", "panY"],
          from: { panX: st.panX, panY: st.panY },
          to: {
            panX: -wrap(lon - st.lon0) * R,
            panY: -(lat - LAT_C) * R * Math.cos(TILT),
          },
        };
      }
      st.vy = 0;
      st.vp = 0;
      st.lastInteract = performance.now();
    },
    anchor(i) {
      return anchor(i, tmp);
    },
    size() {
      return { width: st.width, height: st.height };
    },
    setSafeArea(right, bottom) {
      if (right === st.safeRight && bottom === st.safeBottom) return;
      st.safeRight = right;
      st.safeBottom = bottom;
      layout();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("wheel", onWheel);
      container.style.cursor = "";
      for (const obj of [backdrop, body, atmo, grid, land, bases, spikes]) {
        obj.geometry.dispose();
        obj.material.dispose();
      }
      renderer.dispose();
      // Baglami hemen birak, GPU bellegi cop toplayiciyi beklemesin.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
