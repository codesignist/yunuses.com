import { estimateTokens, pageToMarkdown } from "lib/agentMarkdown";
import { PATH_HEADER } from "lib/markdownNegotiation";

export const dynamic = "force-dynamic";

// Sayfayi kendi sunucumuzdan cekiyoruz. Public adres uzerinden gitmek
// Cloudflare'a cikip geri donmek demek: gereksiz bir tur, ustelik proxy'nin
// kendi markdown cevirisi acilirsa dongu riski var.
const LOCAL_ORIGIN = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

// Ucu middleware cagiriyor ama adres disaridan da erisilebilir. Yolu site
// icine kilitliyoruz, yoksa elimizde acik bir proxy kalir.
function isSafePath(path) {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/api/") &&
    !path.includes("..") &&
    !path.includes("\\")
  );
}

// Kanonik adresi Link ile bildirmeye calismanin anlami yok: next.config'teki
// sayfa geneli Link basligi ayni anahtari eziyor. Ajan zaten istedigi adresin
// kendisini aliyor, rewrite disaridan gorunmuyor.
function markdownResponse(body, { status = 200 } = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Markdown-Tokens": String(estimateTokens(body)),
      // Ayni adres iki farkli govde donduruyor. Vary dogru olan, ama
      // Cloudflare dahil cogu paylasimli onbellek Accept'e bakmiyor; markdown
      // bir kez onbellege girse tarayiciya da o gider. Onbelleklemiyoruz.
      Vary: "Accept",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request) {
  const path = request.headers.get(PATH_HEADER) ?? "/";

  if (!isSafePath(path)) {
    return markdownResponse("# Gecersiz yol\n", { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(`${LOCAL_ORIGIN}${path}`, {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
  } catch {
    return markdownResponse("# Sayfa alinamadi\n", { status: 502 });
  }

  if (!upstream.headers.get("content-type")?.includes("text/html")) {
    return markdownResponse("# Bu adresin markdown karsiligi yok\n", {
      status: 406,
    });
  }

  const markdown = pageToMarkdown(await upstream.text());
  return markdownResponse(markdown, { status: upstream.status });
}
