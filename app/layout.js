import "../styles/globals.css";
import Script from "next/script";
import ThemeInit from "components/atoms/ThemeInit";
import ThemeToggle from "components/atoms/ThemeToggle";
import FullscreenToggle from "components/atoms/FullscreenToggle";
import SiteFooter from "components/organisms/SiteFooter";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const title = "Yunus Eş";
const description =
  "Yazılımcı, CodeCube kurucusu. Dijital ürünler tasarlıyor ve hayata geçiriyor.";

export const metadata = {
  metadataBase: new URL("https://yunuses.com"),
  title: "Yunus Eş",
  description,
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    site: "@codesignist",
    title,
    description,
  },
  other: {
    "fediverse:creator": "@codesignist@sosyal.teknofest.app",
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
      "application/feed+json": "/feed.json",
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <ThemeInit />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-fg focus:text-bg focus:rounded focus:no-underline focus:outline-none focus:shadow-lg"
        >
          İçeriğe geç
        </a>
        <ThemeToggle />
        <FullscreenToggle />
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
