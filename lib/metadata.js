export const SITE_NAME = "Yunus Eş";
export const SITE_DESCRIPTION =
  "Yazılımcı, CodeCube kurucusu. Dijital ürünler tasarlıyor ve hayata geçiriyor.";

export const FEED_TYPES = {
  "application/rss+xml": "/feed.xml",
  "application/feed+json": "/feed.json",
};

// Sitenin genel paylasim gorseli (app/opengraph-image.js). Adres elle ve
// sonda egik cizgiyle yaziliyor: trailingSlash acik oldugu icin Next'in
// kendi urettigi "/opengraph-image?hash" adresi once 308'e dusuyordu.
export const SITE_OG_IMAGE = {
  url: "/opengraph-image/",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Yunus Eş, codesignist",
};

// Sayfa duzeyindeki openGraph nesnesi kok layout'takinin yerine geciyor,
// birlesmiyor; verilmeyen gorsel, url ve site adi paylasimda dusuyordu.
// twitter basligi da kokten "Yunus Eş" olarak miras kaliyordu. Alt sayfalar
// ikisini de buradan eksiksiz kuruyor. twitter gorseli verilmiyor, Next onu
// openGraph.images'tan dolduruyor.
export function pageMetadata({ title, description, path, image = SITE_OG_IMAGE }) {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "tr_TR",
      url: path,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: "@codesignist",
      title,
      description,
    },
    alternates: {
      canonical: path,
    },
  };
}
