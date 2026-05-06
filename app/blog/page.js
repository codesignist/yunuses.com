import Link from "next/link";
import Image from "next/image";
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
    <main id="main" className="flex-1 px-6 py-20 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[680px] mx-auto">
        <header className="mb-16 max-md:mb-12 animate-fade-in-up">
          <Link
            href="/"
            className="text-[13px] text-faint hover:text-fg transition-colors"
          >
            ← Anasayfa
          </Link>
          <h1 className="font-blog-serif mt-6 text-4xl font-semibold tracking-tight text-fg leading-tight max-md:text-3xl">
            Blog
          </h1>
          <p className="font-blog-serif mt-3 text-[15px] leading-[1.7] text-muted italic">
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
                  <div className="shrink-0 w-24 h-24 max-md:w-20 max-md:h-20 rounded-lg overflow-hidden border border-line bg-surface relative">
                    {post.cover ? (
                      <Image
                        src={post.cover}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 80px, 96px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="font-blog-serif italic absolute inset-0 flex items-center justify-center text-3xl text-faint select-none"
                      >
                        {post.title?.trim().charAt(0).toUpperCase() || "·"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 text-[13px] text-faint">
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <span className="text-line">·</span>
                      <span>{post.readingTime} dk okuma</span>
                    </div>
                    <h2 className="font-blog-serif mt-2 text-2xl font-semibold tracking-tight text-fg leading-snug group-hover:text-fg/90 transition-colors max-md:text-xl">
                      {post.title}
                    </h2>
                    {post.summary && (
                      <p className="font-blog-serif mt-3 text-[15px] leading-[1.7] text-muted">
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
