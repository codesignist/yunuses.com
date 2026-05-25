export const SITE_URL = "https://yunuses.com";

export const PERSON_ID = `${SITE_URL}/#yunus`;

export const PERSON = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Yunus Eş",
  alternateName: "codesignist",
  url: SITE_URL,
  image: `${SITE_URL}/avatar.webp`,
  jobTitle: "Kurucu",
  worksFor: {
    "@type": "Organization",
    name: "CodeCube Software",
    url: "https://codecube.com.tr",
  },
  sameAs: [
    "https://nsosyal.com/codesignist",
    "https://www.youtube.com/yunuses",
    "https://github.com/codesignist",
    "https://www.linkedin.com/in/codesignist/",
    "https://x.com/codesignist",
    "https://www.instagram.com/codesignist",
  ],
};
