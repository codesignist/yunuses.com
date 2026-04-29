import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import { formatDate, getAllPosts, getPostBySlug } from "lib/posts";

export const alt = "Yunus Eş — Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  const avatarBuffer = fs.readFileSync(
    path.join(process.cwd(), "public", "avatar.png"),
  );
  const avatarSrc = `data:image/png;base64,${avatarBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#6b6b6b",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Yunus Eş — Blog
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            marginTop: 56,
            display: "flex",
            flex: 1,
          }}
        >
          {post?.title ?? "Yazı"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 40,
          }}
        >
          <img
            src={avatarSrc}
            width={64}
            height={64}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, color: "#fafafa" }}>Yunus Eş</div>
            <div style={{ fontSize: 22, color: "#6b6b6b", marginTop: 4 }}>
              {[
                post?.date ? formatDate(post.date) : null,
                post?.readingTime ? `${post.readingTime} dk okuma` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
