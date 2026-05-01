import ReadingProgress from "components/atoms/ReadingProgress";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getAllPosts, getPostBySlug } from "lib/posts";

const SITE_URL = "https://yunuses.com";

function jsonLd(schema) {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Yunus Eş`,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.draft) notFound();

  const url = `${SITE_URL}/blog/${post.slug}/`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.date,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: "Yunus Eş", url: SITE_URL },
    publisher: { "@type": "Person", name: "Yunus Eş", url: SITE_URL },
    image: `${SITE_URL}/blog/${post.slug}/opengraph-image`,
  };

  return (
    <main id="main" className="flex-1 px-6 py-20 max-md:py-12 max-md:px-5">
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
      />
      <article className="w-full max-w-[680px] mx-auto">
        <header className="mb-12 animate-fade-in-up">
          <Link
            href="/blog"
            className="text-[13px] text-faint hover:text-fg transition-colors"
          >
            ← Blog
          </Link>
          <h1 className="font-blog-serif mt-6 text-4xl font-semibold tracking-tight text-fg leading-tight max-md:text-3xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-baseline gap-3 text-[13px] text-faint">
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
