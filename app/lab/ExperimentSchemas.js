import experiments from "data/lab.json";
import { SITE_URL } from "lib/identity";
import { jsonLd, breadcrumbList } from "lib/jsonLd";
import { experimentSchema } from "./experimentMetadata";

export default function ExperimentSchemas({ slug }) {
  const experiment = experiments.find((e) => e.slug === slug);
  if (!experiment) return null;
  const schemas = [
    experimentSchema(slug),
    breadcrumbList([
      { name: "Anasayfa", url: `${SITE_URL}/` },
      { name: "Lab", url: `${SITE_URL}/lab/` },
      { name: experiment.title, url: `${SITE_URL}/lab/${slug}/` },
    ]),
  ];
  return (
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(s) }}
        />
      ))}
    </>
  );
}
