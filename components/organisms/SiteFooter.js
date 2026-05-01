"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SocialArea from "components/organisms/SocialArea";
import SharePost from "components/atoms/SharePost";

const SOCIAL_DATA = {
  next_sosyal: "https://nsosyal.com/codesignist",
  youtube: "https://www.youtube.com/yunuses",
  github: "https://github.com/codesignist",
  linkedin: "https://www.linkedin.com/in/codesignist/",
  twitter: "https://twitter.com/codesignist",
  instagram: "https://www.instagram.com/codesignist",
};

// Sayfa-bazlı içerik genişliğini eşleştir — Footer her sayfanın hizasıyla
// aynı genişlikte hizalansın.
function maxWidthFor(pathname) {
  if (!pathname || pathname === "/") return "max-w-[560px]";
  if (pathname.startsWith("/zero-to-hero")) return "max-w-[720px]";
  return "max-w-[680px]";
}

export default function SiteFooter() {
  const pathname = usePathname();

  // Lab'in iç sayfaları (oyun/deney ekranları) tam ekran kapsama yapıyor —
  // footer onları bozar, gizli kalsın. /lab ve /lab/ (trailing slash dahil)
  // anasayfa, oralarda footer görünür.
  if (pathname && /^\/lab\/[^/]/.test(pathname)) return null;

  // Blog detay sayfalarında paylaş butonu nav linklerinin sağında.
  const isBlogPost = pathname && /^\/blog\/[^/]+/.test(pathname);

  return (
    <footer className="border-t border-line px-6 max-md:px-5 py-8">
      <div className={`mx-auto ${maxWidthFor(pathname)}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-faint">
            <Link href="/" className="hover:text-fg transition-colors">
              Anasayfa
            </Link>
            <Link href="/blog" className="hover:text-fg transition-colors">
              Blog
            </Link>
            <Link href="/lab" className="hover:text-fg transition-colors">
              Lab
            </Link>
          </div>
          {isBlogPost && <SharePost />}
        </div>

        <div id="social" className="mt-6 scroll-mt-8">
          <SocialArea data={SOCIAL_DATA} />
        </div>

        <div className="mt-6 text-[12px] text-faint">
          © {new Date().getFullYear()} Yunus Eş
        </div>
      </div>
    </footer>
  );
}
