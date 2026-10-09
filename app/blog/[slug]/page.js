import ReadingProgress from "components/atoms/ReadingProgress";
import BackLink from "components/atoms/BackLink";
import { notFound } from "next/navigation";
import { formatDate, getAllPosts, getPostBySlug } from "lib/posts";
import { PERSON, SITE_URL } from "lib/identity";
import { jsonLd, breadcrumbList } from "lib/jsonLd";
import { FEED_TYPES, pageMetadata } from "lib/metadata";

// Yalniz build'de uretilen yazilar. Bilinmeyen slug render edilmeden kok
// 404'e dusuyor; yoksa her yeni adres sunucu diskine bir sayfa daha yaziyordu.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// Dosya tabanli OG gorselini Next sonda egik cizgi olmadan yaziyor; trailingSlash
// acik oldugu icin her paylasim onizlemesi once 308 aliyordu. Adresi elle
// veriyoruz, twitter:image da buradan doluyor. Gorsel degisip eski onizleme
// takilirsa adresin sonuna ?v=2 gibi bir ek konabilir.
const ogImagePath = (slug) => `/blog/${slug}/opengraph-image/`;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  // Diger sayfalarla ayni temel (og:url, site adi, dil, twitter:site);
  // yaziya ozel olan tur, yayin tarihi ve feed baglantilari.
  const base = pageMetadata({
    title: post.title,
    description: post.summary,
    path: `/blog/${slug}/`,
    image: {
      url: ogImagePath(slug),
      width: 1200,
      height: 630,
      type: "image/png",
      alt: post.title,
    },
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: post.date,
    },
    alternates: {
      ...base.alternates,
      types: FEED_TYPES,
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.draft) notFound();

  const url = `${SITE_URL}/blog/${post.slug}/`;
  const breadcrumbSchema = breadcrumbList([
    { name: "Anasayfa", url: `${SITE_URL}/` },
    { name: "Blog", url: `${SITE_URL}/blog/` },
    { name: post.title, url },
  ]);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    inLanguage: "tr-TR",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: PERSON,
    publisher: PERSON,
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}${ogImagePath(post.slug)}`,
      width: 1200,
      height: 630,
    },
  };

  return (
    <main id="main" className="flex-1 page-shell">
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }}
      />
      <article className="w-full max-w-reading mx-auto">
        <header className="mb-12 animate-fade-in-up">
          <BackLink href="/blog">Blog</BackLink>
          <h1 className="font-blog-serif mt-6 text-4xl font-semibold tracking-tight text-fg leading-tight max-md:text-3xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-baseline gap-3 text-meta text-faint">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="text-line">·</span>
            <span>{post.readingTime} dk okuma</span>
          </div>
        </header>

        <div
          className="prose-blog animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          {post.node}
        </div>
      </article>
    </main>
  );
}
