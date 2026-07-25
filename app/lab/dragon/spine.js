import {
  N_SEGS,
  CHAIN_DIST,
  BODY_R,
  Z_AMP,
  MAX_BEND_COS,
  MAX_BEND_SIN,
  FOLLOW_HEAD,
  FOLLOW_TAIL,
  LIMB_ALIGN_RATE,
  LIMB_REF_MIN,
  radiusAt,
} from "./config";

/**
 * Omurga cozumu. Onceki surumde her segment her karede tam olarak CHAIN_DIST
 * mesafeye siniyordu: uzunluk dogru ama eklem acisi aninda yerine oturuyordu,
 * bu da slinky hissi veriyordu. Simdi mesafe hala tam korunuyor ama eklemin
 * donme hizi sinirli ve bu sinir kuyruga dogru azaliyor. Ortaya cikan gecikme
 * kamci hareketini uretiyor.
 */
export function createSpine() {
  const segs = [];
  for (let i = 0; i < N_SEGS; i++) {
    segs.push({
      x: -i * CHAIN_DIST,
      y: 0,
      z: 0,
      // teget / yukari / sag: paralel tasima ile tasinan tup cercevesi
      tx: 1, ty: 0, tz: 0,
      ux: 0, uy: 1, uz: 0,
      rx: 0, ry: 0, rz: 1,
      // dunya "yukari"sina gore turetilmis cerceve: uzuvlar bunu kullaniyor.
      // ltx/lty/ltz, bu cercevenin en son hangi tegete gore tasindigi.
      wux: 0, wuy: 1, wuz: 0,
      wrx: 0, wry: 0, wrz: 1,
      ltx: 1, lty: 0, ltz: 0,
      // ebeveynden bu segmente onceki karedeki yon
      dx: -1, dy: 0, dz: 0,
      // kumulatif yay uzunlugu, UV icin
      s: i * CHAIN_DIST,
    });
  }

  const headVel = { x: 0, y: 0 };
  const HEAD_OMEGA = 5.4;
  const HEAD_ZETA = 0.74;

  let totalLength = (N_SEGS - 1) * CHAIN_DIST;

  // Uc katmanli, birbirine bolunmeyen frekanslar. Tek sinus kullanildiginda
  // gezinme yolu gozle gorulur sekilde tekrar eden bir Lissajous cikiyordu.
  function drift(t, base, seed) {
    return (
      0.58 * Math.sin(t * base + seed) +
      0.29 * Math.sin(t * base * 1.6180339 + seed * 2.3 + 1.1) +
      0.13 * Math.sin(t * base * 2.7182818 + seed * 0.7 + 2.9)
    );
  }

  const _idle = { x: 0, y: 0 };
  function idleTarget(now) {
    const t = now * 0.001;
    _idle.x = 560 * drift(t, 0.29, 0.0);
    _idle.y = 300 * drift(t, 0.34, 1.7);
    return _idle;
  }

  function update(now, dt, frames, targetX, targetY) {
    const head = segs[0];

    // Bas yay ile takip ediyor: kucuk bir asma birakiyor, bu da hareketin
    // basini "canli" yapan sey.
    const axx = (targetX - head.x) * HEAD_OMEGA * HEAD_OMEGA - headVel.x * 2 * HEAD_ZETA * HEAD_OMEGA;
    const ayy = (targetY - head.y) * HEAD_OMEGA * HEAD_OMEGA - headVel.y * 2 * HEAD_ZETA * HEAD_OMEGA;
    headVel.x += axx * dt;
    headVel.y += ayy * dt;
    head.x += headVel.x * dt;
    head.y += headVel.y * dt;

    const tz = now * 0.00095;
    head.z =
      Z_AMP *
      (0.62 * Math.sin(tz) +
        0.27 * Math.sin(tz * 1.6180339 + 1.3) +
        0.11 * Math.sin(tz * 2.7182818 + 2.7));

    for (let i = 1; i < N_SEGS; i++) {
      const a = segs[i - 1];
      const b = segs[i];
      const tb = i / (N_SEGS - 1);
      const cd = CHAIN_DIST * Math.max(0.25, radiusAt(tb) / BODY_R);

      let dirX = b.x - a.x;
      let dirY = b.y - a.y;
      let dirZ = b.z - a.z;
      const dl = Math.hypot(dirX, dirY, dirZ) || 1;
      dirX /= dl; dirY /= dl; dirZ /= dl;

      let inX, inY, inZ;
      if (i === 1) {
        inX = a.tx; inY = a.ty; inZ = a.tz;
      } else {
        const aa = segs[i - 2];
        inX = a.x - aa.x;
        inY = a.y - aa.y;
        inZ = a.z - aa.z;
        const il = Math.hypot(inX, inY, inZ) || 1;
        inX /= il; inY /= il; inZ /= il;
      }

      const cosA = inX * dirX + inY * dirY + inZ * dirZ;
      if (cosA < MAX_BEND_COS) {
        let axX = inY * dirZ - inZ * dirY;
        let axY = inZ * dirX - inX * dirZ;
        let axZ = inX * dirY - inY * dirX;
        const axL = Math.hypot(axX, axY, axZ);
        if (axL > 1e-6) {
          axX /= axL; axY /= axL; axZ /= axL;
          const kxvX = axY * inZ - axZ * inY;
          const kxvY = axZ * inX - axX * inZ;
          const kxvZ = axX * inY - axY * inX;
          dirX = inX * MAX_BEND_COS + kxvX * MAX_BEND_SIN;
          dirY = inY * MAX_BEND_COS + kxvY * MAX_BEND_SIN;
          dirZ = inZ * MAX_BEND_COS + kxvZ * MAX_BEND_SIN;
        }
      }

      // Acisal sonumleme. Kuyruga dogru dusen takip katsayisi, eklemi hedef
      // yonune yavas cevirir; mesafe kisiti sonrasinda tam korundugu icin
      // govde uzamaz, sadece geriden gelir.
      const followBase = FOLLOW_HEAD + (FOLLOW_TAIL - FOLLOW_HEAD) * tb;
      const follow = 1 - Math.pow(1 - followBase, frames);
      let ndx = b.dx + (dirX - b.dx) * follow;
      let ndy = b.dy + (dirY - b.dy) * follow;
      let ndz = b.dz + (dirZ - b.dz) * follow;
      const nl = Math.hypot(ndx, ndy, ndz) || 1;
      ndx /= nl; ndy /= nl; ndz /= nl;
      b.dx = ndx; b.dy = ndy; b.dz = ndz;

      b.x = a.x + ndx * cd;
      b.y = a.y + ndy * cd;
      b.z = a.z + ndz * cd;
    }

    // Tegetler
    for (let i = 0; i < N_SEGS; i++) {
      const prev = segs[Math.max(0, i - 1)];
      const next = segs[Math.min(N_SEGS - 1, i + 1)];
      let tx_ = next.x - prev.x;
      let ty_ = next.y - prev.y;
      let tz_ = next.z - prev.z;
      const tl = Math.hypot(tx_, ty_, tz_) || 1;
      segs[i].tx = tx_ / tl;
      segs[i].ty = ty_ / tl;
      segs[i].tz = tz_ / tl;
    }

    // Paralel tasima ile burulmasiz cerceve (tup ve yele bunu kullaniyor)
    const t0 = segs[0];
    let pUx = t0.ux * 0.985;
    let pUy = t0.uy * 0.985 + 0.015;
    let pUz = t0.uz * 0.985;
    const dotU0 = pUx * t0.tx + pUy * t0.ty + pUz * t0.tz;
    pUx -= dotU0 * t0.tx;
    pUy -= dotU0 * t0.ty;
    pUz -= dotU0 * t0.tz;
    const l0 = Math.hypot(pUx, pUy, pUz) || 1;
    t0.ux = pUx / l0;
    t0.uy = pUy / l0;
    t0.uz = pUz / l0;

    for (let i = 1; i < N_SEGS; i++) {
      const a = segs[i - 1];
      const b = segs[i];
      const t1x = a.tx, t1y = a.ty, t1z = a.tz;
      const t2x = b.tx, t2y = b.ty, t2z = b.tz;
      const ax_ = t1y * t2z - t1z * t2y;
      const ay_ = t1z * t2x - t1x * t2z;
      const az_ = t1x * t2y - t1y * t2x;
      const al = Math.hypot(ax_, ay_, az_);
      let ux = a.ux, uy = a.uy, uz = a.uz;
      if (al > 1e-6) {
        const c = t1x * t2x + t1y * t2y + t1z * t2z;
        const angle = Math.atan2(al, c);
        const cs = Math.cos(angle);
        const sn = Math.sin(angle);
        const nax = ax_ / al, nay = ay_ / al, naz = az_ / al;
        const dotAU = nax * ux + nay * uy + naz * uz;
        const rxx = ux * cs + (nay * uz - naz * uy) * sn + nax * dotAU * (1 - cs);
        const ryy = uy * cs + (naz * ux - nax * uz) * sn + nay * dotAU * (1 - cs);
        const rzz = uz * cs + (nax * uy - nay * ux) * sn + naz * dotAU * (1 - cs);
        ux = rxx; uy = ryy; uz = rzz;
      }
      const dotU2 = ux * t2x + uy * t2y + uz * t2z;
      ux -= dotU2 * t2x;
      uy -= dotU2 * t2y;
      uz -= dotU2 * t2z;
      const ll = Math.hypot(ux, uy, uz) || 1;
      b.ux = ux / ll;
      b.uy = uy / ll;
      b.uz = uz / ll;
    }

    let acc = 0;
    for (let i = 0; i < N_SEGS; i++) {
      const s = segs[i];
      s.rx = s.ty * s.uz - s.tz * s.uy;
      s.ry = s.tz * s.ux - s.tx * s.uz;
      s.rz = s.tx * s.uy - s.ty * s.ux;

      // Uzuv cercevesi ("karin tarafi"). Paralel tasinan cercevenin asagi
      // diye bir bilgisi yok, ama her kare dogrudan cross(teget, dunyaYukari)
      // ile hesaplamak da olmuyor: teget dikeye yaklastiginda o referansin
      // azimutu aninda savruluyor ve uzuvlar tek karede ters doniyor.
      //
      // Cozum: cerceve kareler arasi tasiniyor (s.wux zaten onceki karenin
      // degeri), once mevcut tegete dik hale getiriliyor, sonra dunya
      // referansina HIZ SINIRLI olarak yaklastiriliyor. Referansin guvenilmez
      // oldugu araligi (dikeye yakin teget) tamamen atliyoruz.
      let lux = s.wux, luy = s.wuy, luz = s.wuz;

      // Onceki karenin tegetinden bugunkune minimum donusle tasi. Dogrudan
      // Gram-Schmidt projeksiyonu teget degisimiyle orantili sahte bir
      // yuvarlanma birakiyor; bu tasima onu sifirliyor.
      let axx = s.lty * s.tz - s.ltz * s.ty;
      let axy = s.ltz * s.tx - s.ltx * s.tz;
      let axz = s.ltx * s.ty - s.lty * s.tx;
      const axl = Math.hypot(axx, axy, axz);
      if (axl > 1e-9) {
        const cT = s.ltx * s.tx + s.lty * s.ty + s.ltz * s.tz;
        const angT = Math.atan2(axl, cT);
        const csT = Math.cos(angT);
        const snT = Math.sin(angT);
        const kx = axx / axl, ky = axy / axl, kz = axz / axl;
        const dotK = kx * lux + ky * luy + kz * luz;
        const nx = lux * csT + (ky * luz - kz * luy) * snT + kx * dotK * (1 - csT);
        const ny = luy * csT + (kz * lux - kx * luz) * snT + ky * dotK * (1 - csT);
        const nz = luz * csT + (kx * luy - ky * lux) * snT + kz * dotK * (1 - csT);
        lux = nx; luy = ny; luz = nz;
      }
      s.ltx = s.tx; s.lty = s.ty; s.ltz = s.tz;

      const dotT = lux * s.tx + luy * s.ty + luz * s.tz;
      lux -= dotT * s.tx;
      luy -= dotT * s.ty;
      luz -= dotT * s.tz;
      let ll = Math.hypot(lux, luy, luz);
      if (ll < 1e-4) {
        // tasinan cerceve tegetle cakisti: herhangi bir dik yon yeter
        lux = -s.tz; luy = 0; luz = s.tx;
        ll = Math.hypot(lux, luy, luz);
        if (ll < 1e-4) { lux = 1; luy = 0; luz = 0; ll = 1; }
      }
      lux /= ll; luy /= ll; luz /= ll;

      // dunya yukarisinin tegete dik bileseni
      const dux = -s.tx * s.ty;
      const duy = 1 - s.ty * s.ty;
      const duz = -s.tz * s.ty;
      const dl = Math.hypot(dux, duy, duz);
      if (dl > LIMB_REF_MIN) {
        const rx = dux / dl, ry = duy / dl, rz = duz / dl;
        const cosA = lux * rx + luy * ry + luz * rz;
        const sinA =
          (luy * rz - luz * ry) * s.tx +
          (luz * rx - lux * rz) * s.ty +
          (lux * ry - luy * rx) * s.tz;
        let ang = Math.atan2(sinA, cosA);
        const maxStep = LIMB_ALIGN_RATE * dt;
        if (ang > maxStep) ang = maxStep;
        else if (ang < -maxStep) ang = -maxStep;
        if (ang !== 0) {
          // teget ekseni etrafinda Rodrigues donusu
          const cs = Math.cos(ang);
          const sn = Math.sin(ang);
          const nx = lux * cs + (s.ty * luz - s.tz * luy) * sn;
          const ny = luy * cs + (s.tz * lux - s.tx * luz) * sn;
          const nz = luz * cs + (s.tx * luy - s.ty * lux) * sn;
          const nl = Math.hypot(nx, ny, nz) || 1;
          lux = nx / nl; luy = ny / nl; luz = nz / nl;
        }
      }

      s.wux = lux;
      s.wuy = luy;
      s.wuz = luz;
      s.wrx = s.ty * luz - s.tz * luy;
      s.wry = s.tz * lux - s.tx * luz;
      s.wrz = s.tx * luy - s.ty * lux;

      if (i > 0) {
        const p = segs[i - 1];
        acc += Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z);
      }
      s.s = acc;
    }
    totalLength = acc || 1;
  }

  return {
    segs,
    update,
    idleTarget,
    get totalLength() {
      return totalLength;
    },
  };
}
