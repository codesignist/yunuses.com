import { getAllPosts, getPostBySlug } from "lib/posts";

const SITE_URL = "https://yunuses.com";
const SITE_TITLE = "Yunus Eş — Blog";
const SITE_DESCRIPTION = "Yazılım, ürün ve süreç üzerine notlar.";
const LANGUAGE = "tr-TR";
const BLOG_PATH = "/blog/";
const AUTHOR = {
  name: "Yunus Eş",
  email: "yunuses@gmail.com",
  url: SITE_URL,
};

// Normalize edilmiş feed datası — RSS ve JSON Feed renderer'ları bunu tüketir.
// Format-specific bir karar (RFC822 tarihi, JSON Feed authors arrayi, vs.)
// renderer'da yapılır; bu fonksiyon formattan bağımsız.
export async function buildFeed(feedPath) {
  const posts = getAllPosts();
  const items = await Promise.all(
    posts.map(async (post) => {
      const full = await getPostBySlug(post.slug);
      const url = `${SITE_URL}/blog/${post.slug}/`;
      return {
        id: url,
        url,
        title: post.title,
        summary: post.summary || "",
        contentHtml: full?.html ?? "",
        date: post.date,
        tags: post.tags ?? [],
      };
    }),
  );

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    language: LANGUAGE,
    homeUrl: `${SITE_URL}${BLOG_PATH}`,
    feedUrl: `${SITE_URL}${feedPath}`,
    author: AUTHOR,
    items,
  };
}

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

export function renderRss(feed) {
  const itemsXml = feed.items
    .map((item) =>
      [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${item.url}</link>`,
        `      <guid isPermaLink="true">${item.url}</guid>`,
        `      <pubDate>${toRfc822(item.date)}</pubDate>`,
        `      <author>${feed.author.email} (${escapeXml(feed.author.name)})</author>`,
        item.summary
          ? `      <description>${escapeXml(item.summary)}</description>`
          : "",
        `      <content:encoded><![CDATA[${item.contentHtml}]]></content:encoded>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const lastBuild = feed.items[0]?.date
    ? toRfc822(feed.items[0].date)
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${feed.homeUrl}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>${feed.language}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${feed.feedUrl}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;
}

export function renderJsonFeed(feed) {
  const authors = [{ name: feed.author.name, url: feed.author.url }];
  return JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: feed.title,
      home_page_url: feed.homeUrl,
      feed_url: feed.feedUrl,
      description: feed.description,
      language: feed.language,
      authors,
      items: feed.items.map((item) => ({
        id: item.id,
        url: item.url,
        title: item.title,
        content_html: item.contentHtml,
        summary: item.summary || undefined,
        date_published: item.date,
        tags: item.tags.length ? item.tags : undefined,
        authors,
      })),
    },
    null,
    2,
  );
}
