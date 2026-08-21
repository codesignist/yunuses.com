import Image from "next/image";

export default function ExperimentCover({ src, sizes, className = "" }) {
  return (
    <div
      className={`relative w-full aspect-[2/1] overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="object-cover transition-[filter] duration-500 ease-out group-hover:brightness-115"
      />
    </div>
  );
}
