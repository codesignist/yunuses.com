// Il bazinda m2 fiyati ve kirasindan turetilen olculer. Ceyreklik seriler,
// anahtar ceyregin son ayi ("2026-09").

export function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function unitStats({ price, rent }) {
  if (!price?.length || !rent?.length) return null;
  const byMonth = new Map(price);
  // Brut kira getirisi: m2 kirasi x 12 / m2 fiyati
  const yieldRows = rent.map(([k, r]) => (byMonth.get(k) ? [k, (r * 12) / byMonth.get(k)] : null)).filter(Boolean);
  if (!yieldRows.length) return null;
  const lastPrice = price[price.length - 1];
  const prev = byMonth.get(addMonths(lastPrice[0], -12));
  const values = yieldRows.map(([, v]) => v);
  return {
    unitPrice: lastPrice,
    unitPriceYoy: prev ? lastPrice[1] / prev - 1 : null,
    unitRent: rent[rent.length - 1],
    yield: yieldRows,
    yieldNow: values[values.length - 1],
    yieldAvg: values.reduce((s, v) => s + v, 0) / values.length,
    yieldFrom: yieldRows[0][0].slice(0, 4),
    yieldTo: yieldRows[yieldRows.length - 1][0].slice(0, 4),
  };
}
