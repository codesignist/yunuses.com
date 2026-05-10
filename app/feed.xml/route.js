import { buildFeed, renderRss } from "lib/feed";

export const dynamic = "force-static";

export async function GET() {
  const feed = await buildFeed("/feed.xml");
  return new Response(renderRss(feed), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
