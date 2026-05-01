import Link from "next/link";
import LinkButton from "components/atoms/LinkButton";

export const metadata = {
  title: "Lab — Yunus Eş",
  description:
    "Eski ve yeni deneysel çalışmalar. Flash döneminden bugüne kalan minik prototipler, oyunlar ve görsel denemeler.",
  openGraph: {
    title: "Lab — Yunus Eş",
    description:
      "Eski ve yeni deneysel çalışmalar. Flash döneminden bugüne kalan minik prototipler, oyunlar ve görsel denemeler.",
  },
};

const experiments = [
  {
    slug: "3d-ping-pong",
    title: "3D Ping Pong",
    summary:
      "Flash zamanlarımdan kalma minik bir 3D ping pong oyununun yeniden yorumu. Engine yok; saf Canvas 2D üzerine yazılmış elden bir perspektif projeksiyonu.",
    year: "2009 → 2026",
    tag: "Oyun",
  },
];

export default function LabIndex() {
  return (
    <main id="main" className="min-h-screen px-6 py-20 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[680px] mx-auto">
        <header className="mb-16 max-md:mb-12 animate-fade-in-up">
          <LinkButton icon="chevron-left" href="/">
            Ana sayfa
          </LinkButton>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-fg leading-tight max-md:text-3xl">
            Lab
          </h1>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted">
            Eski Flash dönemimden bu yana biriken küçük deneyler, prototipler ve
            görsel oyunlar. Hepsi bağımsız sayfalarda; ana siteyi yormadan
            isteğe bağlı çalışıyor.
          </p>
        </header>

        <ul className="space-y-10">
          {experiments.map((item, i) => (
            <li
              key={item.slug}
              className="animate-fade-in-up"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <Link href={`/lab/${item.slug}`} className="group block">
                <div className="flex items-baseline gap-3 text-[13px] text-faint">
                  <span>{item.year}</span>
                  <span className="text-line">·</span>
                  <span>{item.tag}</span>
                </div>
                <h2 className="mt-2 text-2xl font-medium tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors max-md:text-xl">
                  {item.title}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.7] text-muted">
                  {item.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
