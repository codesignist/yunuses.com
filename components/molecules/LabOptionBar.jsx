const KBD = "text-[10px] leading-none px-1 py-0.5 rounded border";

// Koyu sahnede cam, acik sahnede (Globe) beyaz tul; secili dugme acikta
// murekkep rengi bir dolgu.
const TONES = {
  dark: {
    bar: "bg-white/5 border-white/10 rounded backdrop-blur-sm",
    button: "rounded",
    active: "bg-white/20 text-white",
    idle: "text-white/65 hover:text-white hover:bg-white/10",
    kbd: "bg-white/10 border-white/15 text-white/60",
    kbdActive: "bg-white/10 border-white/15 text-white/60",
    hint: "border-white/10 text-white/60",
  },
  light: {
    bar: "bg-white/80 border-black/[0.07] rounded-lg backdrop-blur-md",
    button: "rounded-md",
    active: "bg-fg text-bg",
    idle: "text-muted hover:text-fg hover:bg-black/[0.04]",
    kbd: "bg-surface border-line text-faint",
    kbdActive: "bg-white/15 border-white/20 text-white/70",
    hint: "border-line text-faint",
  },
};

// Immersive deneylerin sol alt kosesindeki secenek cubugu. Her secenegin
// yaninda kisayol numarasi, sonda H ile gizleme ipucu. Klavye tarafi
// lib/useLabKeys'te; konumu cagiran taraf belirliyor.
//
// Dokunmatikte klavye ipuclari anlamsiz, gizleniyor. Dar pencerede ve
// %400 yakinlastirmada cubuk ekrandan tasmasin diye sariyor.
// Secili dugme ekran okuyucuya aria-pressed ile bildiriliyor; yuksek
// kontrast modunda arka plani sistem rengine donup kayboldugu icin
// orada bir cerceve aliyor.
export default function LabOptionBar({ options, active, onSelect, tone = "dark" }) {
  const t = TONES[tone];
  return (
    <div
      data-chrome
      className={`flex flex-wrap max-w-[calc(100vw-2rem)] gap-1 border p-1 text-[12px] ${t.bar}`}
    >
      {options.map(({ id, label }, i) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          onClick={() => onSelect(id)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 transition ${t.button} ${
            active === id ? `${t.active} forced-colors:outline-2 forced-colors:-outline-offset-2` : t.idle
          }`}
        >
          <kbd className={`${KBD} ${active === id ? t.kbdActive : t.kbd} pointer-coarse:hidden`}>{i + 1}</kbd>
          {label}
        </button>
      ))}
      <span className={`ml-1 pl-2 pr-1 border-l inline-flex items-center gap-1.5 pointer-coarse:hidden ${t.hint}`}>
        <kbd className={`${KBD} ${t.kbd}`}>H</kbd>
        gizle
      </span>
    </div>
  );
}
