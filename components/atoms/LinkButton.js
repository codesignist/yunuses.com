import Link from "next/link";
import Icon from "./Icon";

const LinkButton = ({ icon, href, target, children }) => (
  <Link
    className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-fg transition-colors"
    href={href}
    target={target}
  >
    {icon && <Icon size={11} icon={icon} color="currentColor" />}
    <span>{children}</span>
  </Link>
);

export default LinkButton;
