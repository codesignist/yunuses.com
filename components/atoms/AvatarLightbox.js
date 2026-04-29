"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const BIG_TARGET = 600;
const ENTER_DURATION = 380;
const EXIT_DURATION = 300;

export default function AvatarLightbox({ origin, onClose }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // İlk paint origin pozisyonunda olsun, ikinci RAF'ta açılış state'ine geç
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(true));
    });

    const handleKey = (e) => {
      if (e.key === "Escape") triggerClose();
    };
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerClose = () => {
    setClosing((c) => {
      if (c) return c;
      setTimeout(onClose, EXIT_DURATION);
      return true;
    });
  };

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const targetSize = Math.min(
    window.innerWidth * 0.8,
    window.innerHeight * 0.8,
    BIG_TARGET,
  );
  const startScale = origin.size / targetSize;
  const dx = origin.x - cx;
  const dy = origin.y - cy;

  const atOrigin = !open || closing;
  const transform = atOrigin
    ? `translate(${dx}px, ${dy}px) scale(${startScale})`
    : "translate(0, 0) scale(1)";
  const backdropOpacity = atOrigin ? 0 : 1;
  const transitionsOn = open;
  const duration = closing ? EXIT_DURATION : ENTER_DURATION;
  const easing = closing
    ? "cubic-bezier(0.5, 0, 0.75, 0)"
    : "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
      aria-label="Avatar büyük görünüm"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 10, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: backdropOpacity,
        transition: transitionsOn ? `opacity ${duration}ms ${easing}` : "none",
        cursor: "zoom-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: targetSize,
          height: targetSize,
          transform,
          transition: transitionsOn
            ? `transform ${duration}ms ${easing}`
            : "none",
          willChange: "transform",
          cursor: "default",
          borderRadius: "50%",
          background: "var(--color-line)",
          overflow: "hidden",
        }}
      >
        <Image
          src="/avatar.webp"
          width={BIG_TARGET}
          height={BIG_TARGET}
          alt="Yunus Eş"
          priority
          className="rounded-full object-cover"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    </div>
  );
}
