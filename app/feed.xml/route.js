import { getAllPosts, getPostBySlug } from "lib/posts";

const SITE_URL = "https://yunuses.com";
const SITE_TITLE = "Yunus Eş — Blog";
const SITE_DESCRIPTION = "Yazılım, ürün ve süreç üzerine notlar.";
const FEED_PATH = "/feed.xml";
const AUTHOR_EMAIL = "yunuses@gmail.com";
const AUTHOR_NAME = "Yunus Eş";

export const dynamic = "force-static";

function escapeXml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toRfc822(iso) {
  return iso ? new Date(iso).toUTCString() : "";
}

export async function GET() {
  const posts = getAllPosts();

  const items = await Promise.all(
    posts.map(async (post) => {
      const full = await getPostBySlug(post.slug);
      const url = `${SITE_URL}/blog/${post.slug}/`;
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${toRfc822(post.date)}</pubDate>`,
        `      <author>${AUTHOR_EMAIL} (${escapeXml(AUTHOR_NAME)})</author>`,
        post.summary
          ? `      <description>${escapeXml(post.summary)}</description>`
          : "",
        `      <content:encoded><![CDATA[${full?.html ?? ""}]]></content:encoded>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );

  const lastBuild = posts[0]?.date
    ? toRfc822(posts[0].date)
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}/blog/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>tr-TR</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}${FEED_PATH}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
