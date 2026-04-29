import "../styles/globals.css";
import ThemeToggle from "components/atoms/ThemeToggle";
import Script from "next/script";

const themeInitScript = `(function(){try{var s=localStorage.getItem("theme");var t=s||(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

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
        <Script
          id="theme-init"
          strategy="beforeInteractive"
        >
          {themeInitScript}
        </Script>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
