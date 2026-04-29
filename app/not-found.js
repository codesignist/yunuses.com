import Link from "next/link";

export const metadata = {
  title: "404 — Sayfa bulunamadı",
};

export default function NotFound() {
  return (
    <main id="main" className="min-h-screen flex items-center justify-center px-6 py-16 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[480px] text-center">
        <div className="text-[12px] text-faint uppercase tracking-[0.08em] mb-4 animate-fade-in-up">
          Sayfa bulunamadı
        </div>

        <h1
          className="text-[96px] font-medium tracking-tight leading-none text-fg animate-fade-in-up max-md:text-[72px]"
          style={{ animationDelay: "100ms" }}
        >
          404
        </h1>

        <p
          className="mt-8 text-[15px] leading-[1.7] text-muted animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          Aradığın sayfa burada değil. Belki silindi, belki yanlış yere geldin,
          ya da URL&apos;de ufak bir yazım hatası var.
        </p>

        <div
          className="mt-10 flex items-center justify-center gap-3 text-[14px] animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href="/"
            className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
          >
            ← Anasayfa
          </Link>
          <span className="text-line">·</span>
          <Link
            href="/blog"
            className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
          >
            Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
