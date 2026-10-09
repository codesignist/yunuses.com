import "../styles/globals.css";
import Script from "next/script";
import ThemeInit from "components/atoms/ThemeInit";
import ChromeControls from "components/organisms/ChromeControls";
import CursorTrailLoader from "components/atoms/CursorTrailLoader";
import SiteFooter from "components/organisms/SiteFooter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE } from "lib/metadata";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// preload kapali: mono yalnizca kucuk etiketlerde (deney tarihleri, lab
// listesi, zero-to-hero) var, blog listesinde ve cogu yazida hic yok. Acikken
// iki dosya her sayfada CSS ile ayni anda iniyor, blogun asil ihtiyaci olan
// serif dosyalari arkada sirada bekliyordu.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

// Serif once sadece /blog altinda yukleniyordu; bu yuzden anasayfadaki
// "Son yazi" karti, blog listesindeki ayni basligi sans gosteriyordu.
// Kok layout'a alindi ki yazi basligi nerede gorunurse gorunsun ayni
// karakterde olsun. Degisken font, sabit agirlik listesine gerek yok.
//
// preload kapali: serif sadece anasayfa ile /blog altinda kullaniliyor,
// oysa kok layout'ta durdugu icin preload her rotaya link dusuruyordu —
// three.js yukleyen deney sayfalarina 4 gereksiz font dosyasi. CSS ayni
// pakette geldigi icin ihtiyac duyan sayfa fontu yine ilk boyamada
// istiyor; display:swap ve next/font'un olcu-duzeltilmis yedek fontu
// aradaki farki kapatiyor.
const sourceSerif = Source_Serif_4({
  variable: "--font-blog-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  style: ["normal", "italic"],
  preload: false,
});

const title = SITE_NAME;
const description = SITE_DESCRIPTION;

// Alt sayfalar `title: "Foo"` yazınca otomatik "Foo · Yunus Eş" olur.
// Default ise root sayfası için doğrudan "Yunus Eş".
const titleConfig = {
  default: title,
  template: `%s · ${title}`,
};

export const metadata = {
  metadataBase: new URL("https://yunuses.com"),
  title: titleConfig,
  description,
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: title,
    locale: "tr_TR",
    title: titleConfig,
    description,
    url: "/",
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@codesignist",
    title: titleConfig,
    description,
  },
};

// Yakinlastirma acik kaliyor: blog metnini iki parmakla buyutebilmek gerekiyor.
// Deney tuvalleri touch-none ile kendi dokunma hareketlerini zaten koruyor.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <ThemeInit />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-fg focus:text-bg focus:rounded focus:no-underline focus:outline-none focus:shadow-lg"
        >
          İçeriğe geç
        </a>
        <ChromeControls />
        <CursorTrailLoader />
        {children}
        <SiteFooter />
        <Script
          src="https://analytics.yunuses.com/script.js"
          data-website-id="c903e81f-fc77-4e75-b2cb-e97f985047ab"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
