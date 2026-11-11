// Sayfanin kullandigi EVDS serileri. Kodlar EVDS'nin seri listesinden
// (serieList: bie_kfe, bie_birimfiyat, bie_bk, bie_tukfiy2025, bie_kt100h,
// bie_mt100h, bie_enfbek) dogrulandi. Bolge ve il kodlari regions.js'te.

import { PROVINCES, REGIONS, TURKEY } from "./regions.js";

export const CPI = "TP.TUKFIY2025.GENEL"; // TUFE (2025=100), 2005'ten beri
export const MORTGAGE = "TP.KTF12"; // Konut kredisi faizi (TL, akim, yillik %)
export const DEPOSIT = "TP.TRY.MT02"; // 3 aya kadar vadeli TL mevduat faizi (akim, yillik %)
export const EXPECTATION = "TP.ENFBEK.PKA12ENF"; // Piyasa katilimcilarinin 12 ay sonrasi enflasyon beklentisi (%)

export const MONTHLY = [TURKEY.kfe, ...REGIONS.map((r) => r.kfe), CPI, MORTGAGE, DEPOSIT, EXPECTATION];

export const QUARTERLY = [TURKEY.price, TURKEY.rent, ...PROVINCES.flatMap((p) => [p.price, p.rent])];
