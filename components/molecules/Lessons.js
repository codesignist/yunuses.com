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

export default Lessons;
