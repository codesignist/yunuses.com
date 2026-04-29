import "../styles/globals.css";
import ThemeInit from "components/atoms/ThemeInit";
import ThemeToggle from "components/atoms/ThemeToggle";

const title = "Yunus Eş";
const description =
  "Yazılımcı, CodeCube kurucusu. Dijital ürünler tasarlıyor ve hayata geçiriyor.";

export const metadata = {
  metadataBase: new URL("https://yunuses.com"),
  title: "Yunus Eş",
  description,
  icons: { icon: "/favicon.ico" },
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
    <html lang="tr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeInit />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-fg focus:text-bg focus:rounded focus:no-underline focus:outline-none focus:shadow-lg"
        >
          İçeriğe geç
        </a>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
