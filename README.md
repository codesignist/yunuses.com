# yunuses.com

[Yunus Eş](https://yunuses.com)'in kişisel web sitesi. Next.js (App Router) + Tailwind CSS 4 ile geliştirilmiştir.

## İçerik

- [Kurulum](#kurulum)
- [Geliştirme](#geliştirme)
- [Klasör Yapısı](#klasör-yapısı)
- [Geliştirici](#geliştirici)
- [Lisans](#lisans)

## Kurulum

```bash
pnpm install
```

## Geliştirme

Geliştirme sunucusunu çalıştırmak için:

```bash
pnpm dev
```

Production build:

```bash
pnpm build && pnpm start
```

## Klasör Yapısı

```
yunuses.com
├── app              # layout.js, page.js, zero-to-hero/page.js
├── components
│   ├── atoms        # Icon, icons (registry), LinkButton
│   ├── molecules    # Social, Lessons, Types
│   └── organisms    # SocialArea, LessonsMap
├── data             # lessons.json, types.json
├── public           # statik varlıklar (Avatar, og-image, favicon, vs.)
└── styles
    └── globals.css  # Tailwind CSS 4 + tema token'ları
```

## Kullanılan Araçlar

- **Next.js** — uygulama çatısı (App Router)
- **Tailwind CSS 4** — stil sistemi
- **Geist & Geist Mono** — tipografi
- **Tabler Icons** (outline) — ikonlar inline SVG olarak `components/atoms/icons.js` registry'sinde tutulur

## Geliştirici

#### Yunus Eş

- [GitHub](https://github.com/codesignist)
- [LinkedIn](https://www.linkedin.com/in/codesignist)

## Lisans

[MIT](https://opensource.org/licenses/MIT)
