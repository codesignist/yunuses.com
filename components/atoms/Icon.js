import icons from "./icons";

const Icon = ({ icon, size = 18, color, className = "" }) => {
  const Component = icons[icon];
  if (!Component) return null;
  return (
    <Component
      width={size}
      height={size}
      className={className}
      style={color ? { color } : undefined}
    />
  );
};

export default Icon;
