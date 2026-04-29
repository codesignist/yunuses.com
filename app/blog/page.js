import Link from "next/link";
import { formatDate, getAllPosts } from "lib/posts";

export const metadata = {
  title: "Blog — Yunus Eş",
  description: "Yazılım, ürün ve süreç üzerine notlar.",
  openGraph: {
    title: "Blog — Yunus Eş",
    description: "Yazılım, ürün ve süreç üzerine notlar.",
  },
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen px-6 py-20 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[680px] mx-auto">
        <header className="mb-16 max-md:mb-12 animate-fade-in-up">
          <Link
            href="/"
            className="text-[13px] text-faint hover:text-fg transition-colors"
          >
            ← Anasayfa
          </Link>
          <h1 className="font-blog-serif mt-6 text-[44px] font-semibold tracking-tight text-fg leading-[1.1] max-md:text-3xl">
            Blog
          </h1>
          <p className="font-blog-serif mt-4 text-[18px] leading-[1.6] text-muted italic">
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
                <Link href={`/blog/${post.slug}`} className="group block">
                  <div className="flex items-baseline gap-3 text-[13px] text-faint">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span className="text-line">·</span>
                    <span>{post.readingTime} dk okuma</span>
                  </div>
                  <h2 className="font-blog-serif mt-2 text-[28px] font-semibold tracking-tight text-fg leading-[1.2] group-hover:text-fg/90 transition-colors max-md:text-2xl">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="font-blog-serif mt-3 text-[17px] leading-[1.6] text-muted">
                      {post.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
