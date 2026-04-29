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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Yunus Eş — Kurucu, CodeCube",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@codesignist",
    title,
    description,
    images: ["/og-image.png"],
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
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
