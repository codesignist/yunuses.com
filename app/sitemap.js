import { getAllPosts } from "lib/posts";
import { getExperiments } from "lib/experiments";

const SITE_URL = "https://yunuses.com";

// lastmod, sayfanin gosterdigi en yeni kaydin tarihi. Build saatini yazmiyoruz:
// ilgisiz bir dagitimda da degisen tarihe arama motorlari guvenmeyi birakiyor.
// Tarih yoksa alan hic yazilmiyor.
function newest(...dates) {
  const times = dates.filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}

export default function sitemap() {
  const posts = getAllPosts();
  const experiments = getExperiments();

  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastModified: newest(posts[0]?.date, experiments[0]?.date),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/blog/`,
      lastModified: newest(posts[0]?.date),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/zero-to-hero/`,
      lastModified: new Date("2026-04-21"),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/lab/`,
      lastModified: newest(experiments[0]?.date),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const labRoutes = experiments.map((exp) => ({
    url: `${SITE_URL}/lab/${exp.slug}/`,
    lastModified: newest(exp.date),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const postRoutes = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}/`,
    lastModified: newest(post.updated || post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...labRoutes, ...postRoutes];
}
