import "../styles/globals.css";

export const metadata = {
  metadataBase: new URL("https://yunuses.com"),
  title: "Yunus Eş",
  description: "Kişisel websitesi",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "Yunus Eş",
    title: "Yunus Eş",
    description: "Kişisel websitesi",
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
    title: "Yunus Eş",
    description: "Kişisel websitesi",
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
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
