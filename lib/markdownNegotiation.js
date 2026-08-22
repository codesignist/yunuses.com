// Accept pazarligiyla ilgili saf mantik. Middleware edge'de calistigi icin
// burada agir bir sey olmamali: cevirinin kendisi lib/agentMarkdown.js'de.

// Istenen yolu middleware'den route handler'a bu baslikla tasiyoruz.
export const PATH_HEADER = "x-markdown-path";

const READ_METHODS = new Set(["GET", "HEAD"]);

// Uzantili her sey (feed.xml, robots.txt, gorseller) ve zaten makine
// okunabilir olan uclar disarida: markdown karsiligi ya anlamsiz ya da
// halihazirda var.
const NON_PAGE_PREFIX = /^\/(api|\.well-known)\//;

function quality(accept, type) {
  for (const entry of accept.split(",")) {
    const [mime, ...params] = entry.trim().split(";");
    if (mime.trim().toLowerCase() !== type) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const parsed = q ? Number.parseFloat(q.slice(2)) : 1;
    return Number.isFinite(parsed) ? parsed : 1;
  }
  return 0;
}

// Yalnizca acikca istenmisse. curl'un */* varsayilani ya da tarayicinin uzun
// listesi markdown'a dusmemeli, o yuzden joker eslesmeye bakmiyoruz.
function prefersMarkdown(accept) {
  if (!accept) return false;
  const markdown = quality(accept, "text/markdown");
  return markdown > 0 && markdown >= quality(accept, "text/html");
}

export function wantsMarkdown({ method, pathname, accept }) {
  return (
    READ_METHODS.has(method) &&
    !NON_PAGE_PREFIX.test(pathname) &&
    !/\.[^/]+$/.test(pathname) &&
    prefersMarkdown(accept)
  );
}
