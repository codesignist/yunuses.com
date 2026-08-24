import Link from "next/link";
import Icon from "./Icon";

// Deney sayfalarinin sol ust kosesindeki cikis dugmesi. Dort deneyde de
// birebir ayni isaretleme kopyalanmisti. Deneyin kendi yuzeyi uzerinde
// durdugu icin sitenin renk tokenlarini degil cam gorunumunu koruyor;
// geri oku ise sitenin geri kalaniyla ayni chevron.
export default function LabExitLink() {
  return (
    <Link
      href="/lab"
      aria-label="Lab'a dön"
      data-chrome
      className="fixed top-4 left-4 z-40 inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-meta text-white/75 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/15 hover:text-white"
    >
      <Icon icon="chevron-left" size={14} color="currentColor" />
      <span>Lab</span>
    </Link>
  );
}
