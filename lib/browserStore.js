import { useCallback, useSyncExternalStore } from "react";

// Tarayicida yasayan degerler (localStorage tercihleri, medya sorgulari)
// icin React'in harici depo kancasi. Once bu degerler efekt icinde okunup
// state'e kopyalaniyordu; ilk cizimden hemen sonra ikinci bir cizim
// tetikliyordu ve lint her birinde uyariyordu. FullscreenToggle'daki
// useSyncExternalStore deseninin genellestirilmis hali.
//
// Sunucuda ve hydration'da deger bilinmiyor: useStoredValue undefined,
// useMediaQuery verilen sunucu degerini donduruyor. Hydration'dan hemen
// sonra React gercek degerle yeniden ciziyor; cizim oncekiyle ayni anda.

const memory = new Map();
const EVENT = "browserstorechange";

// Cerezler tamamen engelliyken localStorage'a bakmak bile hata atiyor.
// Yazilan deger bellekte de tutuluyor; depolama calismasa da secim bu sekme
// acik kaldikca gecerli.
export function readStored(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  memory.set(key, value);
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

export function useStoredValue(key) {
  const subscribe = useCallback(
    (onChange) => {
      const handler = (e) => {
        if (e.detail === key) onChange();
      };
      window.addEventListener(EVENT, handler);
      return () => window.removeEventListener(EVENT, handler);
    },
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => undefined,
  );
}

export function useMediaQuery(query, serverValue = false) {
  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
