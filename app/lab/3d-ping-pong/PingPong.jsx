"use client";
import { useEffect, useRef, useState } from "react";

const BOX_S = 640;
const BOX_D = 1800;
const HALF_S = BOX_S / 2;
const HALF_D = BOX_D / 2;

const PADDLE = 210;
const HALF_PADDLE = PADDLE / 2;

const BALL_R = 26;

const CAM_DIST = HALF_D + 720;
const NEAR_DIST = CAM_DIST - HALF_D;

// Raketler prizmanın tam yakın/uzak yüzlerinde — köşeleri prizma köşelerine
// sıfırlanabilsin diye derinlikleri yüzeylerle aynı.
const PLAYER_Z = -HALF_D;
const AI_Z = HALF_D;

const COLOR_PLAYER = "120, 180, 255";
const COLOR_AI = "255, 90, 90";

// Box yarısının ekrana sığması için margin (yaw/pitch için ekstra pay)
const SAFE_MARGIN = 0.88;

// Top spawn animasyonu süresi (ms) ve motion blur trail uzunluğu
const SPAWN_DURATION = 700;
const TRAIL_MAX = 8;

// Bir tur süresi (ms) — sonunda oyun biter ve paylaşım ekranı çıkar
const GAME_DURATION = 90000;
const SHARE_URL = "https://yunuses.com/lab/3d-ping-pong";

// Modlar
const MODE_TIME = "time";
const MODE_SURVIVAL = "survival";

// Survival mod parametreleri
const SURVIVAL_LIVES = 3;
const BULLET_COOLDOWN_MS = 350;
const BULLET_RADIUS = 6;
const BULLET_SPEED = 32;
const BULLET_BONUS = 3;
const AI_STUN_MS = 280;

// =====================================================================
// Web Audio — küçük programatik beep'ler. Asset yok, tek osilatör senteziyle
// klasik arcade ses paleti. AudioContext ilk user gesture'da uyanır.
// =====================================================================

let _audioCtx = null;
let _audioMuted = false;

function loadMutedFromStorage() {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem("pingpong_muted") === "1";
  } catch {
    return false;
  }
}

function persistMuted(m) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("pingpong_muted", m ? "1" : "0");
  } catch {}
}

function setAudioMuted(m) {
  _audioMuted = m;
  persistMuted(m);
}

function getAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      _audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return _audioCtx;
}

function blip(freq, duration, type = "sine", gain = 0.14, glide = 0) {
  if (_audioMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      ctx.resume();
    } catch {}
  }
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(
    Math.max(40, freq + glide),
    t + duration
  );
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const SFX = {
  wallHit(speedFactor) {
    // hız skala 0..1; sert vuruş daha tiz ve gür
    const s = Math.max(0, Math.min(1, speedFactor));
    blip(200 + s * 280, 0.05, "square", 0.06 + s * 0.06);
  },
  playerHit() {
    blip(540, 0.08, "sine", 0.16, -120);
    blip(270, 0.05, "triangle", 0.08);
  },
  aiHit() {
    blip(330, 0.07, "sine", 0.12, -60);
  },
  scoreSelf() {
    // kazandık — yükselen üçlü
    blip(440, 0.16, "sine", 0.13);
    setTimeout(() => blip(554, 0.16, "sine", 0.13), 75);
    setTimeout(() => blip(660, 0.22, "sine", 0.13), 150);
  },
  scoreOther() {
    // kaçırdık — alçalan ikili (minor third)
    blip(392, 0.18, "sine", 0.12);
    setTimeout(() => blip(311, 0.22, "sine", 0.12), 95);
  },
  gameOver() {
    blip(880, 0.16, "square", 0.1);
    setTimeout(() => blip(660, 0.16, "square", 0.1), 120);
    setTimeout(() => blip(440, 0.32, "square", 0.1), 240);
  },
  bullet() {
    // kısa "pew" — yüksek frekans, hızla düşen pitch
    blip(1100, 0.07, "square", 0.07, -700);
  },
  bulletHit() {
    // CPU'ya isabet — kısa parlak ikili
    blip(720, 0.06, "square", 0.1);
    setTimeout(() => blip(960, 0.08, "square", 0.09), 35);
  },
  loseLife() {
    // can kaybı — alçalan üçlü, dramatik
    blip(330, 0.14, "sawtooth", 0.12, -120);
    setTimeout(() => blip(220, 0.18, "sawtooth", 0.12, -80), 90);
  },
};

// =====================================================================
// 7-segment dijital basamak çizimi — fontsız, vektör tabanlı LED hissi
// =====================================================================

const SEG_DIGITS = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
};

function drawSegHex(ctx, x1, y1, x2, y2, dir, rgb, alpha, glow) {
  if (alpha < 0.005) return;
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(${rgb}, ${0.65 * glow})`;
    ctx.shadowBlur = 6 * glow;
  }
  ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
  ctx.beginPath();
  if (dir === "h") {
    const half = (y2 - y1) / 2;
    ctx.moveTo(x1 + half, y1);
    ctx.lineTo(x2 - half, y1);
    ctx.lineTo(x2, y1 + half);
    ctx.lineTo(x2 - half, y2);
    ctx.lineTo(x1 + half, y2);
    ctx.lineTo(x1, y1 + half);
  } else {
    const half = (x2 - x1) / 2;
    ctx.moveTo(x1, y1 + half);
    ctx.lineTo(x1 + half, y1);
    ctx.lineTo(x2, y1 + half);
    ctx.lineTo(x2, y2 - half);
    ctx.lineTo(x1 + half, y2);
    ctx.lineTo(x1, y2 - half);
  }
  ctx.closePath();
  ctx.fill();
  if (glow > 0) ctx.restore();
}

function drawSevenSegDigit(ctx, cx, cy, char, height, rgb, glow) {
  const h = height;
  const w = h * 0.58;
  const t = Math.max(1.4, h * 0.1); // segment kalınlığı
  const g = Math.max(0.5, h * 0.045); // segmentler arası çok ince boşluk

  const x = cx - w / 2;
  const y = cy - h / 2;

  // Segment koordinatları: [x1, y1, x2, y2, "h"|"v"]
  const segs = {
    a: [x + t + g, y, x + w - t - g, y + t, "h"],
    b: [x + w - t, y + t + g, x + w, y + h / 2 - g, "v"],
    c: [x + w - t, y + h / 2 + g, x + w, y + h - t - g, "v"],
    d: [x + t + g, y + h - t, x + w - t - g, y + h, "h"],
    e: [x, y + h / 2 + g, x + t, y + h - t - g, "v"],
    f: [x, y + t + g, x + t, y + h / 2 - g, "v"],
    g: [x + t + g, y + h / 2 - t / 2, x + w - t - g, y + h / 2 + t / 2, "h"],
  };

  const lit = SEG_DIGITS[char] || [];

  // Önce off segmentler (faint LED hayaleti), sonra aktif
  for (const k in segs) {
    if (lit.includes(k)) continue;
    const s = segs[k];
    drawSegHex(ctx, s[0], s[1], s[2], s[3], s[4], rgb, 0.07, 0);
  }
  for (const k of lit) {
    const s = segs[k];
    drawSegHex(ctx, s[0], s[1], s[2], s[3], s[4], rgb, 1, glow);
  }
}

function drawHudPill(ctx, x, y, w, h) {
  const r = h / 2;
  // Outer fill
  ctx.fillStyle = "rgba(6, 8, 14, 0.82)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  ctx.fill();

  // Üstten gelen hafif ışık + altta gölge — boyutsal his
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  grad.addColorStop(0.42, "rgba(255, 255, 255, 0)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = grad;
  ctx.fill();

  // İnce çerçeve
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, Math.max(0, r - 0.5));
  else {
    const rr = Math.max(0, r - 0.5);
    const xx = x + 0.5;
    const yy = y + 0.5;
    const ww = w - 1;
    const hh = h - 1;
    ctx.moveTo(xx + rr, yy);
    ctx.lineTo(xx + ww - rr, yy);
    ctx.arcTo(xx + ww, yy, xx + ww, yy + rr, rr);
    ctx.lineTo(xx + ww, yy + hh - rr);
    ctx.arcTo(xx + ww, yy + hh, xx + ww - rr, yy + hh, rr);
    ctx.lineTo(xx + rr, yy + hh);
    ctx.arcTo(xx, yy + hh, xx, yy + hh - rr, rr);
    ctx.lineTo(xx, yy + rr);
    ctx.arcTo(xx, yy, xx + rr, yy, rr);
    ctx.closePath();
  }
  ctx.stroke();
}

function drawHudDivider(ctx, x, cy, h) {
  const grad = ctx.createLinearGradient(x, cy - h / 2, x, cy + h / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 0)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.22)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, cy - h / 2, 1, h);
}

// JSX/SVG için 7-segment digit. Canvas'taki LED segmentleriyle birebir
// paylaşılan SEG_DIGITS haritasını kullanır — game over ekranındaki büyük
// skorlar HUD'la aynı dilden konuşur.
function SevenSegDigit({ char, height = 62, rgb }) {
  const w = height * 0.58;
  const h = height;
  const t = Math.max(2, h * 0.1);
  const g = Math.max(0.8, h * 0.045);

  const segs = [
    ["a", t + g, 0, w - t - g, t, "h"],
    ["b", w - t, t + g, w, h / 2 - g, "v"],
    ["c", w - t, h / 2 + g, w, h - t - g, "v"],
    ["d", t + g, h - t, w - t - g, h, "h"],
    ["e", 0, h / 2 + g, t, h - t - g, "v"],
    ["f", 0, t + g, t, h / 2 - g, "v"],
    ["g", t + g, h / 2 - t / 2, w - t - g, h / 2 + t / 2, "h"],
  ];

  const lit = SEG_DIGITS[char] || [];

  const buildPath = (x1, y1, x2, y2, dir) => {
    if (dir === "h") {
      const half = (y2 - y1) / 2;
      return `M${x1 + half} ${y1} L${x2 - half} ${y1} L${x2} ${y1 + half} L${x2 - half} ${y2} L${x1 + half} ${y2} L${x1} ${y1 + half} Z`;
    }
    const half = (x2 - x1) / 2;
    return `M${x1} ${y1 + half} L${x1 + half} ${y1} L${x2} ${y1 + half} L${x2} ${y2 - half} L${x1 + half} ${y2} L${x1} ${y2 - half} Z`;
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {segs.map(([key, x1, y1, x2, y2, dir]) => {
        const isLit = lit.includes(key);
        return (
          <path
            key={key}
            d={buildPath(x1, y1, x2, y2, dir)}
            fill={`rgba(${rgb}, ${isLit ? 1 : 0.07})`}
            style={
              isLit
                ? { filter: `drop-shadow(0 0 4px rgba(${rgb}, 0.55))` }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}

function ScoreBlock({ value, rgb, label, digits = 2 }) {
  const isPlaceholder = value == null;
  const max = Math.pow(10, digits) - 1;
  const str = isPlaceholder
    ? "-".repeat(digits)
    : String(Math.min(max, Math.max(0, value))).padStart(digits, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        className="flex gap-1.5 px-4 py-3 rounded-md border"
        style={{
          background: `rgba(${rgb}, ${isPlaceholder ? 0.03 : 0.06})`,
          borderColor: `rgba(${rgb}, ${isPlaceholder ? 0.18 : 0.28})`,
          boxShadow: isPlaceholder
            ? "none"
            : `inset 0 0 28px rgba(${rgb}, 0.1)`,
        }}
      >
        {str.split("").map((d, i) => (
          <SevenSegDigit key={i} char={d} height={62} rgb={rgb} />
        ))}
      </div>
      <div
        className="mt-2.5 text-[10px] tracking-[0.4em] font-mono"
        style={{ color: `rgba(${rgb}, ${isPlaceholder ? 0.45 : 0.75})` }}
      >
        {label}
      </div>
    </div>
  );
}

export default function PingPong() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [, setTimeLeft] = useState(GAME_DURATION);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState(MODE_TIME);
  const [lives, setLives] = useState(SURVIVAL_LIVES);
  const stateRef = useRef(null);

  useEffect(() => {
    const m = loadMutedFromStorage();
    _audioMuted = m;
    setMuted(m);
    // mod tercihi de hatırlanıyor — hem React hem mutable state'e yansıt
    try {
      const saved = localStorage.getItem("pingpong_mode");
      if (saved === MODE_SURVIVAL || saved === MODE_TIME) {
        setMode(saved);
        if (stateRef.current) stateRef.current.mode = saved;
      }
    } catch {}
  }, []);

  const switchMode = (m) => {
    setMode(m);
    try {
      localStorage.setItem("pingpong_mode", m);
    } catch {}
    // HUD canvas tarafı state.mode'a bakıyor — anında senkronize et
    if (stateRef.current) stateRef.current.mode = m;
  };

  const toggleMute = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
  };

  // Oyun mantığı + render
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");

    const state = {
      mouse: { x: 0, y: 0 },
      cam: { yaw: 0, pitch: 0 },
      ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      ai: { x: 0, y: 0 },
      score: { player: 0, ai: 0 },
      running: false,
      width: 0,
      height: 0,
      focal: 720,
      hitFlash: 0,
      aiHitFlash: 0,
      missFlash: 0,
      scoreFlash: 0,
      speedMult: 1,
      shakePower: 0,
      shakeT: 0,
      shakeX: 0,
      shakeY: 0,
      ballTrail: [],
      spawnT: 0,
      ripples: [],
      gameTime: 0,
      gameOver: false,
      // mode başlangıç değeri için localStorage'a bak — overlay arkasındaki
      // HUD ilk frame'de doğru moda göre çizilsin.
      mode: (() => {
        try {
          const saved =
            typeof localStorage !== "undefined"
              ? localStorage.getItem("pingpong_mode")
              : null;
          if (saved === MODE_SURVIVAL || saved === MODE_TIME) return saved;
        } catch {}
        return MODE_TIME;
      })(),
      lives: SURVIVAL_LIVES,
      bullets: [],
      bulletCooldownT: 0,
      bulletPending: false,
      aiStun: 0,
      playerX: 0,
      playerY: 0,
    };

    stateRef.current = state;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    // Contain mantığı: kutu near face hem yatay hem dikey ekrana sığar
    const computeFocal = (w, h) => {
      const halfW = (w * SAFE_MARGIN) / 2;
      const halfH = (h * SAFE_MARGIN) / 2;
      // halfScreen = HALF_S * focal / NEAR_DIST  →  focal = halfScreen * NEAR_DIST / HALF_S
      const focalW = (halfW * NEAR_DIST) / HALF_S;
      const focalH = (halfH * NEAR_DIST) / HALF_S;
      return Math.min(focalW, focalH);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(180, Math.floor(rect.height));
      state.width = w;
      state.height = h;
      state.focal = computeFocal(w, h);
      const r = dpr();
      canvas.width = Math.floor(w * r);
      canvas.height = Math.floor(h * r);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(r, 0, 0, r, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const setMouse = (cx, cy) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((cx - rect.left) / rect.width) * 2 - 1;
      const ny = ((cy - rect.top) / rect.height) * 2 - 1;
      state.mouse.x = Math.max(-1, Math.min(1, nx));
      state.mouse.y = Math.max(-1, Math.min(1, ny));
    };

    const onMouseMove = (e) => setMouse(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.touches[0]) {
        e.preventDefault();
        setMouse(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const beginRound = (selectedMode) => {
      const m = selectedMode === MODE_SURVIVAL ? MODE_SURVIVAL : MODE_TIME;
      state.mode = m;
      state.score.player = 0;
      state.score.ai = 0;
      setScore({ player: 0, ai: 0 });
      state.gameTime = 0;
      setTimeLeft(GAME_DURATION);
      state.gameOver = false;
      setGameOver(false);
      state.speedMult = 1;
      state.ripples.length = 0;
      state.ballTrail.length = 0;
      state.bullets.length = 0;
      state.bulletCooldownT = 0;
      state.bulletPending = false;
      state.aiStun = 0;
      state.lives = SURVIVAL_LIVES;
      setLives(SURVIVAL_LIVES);
      state.running = true;
      setRunning(true);
      resetBall(1);
    };

    const onStart = (e) => {
      if (e.touches && e.touches[0])
        setMouse(e.touches[0].clientX, e.touches[0].clientY);
      // Survival modunda oyun çalışırken tıklama → ateş tetiklemesi
      if (state.running && state.mode === MODE_SURVIVAL) {
        if (state.bulletCooldownT <= 0) state.bulletPending = true;
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("click", onStart);
    canvas.addEventListener("touchstart", onStart, { passive: true });

    const onExternalRestart = (e) => {
      const m = e && e.detail && e.detail.mode ? e.detail.mode : state.mode;
      beginRound(m);
    };
    window.addEventListener("pingpong-restart", onExternalRestart);

    function resetBall(dir) {
      state.ball.x = (Math.random() - 0.5) * 200;
      state.ball.y = (Math.random() - 0.5) * 200;
      state.ball.z = dir > 0 ? -HALF_D + 480 : HALF_D - 480;
      const baseSpeed = 10;
      state.ball.vx = (Math.random() - 0.5) * 4;
      state.ball.vy = (Math.random() - 0.5) * 3;
      state.ball.vz = dir * baseSpeed;
      state.ballTrail.length = 0;
      state.spawnT = SPAWN_DURATION;
    }

    function project(x, y, z) {
      const { cam, width, height, focal, shakeX, shakeY } = state;
      const cy = Math.cos(-cam.yaw);
      const sy = Math.sin(-cam.yaw);
      const x1 = x * cy - z * sy;
      const z1 = x * sy + z * cy;
      const cp = Math.cos(-cam.pitch);
      const sp = Math.sin(-cam.pitch);
      const y2 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      const camZ = z2 + CAM_DIST;
      if (camZ <= 5) return null;
      const f = focal / camZ;
      return {
        x: x1 * f + width / 2 + shakeX,
        y: -y2 * f + height / 2 + shakeY,
        s: f,
        z: camZ,
      };
    }

    function lineW(a, b, color, lw) {
      const pa = project(a[0], a[1], a[2]);
      const pb = project(b[0], b[1], b[2]);
      if (!pa || !pb) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    function drawBox() {
      const s = HALF_S;
      const z0 = -HALF_D;
      const z1 = HALF_D;
      const c = [
        [-s, -s, z0], [s, -s, z0], [s, s, z0], [-s, s, z0],
        [-s, -s, z1], [s, -s, z1], [s, s, z1], [-s, s, z1],
      ];
      const mids = [-HALF_D * 0.5, 0, HALF_D * 0.5];
      for (const z of mids) {
        const a = z === 0 ? 0.09 : 0.05;
        const ring = [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]];
        for (let i = 0; i < 4; i++) {
          lineW(ring[i], ring[(i + 1) % 4], `rgba(255,255,255,${a})`, 1);
        }
      }
      const back = [[4, 5], [5, 6], [6, 7], [7, 4]];
      for (const [a, b] of back) lineW(c[a], c[b], "rgba(255,255,255,0.18)", 1);
      const depth = [[0, 4], [1, 5], [2, 6], [3, 7]];
      for (const [a, b] of depth) lineW(c[a], c[b], "rgba(255,255,255,0.22)", 1);
      const front = [[0, 1], [1, 2], [2, 3], [3, 0]];
      for (const [a, b] of front)
        lineW(c[a], c[b], "rgba(255,255,255,0.5)", 1.2);
    }

    function drawPaddle(cx, cy, cz, rgb, fill, glow) {
      const corners = [
        [cx - HALF_PADDLE, cy - HALF_PADDLE, cz],
        [cx + HALF_PADDLE, cy - HALF_PADDLE, cz],
        [cx + HALF_PADDLE, cy + HALF_PADDLE, cz],
        [cx - HALF_PADDLE, cy + HALF_PADDLE, cz],
      ];
      const pp = corners.map((c) => project(c[0], c[1], c[2]));
      if (pp.some((p) => !p)) return;

      ctx.fillStyle = `rgba(${rgb}, ${fill})`;
      ctx.beginPath();
      ctx.moveTo(pp[0].x, pp[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pp[i].x, pp[i].y);
      ctx.closePath();
      ctx.fill();

      if (glow > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(${rgb}, ${0.55 * glow})`;
        ctx.shadowBlur = 24 * glow;
        ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pp[0].x, pp[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(pp[i].x, pp[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pp[0].x, pp[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(pp[i].x, pp[i].y);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(${rgb}, 0.18)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pp[0].x, pp[0].y);
      ctx.lineTo(pp[2].x, pp[2].y);
      ctx.moveTo(pp[1].x, pp[1].y);
      ctx.lineTo(pp[3].x, pp[3].y);
      ctx.stroke();
    }

    function drawTrackingRing(z) {
      const s = HALF_S;
      const corners = [
        [-s, -s, z],
        [s, -s, z],
        [s, s, z],
        [-s, s, z],
      ];
      const pp = corners.map((c) => project(c[0], c[1], c[2]));
      if (pp.some((p) => !p)) return;

      ctx.save();
      ctx.shadowColor = "rgba(255, 215, 100, 0.55)";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(255, 220, 110, 0.65)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pp[0].x, pp[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pp[i].x, pp[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function drawBallAt(wx, wy, wz, alpha, scale) {
      const p = project(wx, wy, wz);
      if (!p) return null;
      const r = BALL_R * p.s * scale;
      if (r < 0.5) return p;

      ctx.save();
      ctx.globalAlpha = alpha;

      const ox = p.x - r * 0.35;
      const oy = p.y - r * 0.4;
      const g = ctx.createRadialGradient(ox, oy, r * 0.08, p.x, p.y, r);
      g.addColorStop(0, "#fff8d8");
      g.addColorStop(0.25, "#ffe27a");
      g.addColorStop(0.6, "#d18a18");
      g.addColorStop(1, "#3a1c00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      return p;
    }

    function drawBullet(bu) {
      const p = project(bu.x, bu.y, bu.z);
      if (!p) return;
      const r = BULLET_RADIUS * p.s;
      if (r < 0.3) return;

      // Hafif iz (mermi vz büyük → motion blur etkisi)
      const tail = project(bu.x, bu.y, bu.z - bu.vz * 1.6);
      if (tail) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 240, 0.3)";
        ctx.lineWidth = Math.max(1, r * 0.6);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }

      // Parlak çekirdek
      ctx.save();
      ctx.shadowColor = "rgba(255, 255, 220, 0.8)";
      ctx.shadowBlur = 10;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, "rgba(255, 255, 255, 1)");
      g.addColorStop(0.5, "rgba(255, 245, 200, 0.9)");
      g.addColorStop(1, "rgba(255, 200, 80, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBall() {
      // Motion blur — eski → yeni sırasıyla, sönümlenerek
      const trails = state.ballTrail;
      const len = trails.length;
      for (let i = len - 1; i >= 0; i--) {
        const tr = trails[i];
        const age = (i + 1) / (len + 1); // 0 = en yeni, ~1 = en eski
        const alpha = (1 - age) * 0.32;
        const scale = 1 - age * 0.4;
        drawBallAt(tr.x, tr.y, tr.z, alpha, scale);
      }

      // Mevcut top — spawn anında küçükten büyüyerek belirir
      let alpha = 1;
      let scale = 1;
      if (state.spawnT > 0) {
        const progress = 1 - state.spawnT / SPAWN_DURATION; // 0 → 1
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        alpha = eased;
        scale = 0.25 + eased * 0.75;

        // Genişleyen sarı halo — spawn vurgusu
        const p = project(state.ball.x, state.ball.y, state.ball.z);
        if (p) {
          const haloR = BALL_R * p.s * (0.6 + progress * 2.0);
          const haloA = (1 - progress) * 0.55;
          ctx.save();
          ctx.strokeStyle = `rgba(255, 220, 110, ${haloA})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawBallAt(state.ball.x, state.ball.y, state.ball.z, alpha, scale);
    }

    function addShake(impactSpeed) {
      state.shakePower = Math.min(
        20,
        state.shakePower + impactSpeed * 0.55 + 0.5
      );
    }

    function addRipple(cx, cy, cz, axis, impactSpeed, rgb = "255, 240, 190") {
      state.ripples.push({
        cx,
        cy,
        cz,
        axis, // 'x', 'y' veya 'z' — ripple'ın yer aldığı yüzeyin normali
        t: 0,
        life: 650,
        maxR: 70 + impactSpeed * 7,
        rgb,
      });
    }

    function drawRipple(r) {
      const progress = r.t / r.life;
      if (progress >= 1) return;
      const ease = 1 - Math.pow(1 - progress, 2);
      const radius = ease * r.maxR;
      const baseAlpha = (1 - progress) * 0.55;
      if (radius < 0.5 || baseAlpha < 0.02) return;

      // Yüzey 2D koordinatları (a, b) ve kaynak konumu (sa, sb).
      // Yansımayı modellemek için yüzeyin dört kenarının arkasında "ayna
      // kaynak"lar oluşturulur — her biri aynı yarıçapla yayılan ek halka
      // gibi davranır. Halkaların yalnızca yüzey içinde kalan segmentleri
      // çizilir; bu doğal yansıma izlenimi verir.
      let aMin, aMax, bMin, bMax, sa, sb;
      if (r.axis === "x") {
        aMin = -HALF_S; aMax = HALF_S;
        bMin = -HALF_D; bMax = HALF_D;
        sa = r.cy; sb = r.cz;
      } else if (r.axis === "y") {
        aMin = -HALF_S; aMax = HALF_S;
        bMin = -HALF_D; bMax = HALF_D;
        sa = r.cx; sb = r.cz;
      } else {
        aMin = -HALF_S; aMax = HALF_S;
        bMin = -HALF_S; bMax = HALF_S;
        sa = r.cx; sb = r.cy;
      }

      const projectOnPlane = (a, b) => {
        if (r.axis === "x") return project(r.cx, a, b);
        if (r.axis === "y") return project(a, r.cy, b);
        return project(a, b, r.cz);
      };

      const drawAt = (srcA, srcB, rad, alpha) => {
        if (rad < 0.5 || alpha < 0.01) return;
        const N = 36;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= N; i++) {
          const theta = (i / N) * Math.PI * 2;
          const a = srcA + rad * Math.cos(theta);
          const b = srcB + rad * Math.sin(theta);
          if (a < aMin || a > aMax || b < bMin || b > bMax) {
            started = false;
            continue;
          }
          const p = projectOnPlane(a, b);
          if (!p) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = `rgba(${r.rgb}, ${alpha})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      };

      // 1 orijinal kaynak + 4 ayna kaynak (her kenar için bir tane).
      // Ayna kaynak alpha çarpanı 0.65 — yansımada hafif enerji kaybı.
      const sources = [
        [sa, sb, 1],
        [2 * aMax - sa, sb, 0.65],
        [2 * aMin - sa, sb, 0.65],
        [sa, 2 * bMax - sb, 0.65],
        [sa, 2 * bMin - sb, 0.65],
      ];

      for (const [srcA, srcB, mul] of sources) {
        drawAt(srcA, srcB, radius, baseAlpha * mul);
        drawAt(srcA, srcB, radius * 0.62, baseAlpha * mul * 0.42);
      }
    }

    let raf = 0;
    let last = performance.now();

    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(33, now - last);
      last = now;
      const t = dt / 16.67;

      const targetYaw = state.mouse.x * 0.1;
      const targetPitch = -state.mouse.y * 0.08;
      const ease = 1 - Math.pow(0.86, t);
      state.cam.yaw += (targetYaw - state.cam.yaw) * ease;
      state.cam.pitch += (targetPitch - state.cam.pitch) * ease;

      // Paddle pozisyonu: mouse cursor'ın canvas'taki pozisyonunu unproject ederek
      // paddle'ın 3D world konumuna çevir. Böylece cursor her zaman paddle'ın tam
      // ortasında durur. Yaw/pitch için küçük açı düzeltmesi uygulanır.
      const PZ_CAM = PLAYER_Z + CAM_DIST;
      const sX = state.mouse.x * (state.width / 2) - state.shakeX;
      const sY = state.mouse.y * (state.height / 2) - state.shakeY;
      const yawNow = state.cam.yaw;
      const pitchNow = state.cam.pitch;
      const playerXRaw =
        (sX * PZ_CAM) / state.focal + PZ_CAM * Math.sin(yawNow);
      const playerYRaw =
        (-sY * PZ_CAM) / state.focal - PZ_CAM * Math.sin(pitchNow);
      const paddleClamp = HALF_S - HALF_PADDLE;
      const playerX = Math.max(-paddleClamp, Math.min(paddleClamp, playerXRaw));
      const playerY = Math.max(-paddleClamp, Math.min(paddleClamp, playerYRaw));
      state.playerX = playerX;
      state.playerY = playerY;

      if (state.spawnT > 0) {
        state.spawnT = Math.max(0, state.spawnT - dt);
      }
      const isSpawning = state.spawnT > 0;

      // Bullet cooldown ve AI stun zaman sayaçları
      if (state.bulletCooldownT > 0)
        state.bulletCooldownT = Math.max(0, state.bulletCooldownT - dt);
      if (state.aiStun > 0)
        state.aiStun = Math.max(0, state.aiStun - dt);

      // Bekleyen ateş varsa, mevcut paddle pozisyonundan mermi spawn et
      if (
        state.bulletPending &&
        state.running &&
        state.mode === MODE_SURVIVAL &&
        !isSpawning
      ) {
        state.bulletPending = false;
        state.bullets.push({
          x: state.playerX,
          y: state.playerY,
          z: PLAYER_Z + BULLET_RADIUS + 4,
          vz: BULLET_SPEED,
        });
        state.bulletCooldownT = BULLET_COOLDOWN_MS;
        SFX.bullet();
      }

      // Sadece time mode'da süre saymakta
      if (state.running && state.mode === MODE_TIME) {
        state.gameTime += dt;
        const remaining = Math.max(0, GAME_DURATION - state.gameTime);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          state.running = false;
          state.gameOver = true;
          setRunning(false);
          setGameOver(true);
          SFX.gameOver();
        }
      } else if (state.running && state.mode === MODE_SURVIVAL) {
        // Survival'da da gameTime artıyor (skor için kullanmıyoruz, ama
        // shake/spawn timer animasyonları için tutarlılık)
        state.gameTime += dt;
      }

      if (state.running && !isSpawning) {
        const b = state.ball;

        // Motion blur trail — top hareket etmeden önce mevcut pozisyonu kaydet
        state.ballTrail.unshift({ x: b.x, y: b.y, z: b.z });
        if (state.ballTrail.length > TRAIL_MAX) state.ballTrail.pop();

        const step = t * state.speedMult;
        b.x += b.vx * step;
        b.y += b.vy * step;
        b.z += b.vz * step;

        const halfBound = HALF_S - BALL_R;
        if (b.x > halfBound) {
          b.x = halfBound;
          b.vx = -Math.abs(b.vx);
          addShake(Math.abs(b.vx));
          addRipple(HALF_S, b.y, b.z, "x", Math.abs(b.vx));
          SFX.wallHit(Math.abs(b.vx) / 22);
        } else if (b.x < -halfBound) {
          b.x = -halfBound;
          b.vx = Math.abs(b.vx);
          addShake(Math.abs(b.vx));
          addRipple(-HALF_S, b.y, b.z, "x", Math.abs(b.vx));
          SFX.wallHit(Math.abs(b.vx) / 22);
        }
        if (b.y > halfBound) {
          b.y = halfBound;
          b.vy = -Math.abs(b.vy);
          addShake(Math.abs(b.vy));
          addRipple(b.x, HALF_S, b.z, "y", Math.abs(b.vy));
          SFX.wallHit(Math.abs(b.vy) / 22);
        } else if (b.y < -halfBound) {
          b.y = -halfBound;
          b.vy = Math.abs(b.vy);
          addShake(Math.abs(b.vy));
          addRipple(b.x, -HALF_S, b.z, "y", Math.abs(b.vy));
          SFX.wallHit(Math.abs(b.vy) / 22);
        }

        // Stunluyken CPU paddle hareket etmez
        const aiEase = state.aiStun > 0 ? 0 : 1 - Math.pow(0.93, t);
        const aiTargetX = b.x + (Math.random() - 0.5) * 8;
        const aiTargetY = b.y + (Math.random() - 0.5) * 6;
        state.ai.x += (aiTargetX - state.ai.x) * aiEase;
        state.ai.y += (aiTargetY - state.ai.y) * aiEase;
        const aiClamp = HALF_S - HALF_PADDLE;
        state.ai.x = Math.max(-aiClamp, Math.min(aiClamp, state.ai.x));
        state.ai.y = Math.max(-aiClamp, Math.min(aiClamp, state.ai.y));

        if (b.vz < 0 && b.z <= PLAYER_Z + BALL_R) {
          if (
            Math.abs(b.x - playerX) <= HALF_PADDLE + BALL_R * 0.3 &&
            Math.abs(b.y - playerY) <= HALF_PADDLE + BALL_R * 0.3
          ) {
            b.z = PLAYER_Z + BALL_R + 0.5;
            b.vz = Math.abs(b.vz) * 1.04;
            b.vx += (b.x - playerX) * 0.05;
            b.vy += (b.y - playerY) * 0.045;
            state.hitFlash = 1;
            const cap = state.mode === MODE_SURVIVAL ? 2.4 : 1.9;
            const inc = state.mode === MODE_SURVIVAL ? 0.04 : 0.025;
            state.speedMult = Math.min(cap, state.speedMult + inc);
            addRipple(
              b.x,
              b.y,
              PLAYER_Z,
              "z",
              Math.abs(b.vz),
              COLOR_PLAYER
            );
            SFX.playerHit();
          } else if (b.z <= -HALF_D) {
            // Player kaçırdı
            if (state.mode === MODE_SURVIVAL) {
              state.lives = Math.max(0, state.lives - 1);
              setLives(state.lives);
              state.missFlash = 1;
              SFX.loseLife();
              if (state.lives <= 0) {
                state.running = false;
                state.gameOver = true;
                setRunning(false);
                setGameOver(true);
                SFX.gameOver();
              } else {
                resetBall(1);
              }
            } else {
              state.score.ai++;
              setScore({ ...state.score });
              state.missFlash = 1;
              SFX.scoreOther();
              resetBall(1);
            }
          }
        }

        if (b.vz > 0 && b.z >= AI_Z - BALL_R) {
          if (
            Math.abs(b.x - state.ai.x) <= HALF_PADDLE + BALL_R * 0.3 &&
            Math.abs(b.y - state.ai.y) <= HALF_PADDLE + BALL_R * 0.3
          ) {
            b.z = AI_Z - BALL_R - 0.5;
            b.vz = -Math.abs(b.vz) * 1.04;
            b.vx += (b.x - state.ai.x) * 0.04;
            b.vy += (b.y - state.ai.y) * 0.035;
            const cap = state.mode === MODE_SURVIVAL ? 2.4 : 1.9;
            const inc = state.mode === MODE_SURVIVAL ? 0.04 : 0.025;
            state.speedMult = Math.min(cap, state.speedMult + inc);
            state.aiHitFlash = 1;
            addRipple(b.x, b.y, AI_Z, "z", Math.abs(b.vz), COLOR_AI);
            SFX.aiHit();
          } else if (b.z >= HALF_D) {
            state.score.player++;
            setScore({ ...state.score });
            state.scoreFlash = 1;
            SFX.scoreSelf();
            resetBall(-1);
          }
        }

        const maxV = 22;
        b.vx = Math.max(-maxV, Math.min(maxV, b.vx));
        b.vy = Math.max(-maxV, Math.min(maxV, b.vy));
        b.vz = Math.max(-maxV, Math.min(maxV, b.vz));

        // Mermi güncellemesi (sadece survival)
        if (state.mode === MODE_SURVIVAL && state.bullets.length) {
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const bu = state.bullets[i];
            bu.z += bu.vz * t;

            // CPU paddle'ına çarpma kontrolü
            if (bu.z >= AI_Z - HALF_PADDLE * 0.2) {
              const dx = Math.abs(bu.x - state.ai.x);
              const dy = Math.abs(bu.y - state.ai.y);
              if (dx <= HALF_PADDLE && dy <= HALF_PADDLE) {
                state.score.player += BULLET_BONUS;
                setScore({ ...state.score });
                state.aiHitFlash = 1;
                state.aiStun = AI_STUN_MS;
                state.scoreFlash = 1;
                addRipple(
                  bu.x,
                  bu.y,
                  AI_Z,
                  "z",
                  Math.max(8, Math.abs(bu.vz) * 0.4),
                  COLOR_AI
                );
                SFX.bulletHit();
                state.bullets.splice(i, 1);
                continue;
              }
            }
            // Arka duvarı (CPU yüzeyi) geçtiyse mermi kaybolur
            if (bu.z >= HALF_D + 40) state.bullets.splice(i, 1);
          }
        }
      }

      state.shakeT += dt;
      const sp = state.shakePower;
      if (sp > 0.05) {
        const tt = state.shakeT;
        state.shakeX =
          (Math.sin(tt * 0.085) * 0.6 + Math.sin(tt * 0.21 + 1.4) * 0.4) * sp;
        state.shakeY =
          (Math.sin(tt * 0.092 + 0.7) * 0.55 +
            Math.sin(tt * 0.23 + 2.1) * 0.4) *
          sp;
      } else {
        state.shakeX *= 0.7;
        state.shakeY *= 0.7;
      }
      state.shakePower *= Math.pow(0.86, t);

      state.hitFlash *= Math.pow(0.92, t);
      state.aiHitFlash *= Math.pow(0.92, t);
      state.missFlash *= Math.pow(0.92, t);
      state.scoreFlash *= Math.pow(0.92, t);

      // Ripple yaşlandırma + ölüleri ele
      if (state.ripples.length) {
        for (const rp of state.ripples) rp.t += dt;
        state.ripples = state.ripples.filter((rp) => rp.t < rp.life);
      }

      render(playerX, playerY);
    }

    function render(playerX, playerY) {
      ctx.fillStyle = "#060608";
      ctx.fillRect(0, 0, state.width, state.height);

      const vg = ctx.createRadialGradient(
        state.width / 2,
        state.height / 2,
        Math.min(state.width, state.height) * 0.15,
        state.width / 2,
        state.height / 2,
        Math.max(state.width, state.height) * 0.7
      );
      vg.addColorStop(0, "rgba(40,40,60,0.18)");
      vg.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, state.width, state.height);

      drawBox();

      const items = [
        {
          z: AI_Z,
          draw: () =>
            drawPaddle(
              state.ai.x,
              state.ai.y,
              AI_Z,
              COLOR_AI,
              0.07 + state.aiHitFlash * 0.22,
              state.aiHitFlash
            ),
        },
        // Tracking ring — top ile aynı z'de, topa derinlik referansı veriyor.
        // Top'un az arkasına yerleştir ki sıralamada top önde kalsın.
        { z: state.ball.z + 0.5, draw: () => drawTrackingRing(state.ball.z) },
        { z: state.ball.z, draw: drawBall },
        {
          z: PLAYER_Z,
          draw: () =>
            drawPaddle(
              playerX,
              playerY,
              PLAYER_Z,
              COLOR_PLAYER,
              0.22 + state.hitFlash * 0.18,
              state.hitFlash
            ),
        },
      ];
      // Ripple'ları doğru z-sıralaması ile listeye kat
      for (const rp of state.ripples) {
        items.push({ z: rp.cz, draw: () => drawRipple(rp) });
      }
      // Mermiler — survival mod
      for (const bu of state.bullets) {
        items.push({ z: bu.z, draw: () => drawBullet(bu) });
      }
      items.sort((a, b) => b.z - a.z);
      for (const it of items) it.draw();

      // UI ölçeği — fullscreen'de yazılar büyür
      const uiScale = Math.max(1, Math.min(state.width, state.height) / 480);

      // === Skor + Timer HUD: 7-segment LED kapsülü ===
      {
        const sc = uiScale;
        const scoreH = 24 * sc;
        const scoreW = scoreH * 0.58;
        const timerH = 17 * sc;
        const timerW = timerH * 0.58;
        const digitGap = 2 * sc;
        const sectionGap = 11 * sc;
        const padX = 14 * sc;
        const padY = 9 * sc;
        const dividerH = 22 * sc;

        const isSurvival = state.mode === MODE_SURVIVAL;
        const playerDigits = isSurvival ? 4 : 2;
        const playerBlock =
          scoreW * playerDigits + digitGap * (playerDigits - 1);
        const aiBlock = scoreW * 2 + digitGap;
        const timerBlock = timerW * 2 + digitGap;
        // Survival: 3 dot kapsamı için sabit alan
        const dotR = Math.max(3.5, 4.5 * sc);
        const dotGap = Math.max(7, 9 * sc);
        const livesBlock =
          SURVIVAL_LIVES * (dotR * 2) + (SURVIVAL_LIVES - 1) * dotGap;

        const innerW = isSurvival
          ? playerBlock + sectionGap + 1 + sectionGap + livesBlock
          : playerBlock +
            sectionGap +
            1 +
            sectionGap +
            timerBlock +
            sectionGap +
            1 +
            sectionGap +
            aiBlock;

        const pillW = innerW + 2 * padX;
        const pillH = scoreH + 2 * padY;
        const pillX = state.width / 2 - pillW / 2;
        const pillY = 14 * sc;
        const cy = pillY + pillH / 2;

        drawHudPill(ctx, pillX, pillY, pillW, pillH);

        let cx = pillX + padX;

        // Player score (mavi) — survival'da 4 hane, time'da 2 hane
        const playerStr = String(
          Math.min(Math.pow(10, playerDigits) - 1, state.score.player)
        ).padStart(playerDigits, "0");
        for (let i = 0; i < playerDigits; i++) {
          drawSevenSegDigit(
            ctx,
            cx + scoreW / 2,
            cy,
            playerStr[i],
            scoreH,
            COLOR_PLAYER,
            0.45
          );
          cx += scoreW + digitGap;
        }

        cx += sectionGap - digitGap;
        drawHudDivider(ctx, cx, cy, dividerH);
        cx += 1 + sectionGap;

        if (!isSurvival) {
          // TIME — Timer (kalan saniye) + divider + CPU score
          const remainingMs = Math.max(0, GAME_DURATION - state.gameTime);
          const secs = Math.min(99, Math.ceil(remainingMs / 1000));
          const timerStr = String(secs).padStart(2, "0");
          let timerColor;
          let timerGlow;
          if (secs <= 5 && (state.running || state.gameOver)) {
            timerColor = "255, 100, 100";
            timerGlow =
              0.7 + 0.45 * Math.abs(Math.sin(state.gameTime * 0.012));
          } else if (secs <= 10) {
            timerColor = "255, 200, 80";
            timerGlow = 0.4;
          } else {
            timerColor = "235, 235, 240";
            timerGlow = 0.18;
          }
          for (let i = 0; i < 2; i++) {
            drawSevenSegDigit(
              ctx,
              cx + timerW / 2,
              cy,
              timerStr[i],
              timerH,
              timerColor,
              timerGlow
            );
            cx += timerW + digitGap;
          }

          cx += sectionGap - digitGap;
          drawHudDivider(ctx, cx, cy, dividerH);
          cx += 1 + sectionGap;

          // CPU score (kırmızı)
          const aiStr = String(Math.min(99, state.score.ai)).padStart(2, "0");
          for (let i = 0; i < 2; i++) {
            drawSevenSegDigit(
              ctx,
              cx + scoreW / 2,
              cy,
              aiStr[i],
              scoreH,
              COLOR_AI,
              0.45
            );
            cx += scoreW + digitGap;
          }
        } else {
          // SURVIVAL — 3 can noktası
          let dx = cx + dotR;
          for (let i = 0; i < SURVIVAL_LIVES; i++) {
            const isAlive = i < state.lives;
            ctx.save();
            if (isAlive) {
              ctx.shadowColor = `rgba(${COLOR_PLAYER}, 0.55)`;
              ctx.shadowBlur = 8;
            }
            ctx.fillStyle = isAlive
              ? `rgba(${COLOR_PLAYER}, 1)`
              : `rgba(${COLOR_PLAYER}, 0.18)`;
            ctx.beginPath();
            ctx.arc(dx, cy, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            dx += dotR * 2 + dotGap;
          }
        }
      }

      if (state.missFlash > 0.01) {
        ctx.fillStyle = `rgba(255, 80, 80, ${state.missFlash * 0.18})`;
        ctx.fillRect(0, 0, state.width, state.height);
      }
      if (state.scoreFlash > 0.01) {
        ctx.fillStyle = `rgba(${COLOR_PLAYER}, ${state.scoreFlash * 0.18})`;
        ctx.fillRect(0, 0, state.width, state.height);
      }

      // Oyun çalışmıyorsa (başlangıç ya da game over) — JSX paneli karartma
      // ile birlikte devralır; canvas'ta ek bir overlay çizmiyoruz.
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.removeEventListener("pingpong-restart", onExternalRestart);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("click", onStart);
      canvas.removeEventListener("touchstart", onStart);
    };
  }, []);

  const shareText = (() => {
    const p = score.player;
    const a = score.ai;
    if (mode === MODE_SURVIVAL) {
      return `3D Ping Pong ARENA modunda ${p} puan yaptım!`;
    }
    if (p > a) return `3D Ping Pong'da CPU'yu ${p}-${a} yendim!`;
    if (p < a) return `3D Ping Pong'da CPU ile ${p}-${a} maç yaptım.`;
    return `3D Ping Pong'da CPU ile ${p}-${a} berabere kaldık!`;
  })();

  const onShareX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "3D Ping Pong",
          text: shareText,
          url: SHARE_URL,
        });
      } catch {}
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${SHARE_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  // Primary buton:
  //  - Game over panelinde "TEKRAR OYNA" → başlangıç ekranına döner.
  //  - Başlangıç panelinde "BAŞLA" → yeni tur başlatır.
  const onPrimary = () => {
    if (gameOver) {
      setGameOver(false);
      if (stateRef.current) stateRef.current.gameOver = false;
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pingpong-restart", { detail: { mode } })
      );
    }
  };

  const verdict =
    mode === MODE_SURVIVAL
      ? { text: "DAYANDIN", rgb: COLOR_PLAYER }
      : score.player > score.ai
        ? { text: "KAZANDIN", rgb: COLOR_PLAYER }
        : score.player < score.ai
          ? { text: "CPU KAZANDI", rgb: COLOR_AI }
          : { text: "BERABERE", rgb: "200, 200, 210" };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const durationLabel = `${Math.round(GAME_DURATION / 1000)} SANIYE`;
  const showOverlay = !running || gameOver;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 bg-black overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="block absolute inset-0 w-full h-full select-none touch-none"
        style={{ cursor: running ? "crosshair" : "pointer" }}
        aria-label="3D Ping Pong"
      />

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Sesi aç" : "Sesi kapat"}
        title={muted ? "Sesi aç" : "Sesi kapat"}
        className="absolute bottom-4 right-4 z-20 inline-flex items-center justify-center w-9 h-9 rounded-full text-white/55 hover:text-white bg-white/[0.04] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 backdrop-blur-sm transition cursor-pointer"
      >
        {muted ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>

      {showOverlay && (
        <div
          key={gameOver ? "over" : "ready"}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-5"
        >
          <div
            className="relative w-full max-w-[460px] rounded-md border border-white/10 px-7 py-9 overflow-hidden"
            style={{ background: "rgba(6, 8, 14, 0.92)" }}
          >
            {/* Köşe brackets — HUD frame dilini panele uzat */}
            <span className="pointer-events-none absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-white/35" />
            <span className="pointer-events-none absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-white/35" />
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-white/35" />
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-white/35" />

            {/* CRT scanline texture — çok hafif */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)",
              }}
            />

            {/* Başlık — her iki durumda da aynı */}
            <div
              className="relative text-center"
              style={{
                animation: "pingpong-flicker-in 0.45s ease-out 0ms both",
              }}
            >
              <div className="font-mono text-[10px] tracking-[0.45em] text-white/55">
                3D PING PONG
              </div>
            </div>

            {/* Alt başlık — moda ve duruma göre değişir */}
            <div
              className="relative mt-1 text-center font-mono text-[10px] tracking-[0.32em] text-white/35"
              style={{
                animation: "pingpong-flicker-in 0.45s ease-out 80ms both",
              }}
            >
              {gameOver
                ? mode === MODE_SURVIVAL
                  ? "TÜM CANLAR BİTTİ"
                  : `ROUND COMPLETE · ${durationLabel}`
                : mode === MODE_SURVIVAL
                  ? `${SURVIVAL_LIVES} CAN · ATEŞ ET, DAYAN`
                  : `${durationLabel} · CPU'YU YEN`}
            </div>

            {/* Mod seçici — sadece başlangıç ekranında. Game over'da TEKRAR
                OYNA butonu kullanıcıyı başlangıç ekranına geri getiriyor; mod
                seçimi orada yapılıyor. */}
            {!gameOver && (
              <div
                className="relative mt-6 flex justify-center"
                style={{
                  animation: "pingpong-flicker-in 0.45s ease-out 140ms both",
                }}
              >
                <div className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
                  {[
                    { k: MODE_TIME, label: "SÜRE" },
                    { k: MODE_SURVIVAL, label: "ARENA" },
                  ].map((opt) => {
                    const active = mode === opt.k;
                    return (
                      <button
                        key={opt.k}
                        type="button"
                        onClick={() => switchMode(opt.k)}
                        className="px-3.5 py-1.5 rounded-[5px] font-mono text-[10px] tracking-[0.28em] uppercase transition cursor-pointer"
                        style={{
                          background: active
                            ? "rgba(255,255,255,0.12)"
                            : "transparent",
                          color: active
                            ? "rgba(255,255,255,0.95)"
                            : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skor blokları */}
            <div
              className="relative mt-7 flex items-end justify-center gap-5"
              style={{
                animation: "pingpong-flicker-in 0.5s ease-out 200ms both",
              }}
            >
              {mode === MODE_SURVIVAL ? (
                // Survival modunda tek büyük skor — 4 hane (yüksek puana yer)
                <ScoreBlock
                  value={gameOver ? score.player : null}
                  rgb={COLOR_PLAYER}
                  label="PUAN"
                  digits={4}
                />
              ) : (
                <>
                  <ScoreBlock
                    value={gameOver ? score.player : null}
                    rgb={COLOR_PLAYER}
                    label="SEN"
                  />
                  <div className="select-none pb-9 font-mono text-[34px] leading-none text-white/15">
                    ·
                  </div>
                  <ScoreBlock
                    value={gameOver ? score.ai : null}
                    rgb={COLOR_AI}
                    label="CPU"
                  />
                </>
              )}
            </div>

            {/* Verdict badge — sadece game over'da */}
            {gameOver && (
              <div
                className="relative mt-7 text-center"
                style={{
                  animation: "pingpong-flicker-in 0.45s ease-out 380ms both",
                }}
              >
                <div
                  className="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-[0.32em]"
                  style={{
                    color: `rgb(${verdict.rgb})`,
                    borderColor: `rgba(${verdict.rgb}, 0.4)`,
                    backgroundColor: `rgba(${verdict.rgb}, 0.08)`,
                    boxShadow: `0 0 32px rgba(${verdict.rgb}, 0.18)`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: `rgb(${verdict.rgb})` }}
                  />
                  {verdict.text}
                </div>
              </div>
            )}

            {/* Aksiyon butonları */}
            <div
              className="relative mt-8 space-y-2"
              style={{
                animation: "pingpong-flicker-in 0.45s ease-out 480ms both",
              }}
            >
              <button
                type="button"
                onClick={onPrimary}
                className="group flex w-full items-center justify-center gap-2 rounded-md bg-white px-5 py-3.5 font-mono text-[12px] tracking-[0.3em] uppercase text-black transition cursor-pointer hover:bg-white/95"
              >
                <span>{gameOver ? "TEKRAR OYNA" : "BAŞLA"}</span>
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                >
                  ›
                </span>
              </button>

              {gameOver && (
                <>
                  <button
                    type="button"
                    onClick={onShareX}
                    className="flex w-full items-center justify-center gap-2.5 rounded-md border border-white/15 bg-white/[0.06] px-5 py-3 font-mono text-[11px] tracking-[0.28em] uppercase text-white/85 transition cursor-pointer hover:border-white/30 hover:bg-white/[0.12] hover:text-white"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    X&apos;TE PAYLAŞ
                  </button>

                  <div
                    className={canNativeShare ? "grid grid-cols-2 gap-2" : ""}
                  >
                    {canNativeShare && (
                      <button
                        type="button"
                        onClick={onNativeShare}
                        className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-white/70 transition cursor-pointer hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        PAYLAŞ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onCopyLink}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-white/70 transition cursor-pointer hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {copied ? "✓ KOPYALANDI" : "LİNK"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
