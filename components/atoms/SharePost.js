"use client";

import { useState } from "react";

export default function SharePost({ title }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
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
    <button
      type="button"
      onClick={handleShare}
      aria-label="Yazıyı paylaş"
      className="inline-flex items-center gap-2 text-[13px] text-faint hover:text-fg cursor-pointer transition-colors"
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
  );
}
