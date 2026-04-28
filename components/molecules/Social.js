import Icon from "../atoms/Icon";

const Social = ({ icon, href }) => (
  <a
    className="w-9 h-9 flex items-center justify-center text-muted hover:text-fg transition-colors"
    rel="me"
    href={href}
    target="_blank"
    aria-label={icon}
  >
    <Icon size={18} icon={icon} color="currentColor" />
  </a>
);

export default Social;
