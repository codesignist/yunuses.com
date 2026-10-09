"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function storedTheme() {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
}

export default function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState(null);
  // Depolama engelliyse seçim kaydedilemiyor; bu oturumda elle seçildiyse
  // sistem teması değişince yine de ezilmesin.
  const chosen = useRef(false);

  // Hook erken return'den önce, lab sayfalarında da çalışıyor.
  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY);
    const root = document.documentElement;
    // Bir hydration hatası kökü yeniden çizerse <html>'deki data-theme
    // siliniyor ve açık tema koyuya düşüyor; burada geri konuyor.
    if (!root.getAttribute("data-theme")) {
      applyTheme(storedTheme() || (media.matches ? "light" : "dark"));
    }
    setTheme(root.getAttribute("data-theme"));

    // Tema hiç seçilmemişse sekme açıkken sistem temasını takip et.
    const onSystemChange = (e) => {
      if (chosen.current || storedTheme()) return;
      const next = e.matches ? "light" : "dark";
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  // Lab'in alt sayfalarında (oyun/deney ekranları) tema toggle gizli — Lab
  // index sayfasında kalır. /lab/ trailing slash hala anasayfadır.
  if (pathname && /^\/lab\/[^/]/.test(pathname)) return null;

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    chosen.current = true;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    applyTheme(next);
    setTheme(next);
  };

  if (theme === null) {
    return (
      <button
        type="button"
        aria-label="Tema değiştir"
        data-chrome
        className="w-9 h-9 shrink-0 rounded-full cursor-pointer"
      />
    );
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Koyu temaya geç" : "Açık temaya geç"}
      title={isLight ? "Koyu temaya geç" : "Açık temaya geç"}
      data-chrome
      className="w-9 h-9 shrink-0 rounded-full cursor-pointer flex items-center justify-center text-faint hover:text-fg hover:bg-line-soft transition-colors"
    >
      {isLight ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
