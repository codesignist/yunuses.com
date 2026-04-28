# yunuses.com

[Yunus Eş](https://yunuses.com)'in kişisel web sitesi. Next.js (Pages Router) + Tailwind CSS 4 ile geliştirilmiştir.

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
├── components
│   ├── atoms        # Icon, LinkButton
│   ├── molecules    # Social, Lessons, Types
│   └── organisms    # SocialArea, LessonsMap
├── data             # lessons.json, types.json
├── pages            # _app.js, index.js, zero-to-hero.js
├── public           # statik varlıklar (Avatar, og-image, favicon, vs.)
├── styles
│   └── globals.css  # Tailwind CSS 4 + tema token'ları
└── utils            # icomoon selection.json
```

## Kullanılan Araçlar

- **Next.js** — uygulama çatısı (Pages Router)
- **Tailwind CSS 4** — stil sistemi
- **Geist & Geist Mono** — tipografi
- **icomoon-react** — ikon seti

## Geliştirici

#### Yunus Eş

- [GitHub](https://github.com/codesignist)
- [LinkedIn](https://www.linkedin.com/in/codesignist)

## Lisans

[MIT](https://opensource.org/licenses/MIT)
