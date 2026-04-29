import { getAllPosts, getPostBySlug } from "lib/posts";

const SITE_URL = "https://yunuses.com";
const SITE_TITLE = "Yunus Eş — Blog";
const SITE_DESCRIPTION = "Yazılım, ürün ve süreç üzerine notlar.";
const FEED_PATH = "/feed.json";
const AUTHOR_NAME = "Yunus Eş";
const AUTHOR_URL = "https://yunuses.com";

export const dynamic = "force-static";

export async function GET() {
  const posts = getAllPosts();

  const items = await Promise.all(
    posts.map(async (post) => {
      const full = await getPostBySlug(post.slug);
      const url = `${SITE_URL}/blog/${post.slug}/`;
      return {
        id: url,
        url,
        title: post.title,
        content_html: full?.html ?? "",
        summary: post.summary || undefined,
        date_published: post.date,
        tags: post.tags?.length ? post.tags : undefined,
        authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
      };
    }),
  );

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: SITE_TITLE,
    home_page_url: `${SITE_URL}/blog/`,
    feed_url: `${SITE_URL}${FEED_PATH}`,
    description: SITE_DESCRIPTION,
    language: "tr-TR",
    authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
    items,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
