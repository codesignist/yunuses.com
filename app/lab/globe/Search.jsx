"use client";
import { forwardRef, useId, useMemo, useState } from "react";
import { countryName, formatPop, popAt, searchCities } from "./data";
import { GLASS, KBD } from "./ui";

// "Sehrini bul" kutusu. Erisilebilir combobox: oklarla secenek degisiyor,
// Enter seciyor, Escape kapatiyor. Karsilastirma modunda ayni kutu ikinci
// sehri soruyor.
const Search = forwardRef(function Search({ data, year, comparing, onPick, onCancelCompare }, ref) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchCities(data, query, year), [data, query, year]);

  function pick(i) {
    onPick(i);
    setQuery("");
    setOpen(false);
    setActive(0);
    ref?.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (results.length) {
        e.preventDefault();
        pick(results[Math.min(active, results.length - 1)]);
      }
    } else if (e.key === "Escape") {
      // Sayfanin Escape'i secimi kaldiriyor; burada yalniz kutuyu kapat.
      e.stopPropagation();
      if (query) setQuery("");
      else if (comparing) onCancelCompare();
      else e.currentTarget.blur();
      setOpen(false);
    }
  }

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative">
      <div className={`${GLASS} flex h-10 items-center gap-2 px-3 focus-within:border-white/50`}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-white/50">
          <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results.length ? `${id}-opt-${active}` : undefined}
          aria-label={comparing ? "Karşılaştırılacak şehri ara" : "Şehir ara"}
          placeholder={comparing ? "Karşılaştırılacak şehir" : "Şehrini bul"}
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/45 outline-none focus-visible:outline-none"
        />
        {comparing ? (
          <button
            type="button"
            onClick={onCancelCompare}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Vazgeç
          </button>
        ) : (
          !query && <kbd className={`${KBD} pointer-coarse:hidden`}>/</kbd>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Arama sonuçları"
          className={`${GLASS} absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden bg-black/75 py-1`}
        >
          {results.map((i, k) => {
            const pop = popAt(data, i, year);
            return (
              <li
                key={i}
                id={`${id}-opt-${k}`}
                role="option"
                aria-selected={k === active}
                // Tiklama input'un blur'undan once gelsin.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onPointerEnter={() => setActive(k)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-2 ${
                  k === active ? "bg-white/10 text-white" : "text-white/80"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {data.names[i]}
                  <span className="ml-1.5 text-[11px] text-white/45">{countryName(data.countries[i])}</span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/60">
                  {pop > 0 ? formatPop(pop) : "veri yok"}
                </span>
              </li>
            );
          })}
          {results.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-[12px] leading-snug text-white/60">
              Bulunamadı. Veride yalnız nüfusu bir yıl 300 bini geçmiş şehirler var.
            </li>
          )}
        </ul>
      )}
    </div>
  );
});

export default Search;
