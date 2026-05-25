import experiments from "data/lab.json";
import { PERSON, SITE_URL } from "lib/identity";

export function experimentMetadata(slug) {
  const experiment = experiments.find((e) => e.slug === slug);
  if (!experiment) return {};
  const { title, description } = experiment;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `/lab/${slug}/`,
    },
  };
}

export function experimentSchema(slug) {
  const experiment = experiments.find((e) => e.slug === slug);
  if (!experiment) return null;
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: experiment.title,
    description: experiment.description,
    url: `${SITE_URL}/lab/${slug}/`,
    inLanguage: "tr-TR",
    author: PERSON,
    dateCreated: experiment.date,
    genre: experiment.tag,
  };
}
