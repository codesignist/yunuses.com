import experiments from "data/lab.json";

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
  };
}
