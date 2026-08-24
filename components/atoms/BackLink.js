import Link from "next/link";
import Icon from "./Icon";

// Sayfalarin ust kosesindeki geri baglantisi. Daha once uc ayri gorunumu
// vardi: duz "← Anasayfa" metni, ikonlu LinkButton ve alti cizili varyant.
// Hepsi buraya baglandi, yazim da tek: "Anasayfa".
export default function BackLink({ href, children }) {
  return (
    <Link
      href={href}
      className="link-quiet inline-flex items-center gap-1.5 text-meta"
    >
      <Icon icon="chevron-left" size={11} color="currentColor" />
      <span>{children}</span>
    </Link>
  );
}
