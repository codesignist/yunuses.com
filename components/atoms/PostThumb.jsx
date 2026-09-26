import Image from "next/image";

export default function PostThumb({ post }) {
  return (
    <div className="shrink-0 w-24 h-24 max-md:w-20 max-md:h-20 rounded-lg overflow-hidden border border-line bg-surface relative">
      {post.cover ? (
        <Image
          src={post.cover}
          alt=""
          fill
          sizes="(max-width: 768px) 80px, 96px"
          className="object-cover"
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
  );
}
