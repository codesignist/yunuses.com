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
      className="m-auto max-h-[min(80vh,720px)] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-0 text-fg shadow-[0_32px_80px_-32px_rgba(15,23,42,0.4)] backdrop:bg-[rgba(15,23,42,0.16)] backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4">
          <div>
            <h2 id="globe-ranking-title" className="text-[17px] font-medium tracking-[-0.015em]">
              Bütün şehirler, {year}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-muted">
              Nüfusu 300 binin üstündeki {formatCount(total)} şehir. BM şehri belediye sınırına göre
              değil, bitişik yoğun yerleşime göre sayıyor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-black/[0.05] hover:text-fg"
          >
            <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="border-b border-line px-5 py-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Şehir ya da ülke"
            aria-label="Tabloda ara"
            className="h-9 w-full rounded-full border border-line bg-white px-3.5 text-[14px] text-fg placeholder:text-faint outline-none focus-visible:border-black/30 focus-visible:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-white text-left text-[11px] text-faint">
              <tr>
                <th scope="col" className="w-14 px-5 py-2 text-right font-normal">Sıra</th>
                <th scope="col" className="px-2 py-2 font-normal">Şehir</th>
                <th scope="col" className="px-2 py-2 font-normal max-sm:hidden">Ülke</th>
                <th scope="col" className="px-5 py-2 text-right font-normal">Nüfus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i} className="border-t border-line-soft hover:bg-black/[0.025]">
                  <td className="px-5 py-1.5 text-right text-faint">{ranking.rank[i]}</td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onPick(i)}
                      className="text-left text-fg/85 underline-offset-2 hover:text-fg hover:underline"
                    >
                      {data.names[i]}
                    </button>
                    <span className="ml-1.5 text-[11px] text-faint sm:hidden">
                      {countryName(data.countries[i])}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-muted max-sm:hidden">{countryName(data.countries[i])}</td>
                  <td className="whitespace-nowrap px-5 py-1.5 text-right text-fg/75">{formatPop(ranking.vals[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-5 py-6 text-center text-[12px] text-muted">Eşleşen şehir yok.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
