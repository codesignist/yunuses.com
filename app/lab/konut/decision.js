// "Simdi al" ile "h ay bekle, sonra al" arasindaki farki hesaplar.
//
// Iki kisi ayni parayla basliyor. Biri bugun aliyor; digeri parayi mevduatta
// tutup kira oduyor ve h ay sonra ayni evi o gunun fiyatiyla aliyor. Ikisi de
// h ayin sonunda evin sahibi oldugunda servetleri karsilastiriliyor:
//
//   fark(h) = birikim_h + kalanBorc_h - (1 + masraf) * fiyat_h
//
// birikim_h: bekleyenin h ay sonundaki mevduati. Bugun alicinin harcadigi
//   pesinat ve masraf mevduata giriyor; her ay alicinin odedigi kredi taksiti
//   kadar para ayriliyor, kira bundan odeniyor, artan (ya da eksilen) kisim
//   mevduatta kaliyor.
// kalanBorc_h: alicinin h ay sonundaki kredi borcu. Bekleyen de ayni borcla
//   aliyor sayiliyor; boylece fark kredinin kendisinden degil zamanlamadan
//   geliyor.
//
// Fark sifirdan buyukse beklemek kazandirmis. Fark fiyata dogrusal bagli,
// bu yuzden "beklemek fiyat su orandan az artarsa kazandirir" esigi tek
// bolmeyle cikiyor ve tahmin dagilimindan olasiligi okunuyor.

export function monthlyPayment(principal, r, n) {
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

export function remainingBalance(principal, r, n, h) {
  if (principal <= 0) return 0;
  if (h >= n) return 0;
  const M = monthlyPayment(principal, r, n);
  if (r === 0) return principal - M * h;
  const g = (1 + r) ** h;
  return principal * g - (M * (g - 1)) / r;
}

// Dagilimin yuzdeliklerinden (q artan) x esigine kadar olan olasilik.
export function cdf(quantiles, x) {
  if (!quantiles.length) return NaN;
  const first = quantiles[0];
  const last = quantiles[quantiles.length - 1];
  if (x <= first.v) return first.q * Math.max(0, x / first.v) ** 40; // kuyrukta hizla sifira
  if (x >= last.v) return 1 - (1 - last.q) * Math.max(0, last.v / x) ** 40;
  for (let i = 1; i < quantiles.length; i++) {
    const a = quantiles[i - 1];
    const b = quantiles[i];
    if (x <= b.v) return a.q + ((b.q - a.q) * (x - a.v)) / (b.v - a.v || 1);
  }
  return 1;
}

/**
 * @param {object} p
 * @param {number} p.price          bugunku ev fiyati (TL)
 * @param {number} p.rent           aylik kira (TL)
 * @param {number} p.rentRenewIn    kira artisina kalan ay (1..12)
 * @param {number} p.rentGrowth     yillik kira artisi (oran)
 * @param {number} p.loan           kredi tutari (TL, pesinse 0)
 * @param {number} p.loanRate       aylik kredi faizi (oran)
 * @param {number} p.loanTerm       vade (ay)
 * @param {number[]} p.depositPath  her ay icin aylik net mevduat getirisi (oran), h=1 ilk eleman
 * @param {number} p.costs          alim masrafi (fiyatin orani)
 * @param {Array<{h:number, q:Array<{q:number,v:number}>, median:number, cpi:number}>} p.forecast
 *        her ay icin fiyat_h / fiyat_0 dagilimi ve beklenen TUFE orani
 */
export function compare(p) {
  const loan = Math.min(Math.max(0, p.loan || 0), p.price);
  const M = monthlyPayment(loan, p.loanRate, p.loanTerm);
  let balance = p.price - loan + p.costs * p.price;
  const rows = [];

  for (const f of p.forecast) {
    const h = f.h;
    // Kira, artis ayinda ve sonra her 12 ayda bir yukseliyor.
    const raises = h >= p.rentRenewIn ? Math.floor((h - p.rentRenewIn) / 12) + 1 : 0;
    const rent = p.rent * (1 + p.rentGrowth) ** raises;
    const d = p.depositPath[Math.min(h - 1, p.depositPath.length - 1)];
    balance = balance * (1 + d) + (M - rent);

    const debt = remainingBalance(loan, p.loanRate, p.loanTerm, h);
    const K = balance + debt;
    const breakEven = K / ((1 + p.costs) * p.price); // fiyat_h / fiyat_0 esigi
    const pWait = cdf(f.q, breakEven);
    const diffAt = (ratio) => K - (1 + p.costs) * p.price * ratio;
    const diffMedian = diffAt(f.median);
    const qv = (q) => f.q.find((x) => Math.abs(x.q - q) < 1e-9)?.v ?? f.median;
    rows.push({
      h,
      breakEven,
      pWait,
      diffMedian,
      // Bugunun parasiyla: farkli aylari karsilastirabilmek icin TUFE'den arindirilmis.
      diffReal: diffMedian / f.cpi,
      // Fiyat dagiliminin ust ucu beklemenin kotu senaryosu.
      diffLowReal: diffAt(qv(0.9)) / f.cpi,
      diffHighReal: diffAt(qv(0.1)) / f.cpi,
      priceMedian: p.price * f.median,
      rent,
      payment: M,
    });
  }

  // En iyi bekleme suresi: bugunun parasiyla beklenen farkin en buyuk oldugu ay.
  let best = { h: 0, diffReal: 0 };
  for (const r of rows) if (r.diffReal > best.diffReal) best = r;
  return { rows, best, payment: M, loan };
}
