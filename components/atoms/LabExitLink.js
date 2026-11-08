import Link from "next/link";
import Icon from "./Icon";

const TONES = {
  dark: "rounded border-white/10 bg-white/5 text-white/75 backdrop-blur-sm hover:border-white/25 hover:bg-white/15 hover:text-white",
  light:
    "rounded-lg border-black/[0.07] bg-white/80 text-muted backdrop-blur-md hover:border-black/15 hover:bg-white hover:text-fg",
};

// Deney sayfalarinin sol ust kosesindeki cikis dugmesi. Dort deneyde de
// birebir ayni isaretleme kopyalanmisti. Deneyin kendi yuzeyi uzerinde
// durdugu icin sitenin renk tokenlarini degil cam gorunumunu koruyor;
// geri oku ise sitenin geri kalaniyla ayni chevron. tone="light" beyaz
// zeminli sahne icin (Globe).
export default function LabExitLink({ tone = "dark" }) {
  return (
    <Link
      href="/lab"
      aria-label="Lab'a dön"
      data-chrome
      className={`fixed top-4 left-4 z-40 inline-flex items-center gap-2 border px-3 py-2 text-meta transition ${TONES[tone]}`}
    >
      <Icon icon="chevron-left" size={14} color="currentColor" />
      <span>Lab</span>
    </Link>
  );
}
