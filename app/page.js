import AvatarLink from "components/atoms/AvatarLink";
import SocialAnchor from "components/atoms/SocialAnchor";
import ExperimentCover from "components/atoms/ExperimentCover";
import PostThumb from "components/atoms/PostThumb";
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
    <main id="main" className="flex-1 flex items-center justify-center page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(personSchema) }}
      />
      <div className="w-full max-w-intro">
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
          className="mt-10 space-y-5 text-body text-muted animate-fade-in-up"
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
              className="link-inline"
            >
              CodeCube Software
            </Link>
            &apos;i kurdum. Artık ekibimle birlikte müşterilerimiz için web ve
            özel yazılımlar tasarlayıp geliştiriyoruz.
          </p>
          <p>
            Bir de yerli markaları bir araya getiren{" "}
            <Link
              href="https://yerlimi.net"
              target="_blank"
              className="link-inline"
            >
              Yerlimi.net
            </Link>{" "}
            projemiz var. Bir markanın menşeini arayarak ya da ürünün barkodunu
            okutarak öğrenebilir, yerli alternatiflerini görebilirsiniz.
          </p>
          <p>
            <Link
              href="/blog"
              className="link-inline"
            >
              Blog yazılarıma
            </Link>{" "}
            göz atabilir,{" "}
            <SocialAnchor className="link-inline">
              sosyal medya hesaplarımdan
            </SocialAnchor>{" "}
            beni takip edebilir ve{" "}
            <Link
              href="/lab"
              className="link-inline"
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
            <div className="eyebrow mb-4">Son yazı</div>
            <Link
              href={`/blog/${latestPost.slug}`}
              className="group flex items-start gap-5 max-md:gap-4"
            >
              <PostThumb post={latestPost} />
              <div className="flex-1 min-w-0">
                <h2 className="font-blog-serif text-xl font-semibold tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors">
                  {latestPost.title}
                </h2>
                <div className="mt-2 flex items-baseline gap-3 text-meta text-faint">
                  <time dateTime={latestPost.date}>
                    {formatDate(latestPost.date)}
                  </time>
                  <span className="text-line">·</span>
                  <span>{latestPost.readingTime} dk okuma</span>
                </div>
                {latestPost.summary && (
                  <p className="font-blog-serif mt-3 text-body text-muted">
                    {latestPost.summary}
                  </p>
                )}
              </div>
            </Link>
            <Link
              href="/blog"
              className="link-inline inline-flex items-center gap-1.5 mt-5 text-ui"
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
            <div className="eyebrow mb-4">Son deney</div>
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
                <div className="mt-2 font-mono text-label text-faint">
                  {stampDate(latestExperiment.date)}
                  <span className="mx-2 text-line">·</span>
                  {latestExperiment.tag}
                </div>
              </div>
            </Link>
            <Link
              href="/lab"
              className="link-inline inline-flex items-center gap-1.5 mt-5 text-ui"
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
