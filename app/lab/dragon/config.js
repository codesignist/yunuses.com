// Ejderha deneyinin tum sabitleri ve stil tanimlari.
// Stiller saf veri; materyaller materials.js icindeki fabrikadan uretiliyor.

export const N_SEGS = 48;
export const SEG_LEN = 16;
export const SEG_GAP = 5;
export const CHAIN_DIST = SEG_LEN + SEG_GAP;

// Silueti tasiyan asil sey facet sayisi: 16'da kenar cizgisi kose kose
// okunuyordu. 24 hala ucuz (48 * 25 = 1200 vertex) ama profil yumusak.
export const N_FACETS = 24;
// Halka basina vertex sayisi: UV dikisi icin ilk vertex sonda tekrarlaniyor,
// yoksa son yuzeyde u geri sarip pul dokusunu ters yayiyor.
export const N_RING = N_FACETS + 1;

export const BODY_R = 20;
export const TAPER_START = 0.62;

export const IDLE_DELAY = 1500;
export const Z_AMP = 200;

export const MAX_BEND_RAD = (25 * Math.PI) / 180;
export const MAX_BEND_COS = Math.cos(MAX_BEND_RAD);
export const MAX_BEND_SIN = Math.sin(MAX_BEND_RAD);

// Bas hizli takip eder, kuyruk gecikir. Aradaki fark kamci hissini veriyor.
export const FOLLOW_HEAD = 0.9;
export const FOLLOW_TAIL = 0.34;

// Uzuvlarin "asagi"ya yonelme hizi (rad/sn) ve dunya referansinin gecerli
// sayildigi esik. Hiz siniri, govde donerken bacaklarin tek karede ters
// cevrilmesi yerine yumusak bir yuvarlanmayla duzelmesini sagliyor.
export const LIMB_ALIGN_RATE = 1.6;
export const LIMB_REF_MIN = 0.3;

export function radiusAt(t) {
  if (t >= 0.999) return 0;
  if (t < TAPER_START) {
    // Omuz bolgesi hafif kalin, boyun ince: duz silindir yerine profil.
    const n = t / TAPER_START;
    return BODY_R * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, n * 1.35)));
  }
  const k = (t - TAPER_START) / (1 - TAPER_START);
  return BODY_R * (1 - k * k) * 0.98;
}

// Yele tepeden basliyor, sirt sirti onun bittigi yerden devam edip
// kuyruk yuzgecine acilıyor. Ucu birbirine baglamak "yele aniden bitti"
// hissini kaldiriyor.
export const MANE_SEG_END = 34;
export const CREST_SEG_START = 26;
export const FIN_SEG_START = 39;

export const MANE_LAYERS = [
  { count: 460, lenMult: 0.95, baseOff: -0.05, lateralAmp: 0.55, lift: 0.4, seed: 1, colorIdx: 0 },
  { count: 420, lenMult: 1.05, baseOff: 0.05, lateralAmp: 0.4, lift: 0.55, seed: 1000, colorIdx: 1 },
  { count: 350, lenMult: 1.15, baseOff: 0.1, lateralAmp: 0.25, lift: 0.7, seed: 2000, colorIdx: 2 },
];

export const LEG_DEFS = [
  { segIdx: 7, side: -1 },
  { segIdx: 7, side: 1 },
  { segIdx: 30, side: -1 },
  { segIdx: 30, side: 1 },
];

export const N_WHISKER_RINGS = 18;
export const N_WHISKER_FACETS = 6;
export const N_WHISKER_SPAN = 14;
export const WHISKER_DEFS = [
  { side: -1, phase: 0 },
  { side: 1, phase: 0.9 },
];

export const HEAD_PROFILES = [
  [-14, 10],
  [-7, 17],
  [0, 22],
  [10, 25],
  [22, 26],
  [38, 24],
  [55, 19],
  [72, 13],
  [88, 7],
  [100, 2],
];
export const N_HEAD_RINGS = HEAD_PROFILES.length;
export const N_HEAD_FACETS = 16;

export const STYLES = {
  golge: {
    label: "Gölge",
    // Bu stil bilerek saf siluet: govde neredeyse isik almiyor, okunan sey
    // ayin onundeki kenar cizgisi. Env sadece kenarlarda ince bir parlaklik.
    light: 0xb6bccc,
    lightIntensity: 1.1,
    ambient: 0x10141c,
    ambientIntensity: 0.3,
    sky: ["#181f2c", "#080c14"],
    moonTint: 0xdfe8ff,
    moonGain: 2.3,
    mane: [0x0a0e14, 0x11161f, 0x1a212c],
    maneFlame: false,
    eye: { color: 0xeaf4ff, emissive: 0xa8c8f0, intensity: 2.2, halo: 0.3 },
    env: { horizon: "#243044", zenith: "#070b12", glow: "#8fa6c8", disc: 1.0, gain: 0.85 },
    body: { color: 0x161c26, metalness: 0.25, roughness: 0.42, envMapIntensity: 0.7 },
    head: { color: 0x161c26, metalness: 0.28, roughness: 0.38, envMapIntensity: 0.75 },
    limb: { color: 0x0d1118, metalness: 0.2, roughness: 0.55, envMapIntensity: 0.5 },
    crest: { color: 0x10151d, metalness: 0.2, roughness: 0.5 },
    bumpScale: 1.3,
    bloom: { strength: 0.42, radius: 0.5, threshold: 0.68 },
  },
  altin: {
    label: "Altın",
    light: 0xfff0c8,
    lightIntensity: 1.25,
    ambient: 0x2a1c08,
    ambientIntensity: 0.4,
    sky: ["#1a1408", "#0a0602"],
    moonTint: 0xffe9c0,
    moonGain: 1.9,
    mane: [0x3a2000, 0xb87614, 0xffd870],
    maneFlame: true,
    eye: { color: 0xfff4c0, emissive: 0xffc040, intensity: 2.6, halo: 0.34 },
    // Metalness 1.0 yansitacak bir sey olmadan siyah kalir. Env'in genis bir
    // alanini isikli tutmak altini altin yapan tek sey.
    env: { horizon: "#6d4a18", zenith: "#140c03", glow: "#ffc766", disc: 1.1, gain: 0.95 },
    body: { color: 0xffd070, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.15 },
    head: { color: 0xffd070, metalness: 1.0, roughness: 0.32, envMapIntensity: 1.1 },
    limb: { color: 0xc79430, metalness: 1.0, roughness: 0.42, envMapIntensity: 1.0 },
    crest: { color: 0xb8862a, metalness: 1.0, roughness: 0.38 },
    bumpScale: 1.2,
    bloom: { strength: 0.34, radius: 0.42, threshold: 0.78 },
  },
  cam: {
    label: "Cam",
    light: 0xeaf6ff,
    lightIntensity: 1.35,
    ambient: 0x1a2a3a,
    ambientIntensity: 0.55,
    sky: ["#0c1a26", "#03080e"],
    moonTint: 0xdff2ff,
    moonGain: 2.5,
    mane: [0x9fc8d8, 0xc4e2ec, 0xeaf8ff],
    maneFlame: false,
    eye: { color: 0xe0f4f8, emissive: 0x60b8d8, intensity: 2.4, halo: 0.32 },
    env: { horizon: "#2d5470", zenith: "#040a12", glow: "#bfe4ff", disc: 1.2, gain: 1.25 },
    // Transmission arkasindaki sahneyi orneklidigi icin gokyuzu ve ay artik
    // sahnenin icinde; onlar olmadan cam opak gri bir levha olarak cikiyordu.
    glass: {
      color: 0xd6ecf4,
      roughness: 0.06,
      transmission: 0.96,
      ior: 1.42,
      attenuationColor: 0x3f7f9c,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.5,
    },
    // Kafa parlak ayin onunde tam gecirgen olunca tamamen kayboluyordu;
    // gecirgenligi parca basina ayarlanabilir tutuyoruz.
    body: { thickness: 14, transmission: 0.93 },
    head: { thickness: 26, transmission: 0.68 },
    limb: { thickness: 8, transmission: 0.84 },
    crest: { color: 0xbfe0ec, metalness: 0.0, roughness: 0.15 },
    bumpScale: 0.9,
    bloom: { strength: 0.62, radius: 0.5, threshold: 0.55 },
  },
};

export const STYLE_IDS = Object.keys(STYLES);
