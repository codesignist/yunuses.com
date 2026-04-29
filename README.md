# yunuses.com

[Yunus Eş](https://yunuses.com)'in kişisel web sitesi. Next.js (App Router) + Tailwind CSS 4 ile geliştirilmiştir.

## İçerik

- [Kurulum](#kurulum)
- [Geliştirme](#geliştirme)
- [Blog](#blog)
- [Tema](#tema)
- [Klasör Yapısı](#klasör-yapısı)
- [Kullanılan Araçlar](#kullanılan-araçlar)
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

## Blog

Yazılar `content/posts/` altında Markdown (`.md`) dosyaları olarak tutulur ve `gray-matter` ile frontmatter okunur. Her yazı build sırasında `remark` + `remark-gfm` ile HTML'e dönüştürülüp `app/blog/[slug]` üzerinden statik olarak sunulur.

Bir yazı için minimal frontmatter:

```markdown
---
title: "Yazı başlığı"
date: "2026-01-15"
summary: "Kısa özet."
---

Yazı içeriği...
```

Liste sayfası `/blog`, RSS akışı ise `/feed.xml` adresinden yayınlanır. Yazıların okuma süresi otomatik hesaplanır; yazı sayfasında üstte sticky bir [ReadingProgress](components/atoms/ReadingProgress.js) çubuğu ve altta [SharePost](components/atoms/SharePost.js) bileşeni yer alır.

## Tema

Site **koyu** ve **açık** olmak üzere iki temayı destekler. Varsayılan tema koyudur.

- Tema seçimi `<html>` üzerinde `data-theme="dark" | "light"` attribute'u ile yönetilir.
- Token'lar [styles/globals.css](styles/globals.css) içinde `@theme` ve `[data-theme="light"]` blokları altında tanımlıdır.
- Sağ üstteki [ThemeToggle](components/atoms/ThemeToggle.js) ile değiştirilir; tercih `localStorage` üzerinde `theme` anahtarında saklanır.
- İlk render'da flicker'ı önlemek için tercih [ThemeInit](components/atoms/ThemeInit.js) ile `<head>` içinde, hidrasyondan önce uygulanır.

## Klasör Yapısı

```
yunuses.com
├── app
│   ├── blog                  # blog index + [slug] dinamik sayfa
│   ├── zero-to-hero          # mini ders sayfası
│   ├── feed.xml              # RSS endpoint
│   ├── opengraph-image.js    # dinamik OG görseli
│   ├── sitemap.js
│   ├── layout.js
│   └── page.js
├── components
│   ├── atoms                 # Icon, ThemeToggle, ThemeInit, ReadingProgress, SharePost, AvatarLightbox, ...
│   ├── molecules             # Social, Lessons, Types
│   └── organisms             # SocialArea, LessonsMap
├── content
│   └── posts                 # Markdown blog yazıları
├── data                      # lessons.json, types.json
├── lib
│   └── posts.js              # Markdown okuma / parse helper'ları
├── public                    # statik varlıklar (Avatar, og-image, favicon, vs.)
└── styles
    └── globals.css           # Tailwind CSS 4 + tema token'ları
```

## Kullanılan Araçlar

- **Next.js** (App Router) — uygulama çatısı
- **Tailwind CSS 4** — stil sistemi, koyu/açık tema token'ları
- **Geist & Geist Mono** — `next/font` ile yüklenen tipografi
- **Tabler Icons** (outline) — ikonlar inline SVG olarak [components/atoms/icons.js](components/atoms/icons.js) registry'sinde tutulur
- **remark / remark-gfm / remark-rehype / rehype-stringify** — Markdown → HTML pipeline'ı
- **gray-matter** — yazı frontmatter'ı

## Geliştirici

#### Yunus Eş

- [GitHub](https://github.com/codesignist)
- [LinkedIn](https://www.linkedin.com/in/codesignist)
- [YouTube](https://www.youtube.com/yunuses)
- [X / Twitter](https://twitter.com/codesignist)
- [Instagram](https://www.instagram.com/codesignist)
- [NSosyal](https://nsosyal.com/codesignist)

## Lisans

[MIT](https://opensource.org/licenses/MIT)
