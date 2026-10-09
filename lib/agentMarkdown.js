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

const URL_ATTRS = { a: "href", img: "src", video: "src" };

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

// next/image, src'yi optimizer adresine ceviriyor (/_next/image/?url=...&w=3840).
// Ajana asil dosyayi veriyoruz; boyut ve kalite parametreleri onun icin gurultu.
function originalImage(src) {
  if (!src.startsWith("/_next/image")) return src;
  return new URL(src, SITE_URL).searchParams.get("url") ?? src;
}

// Bir dugumun markdown'a ne birakacagi: kendisi, hicbir sey ya da cocuklari.
function strip(child) {
  // React, bitisik metin dugumlerini SSR'de <!-- --> ile ayiriyor. Cevrilince
  // cumlenin ortasinda yorum olarak duruyor ve metni ikiye boluyor.
  if (child.type === "comment") return [];
  if (child.type !== "element") return [child];
  const props = child.properties ?? {};
  if (DROPPED_TAGS.has(child.tagName) || CHROME_ATTR in props) return [];
  // Ekran okuyucudan gizlenen susler: kapak yerine bas harf, ok isaretleri.
  if (String(props.ariaHidden) === "true") return [];
  // Hicbir yere gitmeyen baglanti (href="#"): yalniz icerigi kaliyor.
  if (child.tagName === "a" && props.href === "#") {
    return (child.children ?? []).flatMap(strip);
  }
  return [child];
}

function clean(node) {
  if (!node.children) return node;

  node.children = node.children.flatMap(strip);

  for (const child of node.children) {
    const attr = URL_ATTRS[child.tagName];
    if (attr && typeof child.properties?.[attr] === "string") {
      const url = child.properties[attr];
      child.properties[attr] = absolute(
        child.tagName === "img" ? originalImage(url) : url,
      );
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
  const content = root ? clean(root) : null;

  const body = content ? toMarkdown.stringify(toMarkdown.runSync(content)).trim() : "";
  const hasBody = body.replace(/\s+/g, " ").trim().length >= MIN_BODY_CHARS;

  // Sayfanin kendi H1'i govdeye giriyorsa baslik tekrar eklenmiyor. Markdown
  // metnine bakmak yetmiyor: satir kirilan H1 "===" alti cizgili bicime donuyor.
  const parts = [];
  if (title && !(hasBody && find(content, isTag("h1")))) parts.push(`# ${title}`);
  parts.push(hasBody ? body : description);

  return `${parts.filter(Boolean).join("\n\n")}\n`;
}

// Kaba tahmin, gercek bir tokenizer degil. Ingilizce icin yaygin kural
// 4 karakter ~ 1 token; Turkce ekler yuzunden biraz daha yogun bolunuyor.
// Ajan baglam butcesini kestirebilsin diye var, kesin sayi diye degil.
export function estimateTokens(text) {
  return Math.max(1, Math.round(text.length / 3.5));
}
