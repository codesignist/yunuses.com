export const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// "2026-09" -> "Eylül 2026"
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const nf = (d) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);

export const num = (v, d = 1) => (d === 0 ? NF0 : d === 2 ? NF2 : d === 1 ? NF1 : nf(d)).format(v);

// Oran -> "%12,3". signed true ise "+%12,3". Isaretten sonraki U+2060
// (kelime birlestirici) satirin "-" ile "%1,3" arasindan bolunmesini onluyor.
export function pct(ratio, d = 1, signed = false) {
  const v = ratio * 100;
  const s = `%${num(Math.abs(v), d)}`;
  if (v < 0 && Math.abs(v) >= 0.5 * 10 ** -d) return `-⁠${s}`;
  return signed && v > 0 ? `+⁠${s}` : s;
}

// Buyuk TL tutarlari: 4.250.000 TL, 1,2 milyon TL gibi.
export function tl(v, compact = false) {
  if (compact) {
    const a = Math.abs(v);
    if (a >= 1e6) return `${num(v / 1e6, a >= 1e7 ? 1 : 2)} milyon TL`;
    if (a >= 1e3) return `${num(v / 1e3, 0)} bin TL`;
  }
  return `${NF0.format(Math.round(v))} TL`;
}
