"use client";

import { useEffect, useState } from "react";

function getFsElement() {
  if (typeof document === "undefined") return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

async function requestFs(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
}

async function exitFs() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
}

export default function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!getFsElement());
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  const toggle = async () => {
    try {
      if (getFsElement()) await exitFs();
      else await requestFs(document.documentElement);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFs ? "Tam ekrandan çık" : "Tam ekran"}
      title={isFs ? "Tam ekrandan çık" : "Tam ekran"}
      className="fixed top-5 right-5 z-40 w-9 h-9 rounded-full cursor-pointer flex items-center justify-center text-faint hover:text-fg hover:bg-line-soft transition-colors"
    >
      {isFs ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5.5 1.5V5.5H1.5" />
          <path d="M8.5 1.5V5.5H12.5" />
          <path d="M8.5 12.5V8.5H12.5" />
          <path d="M5.5 12.5V8.5H1.5" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 5V2H5" />
          <path d="M9 2H12V5" />
          <path d="M12 9V12H9" />
          <path d="M5 12H2V9" />
        </svg>
      )}
    </button>
  );
}
