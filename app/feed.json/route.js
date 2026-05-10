import { buildFeed, renderJsonFeed } from "lib/feed";

export const dynamic = "force-static";

export async function GET() {
  const feed = await buildFeed("/feed.json");
  return new Response(renderJsonFeed(feed), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
