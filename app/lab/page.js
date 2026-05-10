import Link from "next/link";
import Image from "next/image";
import experiments from "data/lab.json";

const description =
  "Eski ve yeni deneysel çalışmalar. Flash döneminden bugüne kalan minik prototipler, oyunlar ve görsel denemeler.";

export const metadata = {
  title: "Lab",
  description,
  openGraph: { title: "Lab", description },
};

export default function LabIndex() {
  return (
    <main id="main" className="flex-1 px-6 py-20 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[680px] mx-auto">
        <header className="mb-16 max-md:mb-12 animate-fade-in-up">
          <Link
            href="/"
            className="text-[13px] text-faint hover:text-fg transition-colors"
          >
            ← Anasayfa
          </Link>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-fg leading-tight max-md:text-3xl">
            Lab
          </h1>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted">
            Eski Flash dönemimden bu yana biriken küçük deneyler, prototipler ve
            görsel oyunlar. Hepsi bağımsız sayfalarda; ana siteyi yormadan
            isteğe bağlı çalışıyor.
          </p>
        </header>

        <ul className="space-y-12">
          {experiments.map((item, i) => (
            <li
              key={item.slug}
              className="animate-fade-in-up"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <Link
                href={`/lab/${item.slug}`}
                className="group flex items-start gap-5 max-md:gap-4"
              >
                <div className="shrink-0 w-24 h-24 max-md:w-20 max-md:h-20 rounded-lg overflow-hidden border border-line bg-surface relative">
                  {item.cover ? (
                    <Image
                      src={item.cover}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 80px, 96px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center text-3xl text-faint select-none"
                    >
                      {item.title?.trim().charAt(0).toUpperCase() || "·"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-medium tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors max-md:text-xl">
                    {item.title}
                  </h2>
                  <div className="mt-1 text-[13px] text-faint">{item.tag}</div>
                  <p className="mt-3 text-[15px] leading-[1.7] text-muted">
                    {item.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
