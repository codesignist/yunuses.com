// Globe arayuzunun ortak parcalari. Sahne beyaz zeminde mat beyaz bir kure;
// arayuz siyah ve gri, renk yalniz veride (kobalt, karsilastirmada kirmizi).
//
// Iki katman var. Sahneyle ayni duzlemde duran bolumler (zaman, liste) beyaz
// bir tul: beyaz zeminde gorunmuyor, altina harita girince yaziyi koruyor.
// Uzerine acilanlar (sehir paneli, kart, arama sonuclari) ince bir kenar ve
// yumusak bir golgeyle ayriliyor.
// Kose yaricapi kullanan yerde: panel 2xl, kart xl, arama kutusu tam yuvarlak.
export const VEIL = "bg-white/80 backdrop-blur-md";
export const RAISED =
  "border border-black/[0.06] bg-white/95 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.16)]";

// Sehirlerin rengi: porselen uzerindeki kobalt. Grafik serileri beyaz
// zeminde dogrulandi (dataviz validate_palette, --mode light --surface
// #ffffff): parlaklik bandi, renk koru ayrimi (deltaE 24.3) ve kontrast
// geciyor. Birincil secili sehir, ikincil karsilastirilan.
export const COBALT = "#2443b5";
export const RED = "#d3402f";
export const SERIES = [COBALT, RED];

export const KBD =
  "rounded border border-line bg-surface px-1 py-0.5 text-[10px] leading-none text-faint";
