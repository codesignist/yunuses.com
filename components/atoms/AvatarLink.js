"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";

const AvatarLightbox = dynamic(() => import("./AvatarLightbox"), {
  ssr: false,
});

export default function AvatarLink() {
  const linkRef = useRef(null);
  const preloadedRef = useRef(false);
  const [origin, setOrigin] = useState(null);

  const handleClick = (e) => {
    e.preventDefault();
    if (!linkRef.current) return;
    const rect = linkRef.current.getBoundingClientRect();
    setOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: rect.width,
    });
  };

  const handleClose = () => {
    setOrigin(null);
    linkRef.current?.focus({ preventScroll: true });
  };

  const preload = () => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;
    import("./AvatarLightbox");
  };

  return (
    <>
      <a
        ref={linkRef}
        href="#"
        onClick={handleClick}
        onMouseEnter={preload}
        onFocus={preload}
        onTouchStart={preload}
        aria-label="Yunus Eş avatarını büyüt"
        aria-expanded={origin !== null}
        className="rounded-full shrink-0 inline-block animate-fade-in-up"
      >
        <Image
          src="/avatar.webp"
          width={88}
          height={88}
          alt="Yunus Eş"
          priority
          className="rounded-full object-cover block"
          style={{ width: "auto", height: "auto" }}
        />
      </a>
      {origin && (
        <AvatarLightbox origin={origin} onClose={handleClose} />
      )}
    </>
  );
}
