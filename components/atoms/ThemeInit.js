"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

// Depolama okuması ayrı try'da: çerezler tamamen engelliyken localStorage hata
// atıyor, o zaman da sistemin tema tercihine bakılsın.
const SCRIPT = `(function(){var s=null;try{s=localStorage.getItem("theme")}catch(e){}var t=s||(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);})();`;

export default function ThemeInit() {
  // useServerInsertedHTML her akış parçasında yeniden çağrılıyor; koruma
  // olmadan script sayfaya dört kez, sonuncusu </html>'den sonra basılıyordu.
  // Modül düzeyi değişken olmaz, istekler arasında paylaşılır.
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
  });
  return null;
}
