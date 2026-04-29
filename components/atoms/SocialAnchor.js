"use client";

export default function SocialAnchor({ children, className }) {
  const handleClick = () => {
    const el = document.getElementById("social");
    if (!el) return;
    el.classList.remove("flash");
    // Reflow tetikle ki sınıfı yeniden eklediğimizde animasyon yeniden başlasın
    void el.offsetWidth;
    el.classList.add("flash");
  };

  return (
    <a href="#social" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
