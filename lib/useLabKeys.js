import { useEffect, useState } from "react";

/**
 * Immersive deneylerin ortak klavyesi: 1..N secenekleri secer, H tum arayuz
 * kromunu gizler. Onceden sadece Dragon'da vardi; diger deneylerde H hicbir
 * sey yapmiyordu.
 *
 * Durum <html> uzerinde ilan ediliyor cunku gizlenecek elemanlarin bir
 * kismi (tema, imlec izi, tam ekran) kok layout'ta, deneyin disinda.
 * Temizlik sart: sayfadan cikilirken krom gizli kalirsa site genelinde
 * gizli kalirdi.
 *
 * ids modul seviyesinde sabit bir dizi olmali, yoksa dinleyici her
 * render'da yeniden kurulur. Canvas'a kendisi cizilen krom icin (etiket,
 * eksen gostergesi) gizlilik durumu donduruluyor.
 */
export default function useLabKeys(ids, onSelect) {
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) {
        return;
      }
      if (e.key === "h" || e.key === "H") {
        setChromeHidden((v) => !v);
        return;
      }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < ids.length) onSelect(ids[idx]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, onSelect]);

  useEffect(() => {
    const root = document.documentElement;
    if (chromeHidden) root.setAttribute("data-chrome-hidden", "");
    else root.removeAttribute("data-chrome-hidden");
    return () => root.removeAttribute("data-chrome-hidden");
  }, [chromeHidden]);

  return chromeHidden;
}
