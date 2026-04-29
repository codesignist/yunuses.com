import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-blog-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export default function BlogLayout({ children }) {
  return <div className={sourceSerif.variable}>{children}</div>;
}
