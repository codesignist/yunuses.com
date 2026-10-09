import experiments from "data/lab.json";
import { PERSON, SITE_URL } from "lib/identity";
import { pageMetadata } from "lib/metadata";

export function experimentMetadata(slug) {
  const experiment = experiments.find((e) => e.slug === slug);
  if (!experiment) return {};
  const { title, description, shareImage } = experiment;
  // Paylasim gorseli kapagin JPG kopyasi: WebP'yi her platform onizlemede
  // gostermiyor. Kapaklar 1600x800. Kopyasi olmayan deney sitenin genel
  // gorseline duser.
  const image = shareImage
    ? {
        url: shareImage,
        width: 1600,
        height: 800,
        type: "image/jpeg",
        alt: title,
      }
    : undefined;
  return pageMetadata({ title, description, path: `/lab/${slug}/`, image });
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
    image: experiment.cover ? `${SITE_URL}${experiment.cover}` : undefined,
    inLanguage: "tr-TR",
    author: PERSON,
    dateCreated: experiment.date,
    genre: experiment.tag,
  };
}
