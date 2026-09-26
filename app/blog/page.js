import Link from "next/link";
import BackLink from "components/atoms/BackLink";
import PostThumb from "components/atoms/PostThumb";
import { formatDate, getAllPosts } from "lib/posts";
import { FEED_TYPES } from "lib/metadata";

const description = "Yazılım, ürün ve süreç üzerine notlar.";

export const metadata = {
  title: "Blog",
  description,
  openGraph: { title: "Blog", description },
  alternates: {
    canonical: "/blog/",
    types: FEED_TYPES,
  },
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main id="main" className="flex-1 page-shell">
      <div className="w-full max-w-reading mx-auto">
        <header className="mb-16 max-md:mb-12 animate-fade-in-up">
          <BackLink href="/">Anasayfa</BackLink>
          <h1 className="font-blog-serif mt-6 text-4xl font-semibold tracking-tight text-fg leading-tight max-md:text-3xl">
            Blog
          </h1>
          <p className="font-blog-serif mt-3 text-body text-muted italic">
            Yazılım, ürün ve süreç üzerine notlar.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-muted">Henüz yazı yok.</p>
        ) : (
          <ul className="space-y-12">
            {posts.map((post, i) => (
              <li
                key={post.slug}
                className="animate-fade-in-up"
                style={{ animationDelay: `${100 + i * 80}ms` }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex items-start gap-5 max-md:gap-4"
                >
                  <PostThumb post={post} />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-blog-serif text-2xl font-semibold tracking-tight text-fg leading-snug group-hover:text-fg/80 transition-colors max-md:text-xl">
                      {post.title}
                    </h2>
                    <div className="mt-1 flex items-baseline gap-3 text-meta text-faint">
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <span className="text-line">·</span>
                      <span>{post.readingTime} dk okuma</span>
                    </div>
                    {post.summary && (
                      <p className="font-blog-serif mt-3 text-body text-muted">
                        {post.summary}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
