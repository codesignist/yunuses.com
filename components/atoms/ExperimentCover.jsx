import Image from "next/image";

// eager: ilk ekranin en buyuk gorseli olan kapak icin. Varsayilan lazy'de
// tarayici istegi ancak CSS ve yerlesimden sonra baslatiyor.
export default function ExperimentCover({
  src,
  sizes,
  eager = false,
  className = "",
}) {
  return (
    <div
      className={`relative w-full aspect-[2/1] overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        className="object-cover transition-[filter] duration-500 ease-out group-hover:brightness-115"
      />
    </div>
  );
}
