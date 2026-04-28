import SocialArea from "components/organisms/SocialArea";
import Link from "next/link";

const stack = ["React", "Next.js", "Node.js", "MongoDB", "TypeScript"];


export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 max-md:py-12 max-md:px-5">
      <div className="w-full max-w-[560px] animate-fade-in-up">
        <img
          src="Avatar.png"
          width={88}
          height={88}
          alt="Yunus Eş"
          className="w-22 h-22 rounded-full object-cover"
          style={{ width: 88, height: 88 }}
        />

        <h1 className="mt-8 text-4xl font-medium tracking-tight text-fg max-md:text-3xl">
          Yunus Eş
        </h1>
        <p className="mt-2 text-base text-muted">
          Full Stack Developer · CodeCube Software Kurucusu
        </p>

        <div className="mt-10 space-y-5 text-[15px] leading-[1.7] text-muted">
          <p>
            25 yılı aşkın süredir yazılım dünyasının içerisindeyim. Bu süre boyunca
            100&apos;ün üzerinde irili ufaklı projede, kimi zaman tek başıma, kimi
            zaman da bir ekibin parçası olarak görev aldım. Kariyerimin ilk
            yıllarında uzun süre ActionScript / Flash teknolojileriyle çalıştım.
            2016 yılından bu yana ise React, Node.js ve MongoDB gibi modern web
            teknolojileri üzerine çalışıyorum.
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

        <div className="mt-10 flex flex-wrap gap-x-3 gap-y-2 text-[13px] text-faint">
          {stack.map((tech, i) => (
            <span key={tech} className="flex items-center gap-3">
              <span>{tech}</span>
              {i < stack.length - 1 && <span className="text-line">·</span>}
            </span>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-line">
          <SocialArea
            data={{
              next_sosyal: "https://sosyal.teknofest.app/@codesignist",
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
