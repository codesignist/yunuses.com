const Types = ({ types }) => (
  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
    {types.map(({ name, type }, index) => (
      <div key={index} className="flex items-center gap-2.5">
        <span
          className="block w-3 h-3 shrink-0"
          style={{ backgroundColor: `var(--color-type-${type})` }}
        />
        <span className="text-[12px] text-muted">{name}</span>
      </div>
    ))}
  </div>
);

export default Types;
