const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://analytics.yunuses.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://analytics.yunuses.com${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
];

// RFC 8288 Link header'ı: sayfayı HTML olarak parse etmeden, sadece response
// header'ına bakan ajanlara sitenin makine tarafından okunabilir uçlarını
// duyurur. Değerler IANA'da kayıtlı rel tipleri; başlıklar ASCII, çünkü
// header değerlerinde Türkçe karakter taşımak riskli.
const agentDiscoveryLinks = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</feed.xml>; rel="alternate"; type="application/rss+xml"; title="Blog (RSS)"',
  '</feed.json>; rel="alternate"; type="application/feed+json"; title="Blog (JSON Feed)"',
  '</sitemap.xml>; rel="describedby"; type="application/xml"; title="Sitemap"',
];

// Markdown da aynı adresten döndüğü için buraya "Vary: Accept" eklemek akla
// geliyor ama işe yaramıyor: Next sayfa yanıtında Vary'yi kendi değeriyle
// baştan yazıyor. HTML ileride kenarda önbelleklenirse ayrımı bir
// Cloudflare kuralı yapmalı.
const agentDiscoveryHeaders = [
  {
    key: "Link",
    value: agentDiscoveryLinks.join(", "),
  },
];

// Dragon'un model ve dokuları sabit adlarla duruyor; Next public dosyaları
// max-age=0 ile verdiği için her ziyarette yeniden soruluyordu. Adlar
// sürümlenmediği için bir günle sınırlı.
const dragonAssetHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=86400",
  },
];

module.exports = {
  reactStrictMode: true,
  trailingSlash: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Sadece sayfalara: trailingSlash açık olduğu için HTML rotaları "/" ile
      // biter, statik dosyalar bitmez. Link header'ını asset'lere taşımıyoruz.
      {
        source: "/",
        headers: agentDiscoveryHeaders,
      },
      {
        source: "/:path+/",
        headers: agentDiscoveryHeaders,
      },
      // Sadece uzantılı dosyalar: /lab/dragon/ sayfasının kendisi dışarıda.
      {
        source: "/lab/dragon/:file(.+\\.\\w+)",
        headers: dragonAssetHeaders,
      },
      // .obj için tanımlı bir tür yok, application/x-tgif ile gidince ne
      // Next ne Cloudflare sıkıştırıyordu. Düz metin olarak gzip'e giriyor.
      {
        source: "/lab/dragon/limb.obj",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
  async redirects() {
    return [
      // www ile gelen apex'e gitsin; yoksa paylaşılan linkler, tema tercihi ve
      // istatistikler iki adrese bölünüyor. Sondaki "/" sayfaları tek
      // atlamada götürüyor.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.yunuses.com" }],
        destination: "https://yunuses.com/:path*/",
        permanent: true,
      },
      { source: "/rss", destination: "/feed.xml", permanent: true },
      { source: "/feed", destination: "/feed.xml", permanent: true },
      { source: "/atom.xml", destination: "/feed.xml", permanent: true },
    ];
  },
};
