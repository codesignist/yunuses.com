import CursorTrailLoader from "components/atoms/CursorTrailLoader";
import SocialArea from "components/organisms/SocialArea";
import Image from "next/image";
import Link from "next/link";

const stack = ["React", "Next.js", "Node.js", "MongoDB", "TypeScript"];

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 max-md:py-12 max-md:px-5">
      <CursorTrailLoader />
      <div className="w-full max-w-[560px]">
        <div className="flex items-center gap-6 max-md:flex-col max-md:items-start max-md:gap-0">
          <a
            href="#"
            aria-label="Yunus Eş avatarı"
            className="rounded-full shrink-0 inline-block animate-fade-in-up"
          >
            <Image
              src="/Avatar.png"
              width={88}
              height={88}
              alt="Yunus Eş"
              priority
              className="rounded-full object-cover block"
              style={{ width: "auto", height: "auto" }}
            />
          </a>

          <div
            className="max-md:mt-8 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <h1 className="text-4xl font-medium tracking-tight leading-tight text-fg max-md:text-3xl">
              Yunus Eş
            </h1>
            <p className="text-base text-muted">Kurucu, CodeCube</p>
          </div>
        </div>

        <div
          className="mt-10 space-y-5 text-[15px] leading-[1.7] text-muted animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <p>
            25 yılı aşkın süredir yazılım dünyasının içerisindeyim. Bu süre
            boyunca 100&apos;ün üzerinde irili ufaklı projede, kimi zaman tek
            başıma, kimi zaman da bir ekibin parçası olarak görev aldım.
            Kariyerimin ilk yıllarında uzun süre ActionScript / Flash
            teknolojileriyle çalıştım. 2016 yılından bu yana ise React, Node.js
            ve MongoDB gibi modern web teknolojileri üzerine çalışıyorum.
          </p>
          <p>
            2024 yılının son çeyreğinde, edindiğim birikimi müşterilerimize daha
            iyi sunabilmek için{" "}
            <Link
              href="https://codecube.com.tr"
              target="_blank"
              className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg transition-colors"
            >
              CodeCube Software
            </Link>
            &apos;i kurdum.
          </p>
        </div>

        <div
          className="mt-10 flex flex-wrap gap-x-3 gap-y-2 text-[13px] text-faint animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          {stack.map((tech, i) => (
            <span key={tech} className="flex items-center gap-3">
              <span>{tech}</span>
              {i < stack.length - 1 && <span className="text-line">·</span>}
            </span>
          ))}
        </div>

        <div
          className="mt-12 pt-8 border-t border-line animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <SocialArea
            data={{
              next_sosyal: "https://nsosyal.com/codesignist",
              youtube: "https://www.youtube.com/yunuses",
              github: "https://github.com/codesignist",
              linkedin: "https://www.linkedin.com/in/codesignist/",
              twitter: "https://twitter.com/codesignist",
              instagram: "https://www.instagram.com/codesignist",
            }}
          />
        </div>
      </div>
    </main>
  );
}
