import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { SITE_URL } from "lib/identity";

// Sayfanin markdown karsiligini elle yazmak yerine kendi HTML'inden
// uretiyoruz. Anasayfadaki metin JSX icinde duruyor; ikinci bir kopya
// tutulsa metin degistikce sessizce eskirdi.

// Gorunur icerik <main id="main"> icinde; ust menu ve footer disarida.
const CONTENT_ROOT = "main";

// Markdown'a cevrilince ya bos ya gurultu olan dugumler. script onemli:
// birakilirsa JSON-LD govde metnine karisiyor.
const DROPPED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
]);

// Tema, tam ekran, imlec izi, lab'a donus... Sayfanin uzerinde yuzen kontrol
// katmani projede zaten data-chrome ile isaretli. Ayni isareti burada da
// kullaniyoruz, boylece lab deneylerinde geriye sadece canvas kaliyor.
const CHROME_ATTR = "dataChrome";

const URL_ATTRS = { a: "href", img: "src" };

// Cevirisi bu esigin altinda kalan sayfayi bos sayiyoruz. Lab deneyleri
// boyle: <main> tek bir canvas, okunacak metin yok.
const MIN_BODY_CHARS = 120;

const toMarkdown = unified()
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", rule: "-", fences: true });

function find(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

const isTag = (tagName) => (node) =>
  node.type === "element" && node.tagName === tagName;

function textOf(node) {
  if (!node) return "";
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function metaContent(tree, name) {
  const meta = find(
    tree,
    (node) => isTag("meta")(node) && node.properties?.name === name,
  );
  return typeof meta?.properties?.content === "string"
    ? meta.properties.content
    : "";
}

// Ajanin takip edebilmesi icin site ici baglantilar mutlak hale geliyor;
// markdown govdesi sayfadan koparilinca "/blog" tek basina bir sey ifade
// etmiyor.
function absolute(url) {
  return url.startsWith("/") && !url.startsWith("//") ? `${SITE_URL}${url}` : url;
}

function clean(node) {
  if (!node.children) return node;

  node.children = node.children.filter((child) => {
    // React, bitisik metin dugumlerini SSR'de <!-- --> ile ayiriyor. Cevrilince
    // cumlenin ortasinda yorum olarak duruyor ve metni ikiye boluyor.
    if (child.type === "comment") return false;
    if (child.type !== "element") return true;
    return !(
      DROPPED_TAGS.has(child.tagName) || CHROME_ATTR in (child.properties ?? {})
    );
  });

  for (const child of node.children) {
    const attr = URL_ATTRS[child.tagName];
    if (attr && typeof child.properties?.[attr] === "string") {
      child.properties[attr] = absolute(child.properties[attr]);
    }
    clean(child);
  }

  return node;
}

export function pageToMarkdown(html) {
  const tree = unified().use(rehypeParse).parse(html);
  const title = textOf(find(tree, isTag("title"))).trim();
  const description = metaContent(tree, "description");
  const root = find(tree, isTag(CONTENT_ROOT)) ?? find(tree, isTag("body"));

  const body = root ? toMarkdown.stringify(toMarkdown.runSync(clean(root))).trim() : "";
  const hasBody = body.replace(/\s+/g, " ").trim().length >= MIN_BODY_CHARS;

  const parts = [];
  if (title && !/^#\s/m.test(body)) parts.push(`# ${title}`);
  parts.push(hasBody ? body : description);

  return `${parts.filter(Boolean).join("\n\n")}\n`;
}

// Kaba tahmin, gercek bir tokenizer degil. Ingilizce icin yaygin kural
// 4 karakter ~ 1 token; Turkce ekler yuzunden biraz daha yogun bolunuyor.
// Ajan baglam butcesini kestirebilsin diye var, kesin sayi diye degil.
export function estimateTokens(text) {
  return Math.max(1, Math.round(text.length / 3.5));
}
