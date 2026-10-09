import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeExternalLinks from "rehype-external-links";
import rehypeStringify from "rehype-stringify";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import Link from "next/link";
import { SITE_URL } from "lib/identity";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const WORDS_PER_MINUTE = 220;

function PostLink({ href, children, ...props }) {
  if (href && (href.startsWith("/") || href.startsWith("#"))) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function readPostFiles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(POSTS_DIR, f));
}

function parseFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = data.slug || path.basename(filePath, ".md");
  const wordCount = content.trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return {
    slug,
    title: data.title || slug,
    date: data.date ? new Date(data.date).toISOString() : null,
    updated: data.updated ? new Date(data.updated).toISOString() : null,
    summary: data.summary || "",
    tags: data.tags || [],
    cover: data.cover || null,
    draft: data.draft === true,
    readingTime,
    body: content,
  };
}

export function getAllPosts({ includeDrafts = false } = {}) {
  return readPostFiles()
    .map(parseFile)
    .filter((p) => includeDrafts || !p.draft)
    // ISO tarih metin olarak da dogru siralaniyor; tarihsiz yazi sona dusuyor.
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function getPostBySlug(slug) {
  // Dosya adiyla degil, liste, sitemap ve feed'in kullandigi slug'la ariyoruz.
  // Adresten gelen deger de boylece dosya yoluna hic girmiyor.
  const post = getAllPosts({ includeDrafts: true }).find((p) => p.slug === slug);
  if (!post) return null;
  const { html, node } = await renderMarkdown(post.body);
  return { ...post, html, node };
}

function eachElement(node, fn) {
  for (const child of node.children ?? []) {
    if (child.type === "element") fn(child);
    eachElement(child, fn);
  }
}

// loading="lazy" olunca React gorsel icin preload ipucu uretmiyor. Yoksa
// blog listesindeki link prefetch'i, acilmamis yazilarin gorsellerini de
// indiriyordu.
function lazyImages(tree) {
  eachElement(tree, (node) => {
    if (node.tagName === "img") {
      Object.assign(node.properties, { loading: "lazy", decoding: "async" });
    }
  });
}

// Feed okuyucu yaziyi sitenin disinda gosteriyor; "/blog/..." gibi kokten
// baslayan adresleri e-posta kopruleri ve basit okuyucular cozemiyor.
const URL_PROPS = {
  a: ["href"],
  img: ["src"],
  video: ["src", "poster"],
  source: ["src"],
};

function absolutizeUrls(tree) {
  eachElement(tree, (node) => {
    for (const prop of URL_PROPS[node.tagName] ?? []) {
      const url = node.properties?.[prop];
      if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
        node.properties[prop] = `${SITE_URL}${url}`;
      }
    }
  });
}

async function renderMarkdown(markdown) {
  const processor = remark()
    .use(remarkGfm)
    // Yazidaki HTML (ornegin <video>) rehype-raw ile agaca giriyor; sayfa ve
    // feed ayni agactan uretildigi icin ikisinde de ayni gorunuyor.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeExternalLinks, {
      target: "_blank",
      rel: ["noopener", "noreferrer"],
    });

  const tree = await processor.run(processor.parse(markdown));
  lazyImages(tree);

  const node = toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: { a: PostLink },
  });

  // Sayfa yukarida React'e cevrildi; mutlak adresler yalniz feed'in HTML'ine
  // gidiyor. Site ici linkler sayfada next/link olarak kaliyor.
  absolutizeUrls(tree);
  const html = unified().use(rehypeStringify).stringify(tree);

  return { html, node };
}

export function formatDate(iso, locale = "tr-TR") {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
