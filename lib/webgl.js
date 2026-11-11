import { useSyncExternalStore } from "react";

// WebGL2 destegi. three r163'ten beri yalniz WebGL2 ile calisiyor;
// donanim hizlandirmasi kapali ya da GPU kara listedeyse renderer hata
// firlatiyor. Deneyler bu hatayi efektte yakalayip state'e yaziyordu;
// simdi destek ilk cizimde biliniyor.
//
// Sunucuda var sayiliyor. Tarayicida bir kez gecici bir tuvalle yoklaniyor,
// baglam hemen birakiliyor. Yoklama gecip sahne yine de kurulamazsa
// (ornegin tarayicinin baglam siniri dolmussa) deney markWebGL2Unavailable
// cagiriyor ve uyari mesajina geciyor.

let available;
const listeners = new Set();

function probe() {
  if (available === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      available = Boolean(gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      available = false;
    }
  }
  return available;
}

function subscribe(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// Efektlerin icinden dogrudan: hydration sirasinda kanca henuz sunucu
// degerini (var) donduruyor, sahne bosuna kurulmaya calisilmasin.
export function hasWebGL2() {
  return probe();
}

export function useWebGL2() {
  return useSyncExternalStore(subscribe, probe, () => true);
}

export function markWebGL2Unavailable() {
  available = false;
  for (const l of listeners) l();
}
