import { getRegionData } from "lib/konut/data";
import { REGIONS } from "lib/konut/regions";

// Bolge verisi: endeks, tahmin ve bolgedeki illerin m2 serileri. Derlemede
// 19 bolge icin statik uretiliyor, sayfayla ayni aralikta yenileniyor.
export const revalidate = 43200;
export const dynamicParams = false;

export function generateStaticParams() {
  return REGIONS.map((r) => ({ bolge: r.id }));
}

export async function GET(_request, { params }) {
  const { bolge } = await params;
  const data = await getRegionData(bolge);
  if (!data) return Response.json({ error: "bolge yok" }, { status: 404 });
  return Response.json(data);
}
