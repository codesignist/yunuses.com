import Icon from "../atoms/Icon";

// Bağlantının adı ikon anahtarı olunca ekran okuyucu "next_sosyal" diye
// okuyordu; burada sitenin gerçek adları.
const LABELS = {
  next_sosyal: "NSosyal",
  youtube: "YouTube",
  github: "GitHub",
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
};

const Social = ({ icon, href }) => (
  <a
    className="w-9 h-9 flex items-center justify-center text-muted hover:text-fg transition-colors"
    rel="me"
    href={href}
    target="_blank"
    aria-label={LABELS[icon] || icon}
  >
    <Icon size={18} icon={icon} color="currentColor" />
  </a>
);

export default Social;
