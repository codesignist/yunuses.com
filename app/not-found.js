import Link from "next/link";

const title = "Sayfa bulunamadı";
const description = "Aradığın sayfa burada değil.";

// openGraph ve twitter kendi nesneleriyle veriliyor ki ana sayfanin adresi,
// aciklamasi ve gorseli kirik bir baglantinin onizlemesine tasinmasin. Bos
// images, kok dizindeki opengraph-image.js'in buraya eklenmesini de kapatiyor.
export const metadata = {
  title,
  description,
  openGraph: { title, description, images: [] },
  twitter: { title, description },
};

export default function NotFound() {
  return (
    <main id="main" className="flex-1 flex items-center justify-center page-shell">
      <div className="w-full max-w-notice text-center">
        <div className="eyebrow mb-4 animate-fade-in-up">Sayfa bulunamadı</div>

        <h1
          className="text-[96px] font-medium tracking-tight leading-none text-fg animate-fade-in-up max-md:text-[72px]"
          style={{ animationDelay: "100ms" }}
        >
          404
        </h1>

        <p
          className="mt-8 text-body text-muted animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          Aradığın sayfa burada değil. Belki silindi, belki yanlış yere geldin,
          ya da URL&apos;de ufak bir yazım hatası var.
        </p>

        <div
          className="mt-10 flex items-center justify-center gap-3 text-ui animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href="/"
            className="link-inline"
          >
            Anasayfa
          </Link>
          <span className="text-line">·</span>
          <Link
            href="/blog"
            className="link-inline"
          >
            Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
