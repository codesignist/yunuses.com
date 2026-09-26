import {
  N_SEGS,
  CHAIN_DIST,
  BODY_R,
  Z_AMP,
  SIM_HZ,
  TURN_RADIUS,
  HEAD_GAIN,
  HEAD_ACCEL,
  HEAD_MAX_SPEED,
  Z_PER_DIST,
  radiusAt,
} from "./config";

const STEP = 1 / SIM_HZ;
const CAP = 2048;
const SPACING = 2.5;
// Derinlik salinimi: birbirine bolunmeyen uc frekans.
function zWave(p) {
  return (
    0.62 * Math.sin(p) +
    0.27 * Math.sin(p * 1.6180339 + 1.3) +
    0.11 * Math.sin(p * 2.7182818 + 2.7)
  );
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Iz takibi. Kafa bir yol ciziyor, her segment o yolun uzerinde kafadan
 * sabit bir yay uzunlugu geride duruyor. Onceki surum zincirdi: her segment
 * bir oncekine dogru cekildigi icin kivrimlarda ic tarafa kestiriyordu
 * (traktris) ve bu, bukulme siniri ile acisal sonumlemeyle yamaniyordu.
 * Burada kesecek bir sey yok, govde kafanin gectigi her yerden geciyor.
 *
 * Kivrimin keskinligini sinirlayan tek sey kafanin donus yaricapi. Bu yuzden
 * kafa hedefe dogrudan yay ile gitmiyor: yonu en fazla hiz / TURN_RADIUS
 * hizinda donuyor, yani hedef arkada kalirsa geri vitese takmak yerine yay
 * cizerek donuyor.
 *
 * Sabit adimla calisiyor. Canli nokta son iki adim arasinda interpole
 * ediliyor; kayitlar sadece bir onceki adimdan aliniyor ki interpole edilen
 * kafa her zaman en yeni kaydin onunde kalsin.
 */
export function createTrailSolver(segs) {
  // Kafadan her segmente yay uzunlugu. Aralik kuyruga
  // dogru yaricapla birlikte kisaliyor.
  const offs = new Float32Array(N_SEGS);
  for (let i = 1; i < N_SEGS; i++) {
    const tb = i / (N_SEGS - 1);
    offs[i] = offs[i - 1] + CHAIN_DIST * Math.max(0.25, radiusAt(tb) / BODY_R);
  }

  const rx = new Float32Array(CAP);
  const ry = new Float32Array(CAP);
  const rz = new Float32Array(CAP);
  let newest = -1;
  let count = 0;

  function push(x, y, z) {
    newest = (newest + 1) % CAP;
    rx[newest] = x;
    ry[newest] = y;
    rz[newest] = z;
    if (count < CAP) count++;
  }

  const cur = { x: 0, y: 0, z: 0 };
  const prev = { x: 0, y: 0, z: 0 };
  let hx = 1, hy = 0;
  let speed = 0;
  let odo = 0;
  let acc = 0;

  function step(tx, ty) {
    if (
      count === 0 ||
      Math.hypot(cur.x - rx[newest], cur.y - ry[newest], cur.z - rz[newest]) >= SPACING
    ) {
      push(cur.x, cur.y, cur.z);
    }
    prev.x = cur.x;
    prev.y = cur.y;
    prev.z = cur.z;

    let dx = tx - cur.x;
    let dy = ty - cur.y;
    const dist = Math.hypot(dx, dy);
    let cosA = 1;
    let sinA = 0;
    if (dist > 1e-3) {
      dx /= dist;
      dy /= dist;
      cosA = hx * dx + hy * dy;
      sinA = hx * dy - hy * dx;
    }

    // Hedef yandaysa ya da arkadaysa yavasliyor: donus yayi ayni kalsa da
    // hizla savrulmak yerine basini cevirip bakiniyor gibi okunuyor.
    const align = 0.15 + 0.85 * smoothstep(-0.3, 1, cosA);
    const want = Math.min(HEAD_MAX_SPEED, dist * HEAD_GAIN * align);
    speed += (want - speed) * (1 - Math.exp(-HEAD_ACCEL * STEP));

    if (dist > 1e-3) {
      const maxTurn = (speed * STEP) / TURN_RADIUS;
      let ang = Math.atan2(sinA, cosA);
      if (ang > maxTurn) ang = maxTurn;
      else if (ang < -maxTurn) ang = -maxTurn;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const nhx = hx * c - hy * s;
      const nhy = hx * s + hy * c;
      const hl = Math.hypot(nhx, nhy) || 1;
      hx = nhx / hl;
      hy = nhy / hl;
    }

    cur.x += hx * speed * STEP;
    cur.y += hy * speed * STEP;
    odo += speed * STEP;
    cur.z = Z_AMP * zWave(odo * Z_PER_DIST);
  }

  function place(lx, ly, lz) {
    const h = segs[0];
    h.x = lx;
    h.y = ly;
    h.z = lz;

    let ax = lx, ay = ly, az = lz;
    let walked = 0;
    let k = 0;
    let idx = newest;
    // Kayitlar biterse son yonde duz devam ediliyor.
    let dirX = -hx, dirY = -hy, dirZ = 0;

    for (let i = 1; i < N_SEGS; i++) {
      const target = offs[i];
      const b = segs[i];
      for (;;) {
        if (k >= count) {
          const r = target - walked;
          b.x = ax + dirX * r;
          b.y = ay + dirY * r;
          b.z = az + dirZ * r;
          break;
        }
        const ex = rx[idx] - ax;
        const ey = ry[idx] - ay;
        const ez = rz[idx] - az;
        const len = Math.hypot(ex, ey, ez);
        if (walked + len >= target) {
          const f = len > 1e-6 ? (target - walked) / len : 0;
          b.x = ax + ex * f;
          b.y = ay + ey * f;
          b.z = az + ez * f;
          break;
        }
        if (len > 1e-6) {
          dirX = ex / len;
          dirY = ey / len;
          dirZ = ez / len;
        }
        walked += len;
        ax = rx[idx];
        ay = ry[idx];
        az = rz[idx];
        k++;
        idx = (idx - 1 + CAP) % CAP;
      }
    }
  }

  function update(dt, tx, ty) {
    acc += dt;
    while (acc >= STEP) {
      step(tx, ty);
      acc -= STEP;
    }
    const a = acc / STEP;
    place(
      prev.x + (cur.x - prev.x) * a,
      prev.y + (cur.y - prev.y) * a,
      prev.z + (cur.z - prev.z) * a,
    );
  }

  // Acilis izi kafanin arkasinda duz bir cizgi. Z, kafa bu yolu gercekten
  // gelmis gibi dalgadan hesaplaniyor: duz z=0 ile baslayinca dalgaya gecis
  // izde bir tumsek birakiyor ve kuyruk oradan gecene kadar kaliyordu.
  for (let d = offs[N_SEGS - 1] + CHAIN_DIST; d > 0; d -= SPACING * 4) {
    push(-d, 0, Z_AMP * zWave(-d * Z_PER_DIST));
  }
  cur.z = prev.z = Z_AMP * zWave(0);

  return { update };
}
