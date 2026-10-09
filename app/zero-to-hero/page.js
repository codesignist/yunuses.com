import Icon from "components/atoms/Icon";
import BackLink from "components/atoms/BackLink";
import LessonsMap from "./LessonsMap";
import lessons from "data/lessons.json";
import types from "data/types.json";
import { PERSON, SITE_URL } from "lib/identity";
import { jsonLd } from "lib/jsonLd";
import { pageMetadata } from "lib/metadata";

const description =
  "Sıfırdan FrontEnd Developer'lığa: 1 Ağustos 2022'de başlayıp tamamlanan ücretsiz uygulamalı eğitim programı.";

export const metadata = pageMetadata({
  title: "Zero to Hero",
  description,
  path: "/zero-to-hero/",
});

const H2 = ({ children }) => (
  <h2 className="mt-16 mb-6 text-xl font-medium tracking-tight text-fg">
    {children}
  </h2>
);

const technologies = [
  "HTML",
  "CSS",
  "JavaScript",
  "React",
  "Next.js",
  "git",
  "npm",
  "CLI",
  "Node.js",
  "ESLint",
  "Prettier",
  "Responsive",
  "Testing",
  "SVG",
  "JSON",
  "XML",
  "lodash",
  "VS Code",
  "Styled Components",
  "Mantine",
  "Ant Design",
];

const courseSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "Zero to Hero: FrontEnd Developer",
  description,
  url: `${SITE_URL}/zero-to-hero/`,
  inLanguage: "tr-TR",
  isAccessibleForFree: true,
  educationalLevel: "Beginner",
  provider: PERSON,
  teaches: technologies.map((t) => t.replace(/\s*\(.*?\)\s*/g, "").trim()),
  hasCourseInstance: {
    "@type": "CourseInstance",
    courseMode: "Online",
    startDate: "2022-08-01",
    location: {
      "@type": "VirtualLocation",
      url: "https://www.youtube.com/yunuses",
    },
  },
};

const achievements = [
  "Temel yazılım bilgisi",
  "Kendi kendine öğrenme becerisi",
  "Araştırma becerisi",
  "Problem çözme becerisi",
  "Dokümantasyon okuma becerisi",
  "Teknoloji okuryazarlığı",
  "Diğer yazılım dillerinin önünün açılması",
];

const faq = [
  { q: "Eğitim ücretli miydi?", a: "Hayır, eğitim baştan sona ücretsiz olarak işlendi." },
  { q: "Ne zaman başladı, ne zaman bitti?", a: "1 Ağustos 2022'de başladı; tüm dersler tamamlandı." },
  {
    q: "Haftada kaç gün ders işlendi?",
    a: "Pazartesi - Perşembe saat 22:00 olmak üzere haftada 2 gün ders işlendi.",
  },
  {
    q: "Canlı yayın kayıtları hâlâ izlenebiliyor mu?",
    a: "Evet. Bazı Next.js dersleri dışında tüm dersler YouTube kanalında kayıtlı; istediğin zaman izleyebilirsin.",
  },
  { q: "Eğitim hangi programlama dili üzerinden işlendi?", a: "JavaScript" },
  {
    q: "Eğitim sonrası iş garantisi var mıydı?",
    a: "İş garantisi verilmedi; ancak katılımcılar arasında sektöre adım atanlar oldu.",
  },
  { q: "Eğitim sonrası sertifika verildi mi?", a: "Hayır, sertifika verilmedi." },
];

export default function ZeroToHero() {
  return (
    <main id="main" className="flex-1 page-shell animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(courseSchema) }}
      />
      <div className="mx-auto max-w-reading">
        <BackLink href="/">Anasayfa</BackLink>

        <div className="mt-12">
          <div className="eyebrow">Zero to Hero</div>
          <h1 className="mt-1 text-6xl font-semibold tracking-tight text-fg leading-[1.05] max-md:text-5xl max-[425px]:text-[14vw]">
            FrontEnd
            <br />
            Developer
          </h1>
          <div className="mt-4 flex items-center gap-3 text-meta text-muted">
            <span className="inline-flex items-center gap-1.5 text-fg">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-type-common)]" />
              Tamamlandı
            </span>
            <span className="text-line">·</span>
            <span>1 Ağustos 2022</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-wide mt-20">
        <div className="eyebrow mb-5 px-1">Ders Haritası</div>
        <LessonsMap lessons={lessons} types={types} />
      </div>

      <div className="mx-auto max-w-reading">
        <H2>Tanıtım</H2>
        <div className="space-y-5 text-body text-muted">
          <p>
            En temel bilgisayar kullanımından başlayıp gelişmiş web sistemleri
            yapacak seviyeye uygulamalı olarak birlikte çıktık. HTML, CSS, JS
            konularını ödevlerle en uygun hızda temellendirip, Next.js,
            React, npm gibi teknolojileri kullanarak modern
            JavaScript dünyasına geçiş yaptık. Sıfırdan başlayan seçili birkaç
            öğrenciyle ekran paylaşımı da yaparak sınıf ortamını canlı yayında
            izleyicilerle buluşturduk. Ayrıca teorik konuları hızla geçip,
            gerçek web uygulamalarını açık kaynak kodlu olarak birlikte yaptık.
            Böylelikle sadece anlatımdan ibaret olan video eğitimlerden çok
            daha farklı, dinamik, eğlenceli ve sonuç alan bir eğitim modeliyle
            katılımcılara yeni bir ufuk açtık, hobi veya meslek kazandırdık.
          </p>
          <p>
            1 Ağustos 2022 Pazartesi başladık ve programı eksiksiz tamamladık.
            <br />
            Bazı Next.js dersleri dışında tüm kayıtlar YouTube kanalında.
          </p>
        </div>

        <H2>Giriş</H2>
        <div className="space-y-5 text-body text-muted">
          <p>
            Hızla gelişen dünyada yazılımcı ihtiyacı her geçen gün artıyordu.
            Şirketler iyi yetişmiş eleman bulamamaktan şikayetçiyken; çalışanlar
            ya da yeni bir işe girecek olanlar da şirketlerin yüksek
            beklentilerinden şikayetçiydi. Bu durum sonsuz bir döngüye dönüşerek
            insanları mutsuzluğa ve karamsarlığa itiyordu.
          </p>
          <p>
            O dönemde pek çok YouTube ve Udemy eğitimi mevcuttu; ancak asıl
            öğrenme yöntemi olan katılımcının kendi çabası ve uygulamasıyla
            öğrenmesi konusunda pek az program vardı.{" "}
            <span className="text-fg">Zero to Hero FrontEnd Developer</span>{" "}
            programı, işte bu eksiği tamamlamak üzere hazırlandı ve
            tamamlandı.
          </p>
        </div>

        <H2>Amaç</H2>
        <p className="text-body text-muted">
          Temel bilgisayar kullanım bilgisi olan bir katılımcıyı önce FrontEnd
          dünyasına katıp; sonrasında oyun geliştirici, mobil geliştirici,
          gömülü sistem geliştirici gibi alanlara yönlendirerek yazılım
          dünyasına giriş yapmasını sağlamaktı.
        </p>

        <H2>Eğitim Hakkında</H2>
        <div className="space-y-5 text-body text-muted">
          <p>
            Dersler önceden belirlenmiş öğrencilere uygulamalı anlatımla
            işlendi; YouTube canlı yayını üzerinden de diğer katılımcıların
            izlemesi ve yorumlarla derse katılması sağlandı. Bazı Next.js
            dersleri dışında tüm dersler kayıtlı; aşağıdaki kanal üzerinden
            istediğin zaman izleyebilirsin.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-line text-meta text-fg hover:border-faint transition-colors"
            href="https://www.youtube.com/yunuses"
            target="_blank"
          >
            <Icon icon="youtube" size={14} color="currentColor" />
            <span>youtube.com/yunuses</span>
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-line text-meta text-fg hover:border-faint transition-colors"
            href="https://discord.gg/N72tKgSVV3"
            target="_blank"
          >
            <Icon icon="discord" size={14} color="currentColor" />
            <span>discord.com</span>
          </a>
        </div>
        <div className="mt-6 space-y-5 text-body text-muted">
          <p>
            Dersler 1 Ağustos 2022&apos;de başladı; Pazartesi - Perşembe saat{" "}
            <span className="text-fg">22:00</span>&apos;de düzenli olarak
            işlendi.
          </p>
          <p>
            Ödev ağırlıklı bir programdı; bu nedenle katılımcılara yoğun
            görevler düştü. Topluluk Discord üzerinden organize oldu ve
            katılımcılar süreç boyunca birbirleriyle aktif iletişim kurdular.
          </p>
        </div>

        <H2>Teknolojiler</H2>
        <p className="text-body text-muted">
          Eğitim boyunca işlenen konular, teknolojiler ve npm paketlerinin bir
          kısmı:
        </p>
        <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2 text-meta text-muted">
          {technologies.map((item, i) => (
            <span key={item} className="flex items-center gap-3">
              <span>{item}</span>
              {i < technologies.length - 1 && (
                <span className="text-line">·</span>
              )}
            </span>
          ))}
        </div>

        <H2>Kazanımlar</H2>
        <p className="text-body text-muted">
          Programı tamamlayan katılımcıların elde ettiği kazanımlar:
        </p>
        <ul className="mt-5 list-none p-0">
          {achievements.map((achieve, i) => (
            <li
              key={achieve}
              className="flex items-baseline gap-4 py-3 border-t border-line last:border-b text-ui"
            >
              <span className="text-faint font-mono text-label w-6 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-fg">{achieve}</span>
            </li>
          ))}
        </ul>

        <H2>Sık Sorulan Sorular</H2>
        <div className="flex flex-col">
          {faq.map(({ q, a }, index) => (
            <details
              key={index}
              className="group border-t border-line last:border-b"
            >
              <summary className="cursor-pointer py-4 flex items-center justify-between gap-4 select-none list-none [&::-webkit-details-marker]:hidden">
                <span className="text-ui text-fg">{q}</span>
                <span className="text-faint text-lg leading-none transition-transform duration-200 group-open:rotate-45 shrink-0">
                  +
                </span>
              </summary>
              <div className="pb-4 pr-8 text-ui text-muted">
                {a}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-20" />
      </div>
    </main>
  );
}
