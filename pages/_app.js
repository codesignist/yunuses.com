import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=no"
        />
        <title>Yunus Eş</title>
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta
          name="fediverse:creator"
          content="@codesignist@sosyal.teknofest.app"
        />
        <meta property="og:site_name" content="Yunus Eş" key="site_name" />
        <meta property="og:title" content="Yunus Eş" />
        <meta property="og:description" content="Kişisel websitesi" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://yunuses.com/" />
        <meta property="og:image" content="https://yunuses.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Yunus Eş — Full Stack Developer, CodeCube Software Kurucusu" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@codesignist" />
        <meta name="twitter:title" content="Yunus Eş" />
        <meta name="twitter:description" content="Kişisel websitesi" />
        <meta name="twitter:image" content="https://yunuses.com/og-image.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
