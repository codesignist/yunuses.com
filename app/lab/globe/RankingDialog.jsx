"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RANK_FLOOR, countryName, formatCount, formatPop, plain } from "./data";

// Secili yilda nufusu 300 binin ustundeki butun sehirler. Kurenin tablo
// karsiligi: ekran okuyucuyla da, dar ekranda da siralamaya buradan
// ulasiliyor. Esigin altindakiler sirasiz kalacagi icin listede yok.
export default function RankingDialog({ open, data, ranking, year, onClose, onPick }) {
  const ref = useRef(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const rows = useMemo(() => {
    if (!open) return [];
    const q = plain(filter.trim());
    const out = [];
    for (const i of ranking.order) {
      const v = ranking.vals[i];
      if (v < RANK_FLOOR) break;
      if (q && !plain(data.names[i]).includes(q) && !plain(countryName(data.countries[i])).includes(q)) continue;
      out.push(i);
    }
    return out;
  }, [open, filter, ranking, data]);

  const total = useMemo(() => {
    let k = 0;
    for (const i of ranking.order) {
      if (ranking.vals[i] < RANK_FLOOR) break;
      k++;
    }
    return k;
  }, [ranking]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Kenar boslugundaki tiklama (dialog'un kendisi) kapatsin.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="globe-ranking-title"
      className="m-auto max-h-[min(80vh,720px)] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-lg border border-white/10 bg-[#07090d] p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
          <div>
            <h2 id="globe-ranking-title" className="text-[16px] font-medium tracking-tight">
              Bütün şehirler, {year}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-white/55">
              Nüfusu 300 binin üstündeki {formatCount(total)} şehir. BM şehri belediye sınırına göre
              değil, bitişik yoğun yerleşime göre sayıyor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid size-8 shrink-0 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="border-b border-white/10 px-4 py-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Şehir ya da ülke"
            aria-label="Tabloda ara"
            className="h-9 w-full rounded border border-white/10 bg-white/5 px-3 text-[14px] text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 focus-visible:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-[#07090d] text-left text-[11px] text-white/45">
              <tr>
                <th scope="col" className="w-14 px-4 py-2 text-right font-normal">Sıra</th>
                <th scope="col" className="px-2 py-2 font-normal">Şehir</th>
                <th scope="col" className="px-2 py-2 font-normal max-sm:hidden">Ülke</th>
                <th scope="col" className="px-4 py-2 text-right font-normal">Nüfus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-1.5 text-right text-white/40">{ranking.rank[i]}</td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onPick(i)}
                      className="text-left text-white/85 underline-offset-2 hover:text-white hover:underline"
                    >
                      {data.names[i]}
                    </button>
                    <span className="ml-1.5 text-[11px] text-white/40 sm:hidden">
                      {countryName(data.countries[i])}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-white/55 max-sm:hidden">{countryName(data.countries[i])}</td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right text-white/75">{formatPop(ranking.vals[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-white/55">Eşleşen şehir yok.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
