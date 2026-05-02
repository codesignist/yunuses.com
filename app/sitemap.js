import { getAllPosts } from "lib/posts";

const SITE_URL = "https://yunuses.com";

export default function sitemap() {
  const posts = getAllPosts();

  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/blog/`,
      lastModified: posts[0]?.date ? new Date(posts[0].date) : new Date(),
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
      lastModified: new Date("2026-04-30"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/lab/3d-ping-pong/`,
      lastModified: new Date("2026-04-30"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/lab/camur/`,
      lastModified: new Date("2026-05-02"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  const postRoutes = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}/`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
