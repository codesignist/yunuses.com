import { NextResponse } from "next/server";
import { PATH_HEADER, wantsMarkdown } from "lib/markdownNegotiation";

// Ajan text/markdown isterse sayfanin markdown karsiligini donuyoruz.
// Tarayicilar Accept'te text/html gonderdigi icin varsayilan HTML kaliyor.
export function middleware(request) {
  const negotiated = wantsMarkdown({
    method: request.method,
    pathname: request.nextUrl.pathname,
    accept: request.headers.get("accept"),
  });

  if (!negotiated) return NextResponse.next();

  const url = request.nextUrl.clone();
  // Sondaki egik cizgi sart: trailingSlash acik oldugu icin Next, uzantisiz
  // hedefi kanonik haline 308'liyor ve rewrite govdesiz bir yanita dusuyor.
  url.pathname = "/api/markdown/";

  // Istenen yolu sorgu parametresiyle degil baslikla tasiyoruz: rewrite
  // sonrasi route handler'a orijinal URL geliyor, eklenen sorgu gorunmuyor.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Sadece varlik trafigini eliyoruz. Geri kalan filtre wantsMarkdown icinde:
  // matcher'a karmasik regex yazmak path-to-regexp'i bozuyor ve eslesen
  // sayfalar govdesiz donuyor.
  matcher: ["/((?!_next/).*)"],
};
