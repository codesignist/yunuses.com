import { SITE_URL } from "lib/identity";

export const dynamic = "force-static";

// RFC 9727 API katalogu, gövdesi RFC 9264 linkset formatında. İlk kayıt ana
// sayfanın Link header'ının aynısı: sitenin makine tarafından okunabilir
// uçları. Sonraki kayıtlar her ucun hangi spesifikasyona uyduğunu söyler.
const catalog = {
  linkset: [
    {
      anchor: `${SITE_URL}/`,
      alternate: [
        {
          href: `${SITE_URL}/feed.xml`,
          type: "application/rss+xml",
          title: "Blog (RSS)",
        },
        {
          href: `${SITE_URL}/feed.json`,
          type: "application/feed+json",
          title: "Blog (JSON Feed)",
        },
      ],
      describedby: [
        {
          href: `${SITE_URL}/sitemap.xml`,
          type: "application/xml",
          title: "Site haritası",
        },
      ],
    },
    {
      anchor: `${SITE_URL}/feed.xml`,
      "service-doc": [
        {
          href: "https://www.rssboard.org/rss-specification",
          type: "text/html",
          title: "RSS 2.0 spesifikasyonu",
        },
      ],
    },
    {
      anchor: `${SITE_URL}/feed.json`,
      "service-doc": [
        {
          href: "https://www.jsonfeed.org/version/1.1/",
          type: "text/html",
          title: "JSON Feed 1.1 spesifikasyonu",
        },
      ],
    },
    {
      anchor: `${SITE_URL}/sitemap.xml`,
      "service-doc": [
        {
          href: "https://www.sitemaps.org/protocol.html",
          type: "text/html",
          title: "Sitemaps 0.90 protokolü",
        },
      ],
    },
  ],
};

export async function GET() {
  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
