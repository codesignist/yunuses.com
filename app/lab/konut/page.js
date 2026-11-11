import BackLink from "components/atoms/BackLink";
import { SITE_URL } from "lib/identity";
import { breadcrumbList, jsonLd } from "lib/jsonLd";
import { getPageData } from "lib/konut/data";
import { experimentMetadata, experimentSchema } from "../experimentMetadata";
import Konut from "./Konut";

export const metadata = experimentMetadata("konut");

// Sayfa statik uretiliyor, 12 saatte bir arka planda TCMB'den yenileniyor.
// TCMB ayda bir veri yayimladigi icin daha sik sormanin anlami yok.
export const revalidate = 43200;

const schemas = [
  experimentSchema("konut"),
  breadcrumbList([
    { name: "Anasayfa", url: `${SITE_URL}/` },
    { name: "Lab", url: `${SITE_URL}/lab/` },
    { name: "Konut Fiyatları", url: `${SITE_URL}/lab/konut/` },
  ]),
];

export default async function KonutPage() {
  const data = await getPageData();
  return (
    <main id="main" className="flex-1 page-shell">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(s) }} />
      ))}
      <div className="mx-auto w-full max-w-wide">
        <header className="mb-12 max-w-reading animate-fade-in-up max-md:mb-10">
          <BackLink href="/lab">Lab</BackLink>
          <h1 className="mt-6 text-4xl font-medium leading-tight tracking-tight text-fg max-md:text-3xl">
            Konut Fiyatları
          </h1>
          <p className="mt-3 text-body text-muted">
            TCMB&apos;nin Konut Fiyat Endeksi, enflasyonla karşılaştırması ve önümüzdeki 24 ayın tahmini. Altta,
            bugün almakla beklemek arasındaki farkı kendi rakamlarınla hesaplayabilirsin. Yatırım tavsiyesi değil,
            karar verirken bakılacak bir gösterge seti.
          </p>
        </header>
        <Konut data={data} />
      </div>
    </main>
  );
}
