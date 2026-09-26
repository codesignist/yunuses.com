const KBD =
  "text-[10px] leading-none px-1 py-0.5 rounded bg-white/10 border border-white/15";

// Immersive deneylerin sol alt kosesindeki secenek cubugu. Her secenegin
// yaninda kisayol numarasi, sonda H ile gizleme ipucu. Klavye tarafi
// lib/useLabKeys'te; konumu cagiran taraf belirliyor.
export default function LabOptionBar({ options, active, onSelect }) {
  return (
    <div
      data-chrome
      className="flex gap-1 bg-white/5 border border-white/10 rounded p-1 backdrop-blur-sm text-[12px]"
    >
      {options.map(({ id, label }, i) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition ${
            active === id
              ? "bg-white/20 text-white"
              : "text-white/65 hover:text-white hover:bg-white/10"
          }`}
        >
          <kbd className={`${KBD} text-white/60`}>{i + 1}</kbd>
          {label}
        </button>
      ))}
      <span className="ml-1 pl-2 pr-1 border-l border-white/10 inline-flex items-center gap-1.5 text-white/40">
        <kbd className={`${KBD} text-white/50`}>H</kbd>
        gizle
      </span>
    </div>
  );
}
