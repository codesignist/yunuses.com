import AvatarLink from "components/atoms/AvatarLink";
import SocialAnchor from "components/atoms/SocialAnchor";
import ExperimentCover from "components/atoms/ExperimentCover";
import { getLatestExperiment, stampDate } from "lib/experiments";
import { formatDate, getAllPosts } from "lib/posts";
import { PERSON } from "lib/identity";
import { jsonLd } from "lib/jsonLd";
import { FEED_TYPES } from "lib/metadata";
import Link from "next/link";

export const metadata = {
  alternates: {
    canonical: "/",
    types: FEED_TYPES,
  },
};

const personSchema = {
  "@context": "https://schema.org",
  ...PERSON,
};

export default function Home() {
  const latestPost = getAllPosts()[0];
  const latestExperiment = getLatestExperiment();

  return (
    <main id="main" className="flex-1 flex items-center justify-center px-6 py-16 max-md:py-12 max-md:px-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(personSchema) }}
      />
      <div className="w-full max-w-[560px]">
        <div className="flex items-center gap-6">
          <AvatarLink />

          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <h1 className="text-4xl font-medium tracking-tight leading-none text-fg max-md:text-3xl">
              Yunus Eş
            </h1>
            <p className="text-xl text-muted tracking-tight leading-tight">
              codesignist
            </p>
          </div>
        </div>

        <div
          className="mt-10 space-y-5 text-[15px] leading-[1.7] text-muted animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <p>
            90&apos;lı yılların sonunda çocuk yaşta yazılımla ilgilenmeye
            başladım. Flash ve ActionScript&apos;in parlak yıllarından geçtim;
            bugün React, Node.js, MongoDB gibi modern web teknolojileriyle
            çalışıyorum.
          </p>
          <p>
            2024&apos;ün sonunda{" "}
            <Link
              href="https://codecube.com.tr"
              target="_blank"
              className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              CodeCube Software
            </Link>
            &apos;i kurdum. Artık ekibimle birlikte müşterilerimiz için web ve
            özel yazılımlar tasarlayıp geliştiriyoruz.
          </p>
          <p>
            <Link
              href="/blog"
              className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              Blog yazılarıma
            </Link>{" "}
            göz atabilir,{" "}
            <SocialAnchor className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors">
              sosyal medya hesaplarımdan
            </SocialAnchor>{" "}
            beni takip edebilir ve{" "}
            <Link
              href="/lab"
              className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              lab
            </Link>&apos;deki oyun ve deneyleri{" "}
            inceleyebilirsiniz.
          </p>
        </div>

        {latestPost && (
          <div
            className="mt-12 pt-8 border-t border-line animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            <div className="text-[12px] text-faint uppercase tracking-[0.08em] mb-4">
              Son yazı
            </div>
            <Link href={`/blog/${latestPost.slug}`} className="group block">
              <h2 className="text-xl font-medium tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors">
                {latestPost.title}
              </h2>
              <div className="mt-2 flex items-baseline gap-3 text-[13px] text-faint">
                <time dateTime={latestPost.date}>
                  {formatDate(latestPost.date)}
                </time>
                <span className="text-line">·</span>
                <span>{latestPost.readingTime} dk okuma</span>
              </div>
              {latestPost.summary && (
                <p className="mt-3 text-[15px] leading-[1.7] text-muted">
                  {latestPost.summary}
                </p>
              )}
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 mt-5 text-[14px] text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              Tüm yazılar
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        {latestExperiment && (
          <div
            className="mt-12 pt-8 border-t border-line animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            <div className="text-[12px] text-faint uppercase tracking-[0.08em] mb-4">
              Son deney
            </div>
            {/* Blogun aksine deneyin anlatacagi seyi gorselin kendisi
                anlatiyor; burada ozet yok, kapak ve ad yetiyor. */}
            <Link href={`/lab/${latestExperiment.slug}`} className="group block">
              {latestExperiment.cover && (
                <ExperimentCover
                  src={latestExperiment.cover}
                  sizes="(max-width: 768px) 100vw, 560px"
                />
              )}
              <div className={latestExperiment.cover ? "mt-4" : ""}>
                <h2 className="text-xl font-medium tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors">
                  {latestExperiment.title}
                </h2>
                <div className="mt-2 font-mono text-[12px] text-faint">
                  {stampDate(latestExperiment.date)}
                  <span className="mx-2 text-line">·</span>
                  {latestExperiment.tag}
                </div>
              </div>
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 mt-5 text-[14px] text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              Tüm deneyler
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
