"use client";

import dynamic from "next/dynamic";
import { Component } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery, useStoredValue } from "lib/browserStore";
import { FINE_POINTER, REDUCED_MOTION, TRAIL_KEY } from "./CursorTrailToggle";

const CursorTrail = dynamic(() => import("./CursorTrail"), { ssr: false });

// İz süs; chunk'ı yüklenemezse (deploy sonrası eski sekme, ağ hatası) hata
// kök layout'tan yukarı çıkıp bütün sayfayı hata ekranına düşürüyordu.
// Burada yutuluyor, sadece iz görünmüyor.
class TrailBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function CursorTrailLoader() {
  const pathname = usePathname();
  // Sunucuda ve hydration'da kapalı; hemen sonra cihaz ve tercih okunuyor.
  // Düğmeden açılıp kapandığında da buradan haberi oluyor.
  const fine = useMediaQuery(FINE_POINTER, false);
  const reduced = useMediaQuery(REDUCED_MOTION, true);
  const stored = useStoredValue(TRAIL_KEY);
  const enabled = fine && !reduced && stored !== undefined && stored !== "off";

  // Lab'in alt sayfalarında (oyun/deney ekranları) trail gizli — Lab index
  // sayfasında çalışır.
  if (pathname && /^\/lab\/[^/]/.test(pathname)) return null;
  if (!enabled) return null;
  return (
    <TrailBoundary>
      <CursorTrail />
    </TrailBoundary>
  );
}
