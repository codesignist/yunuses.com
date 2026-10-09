"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supported = fineHover.matches && !reducedMotion.matches;
    if (!supported) {
      setEnabled(false);
      return;
    }
    let stored = null;
    try {
      stored = localStorage.getItem("cursorTrail");
    } catch {}
    setEnabled(stored !== "off");

    const onChange = (e) => setEnabled(e.detail !== "off");
    window.addEventListener("cursortrailchange", onChange);
    return () => window.removeEventListener("cursortrailchange", onChange);
  }, []);

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
