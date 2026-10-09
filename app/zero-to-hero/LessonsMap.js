// Yazı rengi her kutuda 4.5:1'i tutacak şekilde seçili; yeşil ve mavide
// beyaz yazı 3:1'in altında kalıyordu. Gri ve mor zeminler globals.css'te
// koyulaştırıldı.
const typeColors = {
  basic: { bg: "var(--color-type-basic)", text: "#0a0a0a" },
  javascript: { bg: "var(--color-type-javascript)", text: "#0a0a0a" },
  common: { bg: "var(--color-type-common)", text: "#0a0a0a" },
  react: { bg: "var(--color-type-react)", text: "#0a0a0a" },
  next: { bg: "var(--color-type-next)", text: "#fafafa" },
  lesson: { bg: "var(--color-type-lesson)", text: "#fafafa" },
};

// Kategori sadece kutu rengiyle anlatılıyordu; ekran okuyucu için türün adı
// da metin olarak yazılıyor.
const Lessons = ({ lessons, typeNames }) => (
  <ol className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1.5">
    {lessons.map(({ name, type }, index) => {
      const c = typeColors[type] || typeColors.lesson;
      return (
        <li
          key={index}
          className="flex items-baseline gap-2 px-3 py-2.5 text-meta truncate"
          style={{ backgroundColor: c.bg, color: c.text }}
          title={name}
        >
          <span className="font-mono text-label shrink-0 w-5">
            {String(index).padStart(2, "0")}
          </span>
          <span className="truncate">{name}</span>
          {typeNames[type] && (
            <span className="sr-only">, {typeNames[type]}</span>
          )}
        </li>
      );
    })}
  </ol>
);

const Types = ({ types }) => (
  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
    {types.map(({ name, type }, index) => (
      <div key={index} className="flex items-center gap-2.5">
        <span
          className="block w-3 h-3 shrink-0"
          style={{ backgroundColor: `var(--color-type-${type})` }}
        />
        <span className="text-label text-muted">{name}</span>
      </div>
    ))}
  </div>
);

const LessonsMap = ({ lessons, types }) => {
  const typeNames = Object.fromEntries(
    (types || []).map(({ type, name }) => [type, name]),
  );
  return (
    <>
      {lessons && <Lessons lessons={lessons} typeNames={typeNames} />}
      {types && <Types types={types} />}
    </>
  );
};

export default LessonsMap;
