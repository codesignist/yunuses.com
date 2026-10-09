const KBD =
  "text-[10px] leading-none px-1 py-0.5 rounded bg-white/10 border border-white/15";

// Immersive deneylerin sol alt kosesindeki secenek cubugu. Her secenegin
// yaninda kisayol numarasi, sonda H ile gizleme ipucu. Klavye tarafi
// lib/useLabKeys'te; konumu cagiran taraf belirliyor.
//
// Dokunmatikte klavye ipuclari anlamsiz, gizleniyor. Dar pencerede ve
// %400 yakinlastirmada cubuk ekrandan tasmasin diye sariyor.
// Secili dugme ekran okuyucuya aria-pressed ile bildiriliyor; yuksek
// kontrast modunda arka plani sistem rengine donup kayboldugu icin
// orada bir cerceve aliyor.
export default function LabOptionBar({ options, active, onSelect }) {
  return (
    <div
      data-chrome
      className="flex flex-wrap max-w-[calc(100vw-2rem)] gap-1 bg-white/5 border border-white/10 rounded p-1 backdrop-blur-sm text-[12px]"
    >
      {options.map(({ id, label }, i) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          onClick={() => onSelect(id)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition ${
            active === id
              ? "bg-white/20 text-white forced-colors:outline-2 forced-colors:-outline-offset-2"
              : "text-white/65 hover:text-white hover:bg-white/10"
          }`}
        >
          <kbd className={`${KBD} text-white/60 pointer-coarse:hidden`}>{i + 1}</kbd>
          {label}
        </button>
      ))}
      <span className="ml-1 pl-2 pr-1 border-l border-white/10 inline-flex items-center gap-1.5 text-white/60 pointer-coarse:hidden">
        <kbd className={`${KBD} text-white/60`}>H</kbd>
        gizle
      </span>
    </div>
  );
}
