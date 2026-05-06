import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeExternalLinks from "rehype-external-links";
import rehypeStringify from "rehype-stringify";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import Link from "next/link";

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
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostSlugs({ includeDrafts = false } = {}) {
  return getAllPosts({ includeDrafts }).map((p) => p.slug);
}

export async function getPostBySlug(slug) {
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const post = parseFile(filePath);
  const { html, node } = await renderMarkdown(post.body);
  return { ...post, html, node };
}

async function renderMarkdown(markdown) {
  const processor = remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeExternalLinks, {
      target: "_blank",
      rel: ["noopener", "noreferrer"],
    });

  const tree = await processor.run(processor.parse(markdown));

  const html = unified()
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(tree);

  const node = toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: { a: PostLink },
  });

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
