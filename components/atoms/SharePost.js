"use client";

import { useState } from "react";

export default function SharePost({ title }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // O anki adres değil kanonik adres: ?utm_source, #main, www gibi ekler
    // paylaşılan linke taşınmasın. Next istemci geçişinde canonical'ı
    // güncelliyor.
    const url =
      document.querySelector('link[rel="canonical"]')?.href ||
      window.location.origin + window.location.pathname;
    const shareTitle =
      title ||
      (typeof document !== "undefined" ? document.title : "");

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
        // Diğer hatalarda clipboard fallback'ine düş
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className="link-quiet inline-flex items-center gap-2 text-meta cursor-pointer"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {copied ? "Kopyalandı" : "Paylaş"}
      </button>
      {/* Kopyalandığını ekran okuyucuya duyurur. Canlı bölge baştan sayfada
          olmalı, sonradan eklenirse okunmayabiliyor. */}
      <span role="status" className="sr-only">
        {copied ? "Bağlantı kopyalandı" : ""}
      </span>
    </>
  );
}
