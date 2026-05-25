const typeColors = {
  basic: { bg: "var(--color-type-basic)", text: "#0a0a0a" },
  javascript: { bg: "var(--color-type-javascript)", text: "#0a0a0a" },
  common: { bg: "var(--color-type-common)", text: "#fafafa" },
  react: { bg: "var(--color-type-react)", text: "#fafafa" },
  next: { bg: "var(--color-type-next)", text: "#fafafa" },
  lesson: { bg: "var(--color-type-lesson)", text: "#fafafa" },
};

const Lessons = ({ lessons }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1.5">
    {lessons.map(({ name, type }, index) => {
      const c = typeColors[type] || typeColors.lesson;
      return (
        <div
          key={index}
          className="flex items-baseline gap-2 px-3 py-2.5 text-[13px] truncate"
          style={{ backgroundColor: c.bg, color: c.text }}
          title={name}
        >
          <span className="opacity-60 font-mono text-[11px] shrink-0 w-5">
            {String(index).padStart(2, "0")}
          </span>
          <span className="truncate">{name}</span>
        </div>
      );
    })}
  </div>
);

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

const LessonsMap = ({ lessons, types }) => (
  <>
    {lessons && <Lessons lessons={lessons} />}
    {types && <Types types={types} />}
  </>
);

export default LessonsMap;
