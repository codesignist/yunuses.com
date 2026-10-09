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

Lint:

```bash
pnpm lint
```

Favicon ve manifest ikonlarını `public/avatar.png` dosyasından yeniden üretmek için:

```bash
pnpm favicons
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

Liste sayfası `/blog`, akışlar ise iki formatta yayınlanır: klasik RSS için `/feed.xml`, [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) için `/feed.json`. İkisi de `<head>` içinde `rel="alternate"` ile bağlıdır. Yazıların okuma süresi otomatik hesaplanır; yazı sayfasında üstte sticky bir [ReadingProgress](components/atoms/ReadingProgress.js) çubuğu ve altta [SharePost](components/atoms/SharePost.js) bileşeni yer alır.

## Tema

Site **koyu** ve **açık** olmak üzere iki temayı destekler. Tema sistem tercihini izler, tercih yoksa koyu açılır.

- Tema seçimi `<html>` üzerinde `data-theme="dark" | "light"` attribute'u ile yönetilir.
- Token'lar [styles/globals.css](styles/globals.css) içinde `@theme` ve `[data-theme="light"]` blokları altında tanımlıdır.
- Sağ üstteki [ThemeToggle](components/atoms/ThemeToggle.js) ile değiştirilir; tercih `localStorage` üzerinde `theme` anahtarında saklanır.
- İlk render'da flicker'ı önlemek için tercih [ThemeInit](components/atoms/ThemeInit.js) ile `<head>` içinde, hidrasyondan önce uygulanır.

## Klasör Yapısı

```
yunuses.com
├── app
│   ├── .well-known
│   │   └── api-catalog       # makine tarafından okunabilir uçların listesi
│   ├── api
│   │   └── markdown          # sayfaların markdown karşılığı (proxy.js buraya yönlendirir)
│   ├── blog                  # blog index + [slug] dinamik sayfa ve yazı OG görseli
│   ├── lab                   # deneyler: dragon, attractors, flow, 3d-ping-pong
│   ├── zero-to-hero          # mini ders sayfası (LessonsMap)
│   ├── feed.xml              # RSS 2.0 endpoint
│   ├── feed.json             # JSON Feed 1.1 endpoint
│   ├── opengraph-image.js    # dinamik OG görseli
│   ├── icon.png              # favicon (scripts/generate-favicons.mjs üretir)
│   ├── apple-icon.png
│   ├── not-found.js
│   ├── sitemap.js
│   ├── layout.js
│   └── page.js
├── components
│   ├── atoms                 # Icon, ThemeToggle, ThemeInit, ReadingProgress, SharePost, AvatarLightbox, CursorTrail, ...
│   ├── molecules             # Social, LabOptionBar
│   └── organisms             # ChromeControls, SiteFooter, SocialArea
├── content
│   └── posts                 # Markdown blog yazıları
├── data                      # lab.json, lessons.json, types.json
├── lib
│   ├── agentMarkdown.js      # sayfanın HTML'inden markdown üretir
│   ├── experiments.js        # lab.json'dan deney listesi
│   ├── feed.js               # RSS ve JSON Feed içeriği
│   ├── identity.js           # site adresi ve kişi bilgisi
│   ├── jsonLd.js             # yapısal veri (JSON-LD) helper'ları
│   ├── markdownNegotiation.js # isteğin markdown isteyip istemediğine karar verir
│   ├── metadata.js           # site adı, akış türleri, paylaşım görseli ve sayfa metadata yardımcısı
│   ├── posts.js              # Markdown okuma / parse helper'ları
│   └── useLabKeys.js         # deneylerin ortak klavye kısayolları
├── public                    # statik varlıklar (avatar, og-image, favicon, lab dosyaları, vs.)
├── scripts
│   └── generate-favicons.mjs # avatardan favicon ve manifest ikonlarını üretir
├── styles
│   └── globals.css           # Tailwind CSS 4 + tema token'ları
├── next.config.js            # güvenlik başlıkları ve yönlendirmeler
└── proxy.js                  # markdown isteyen ajanları api/markdown'a yönlendirir
```

## Kullanılan Araçlar

- **Next.js** (App Router): uygulama çatısı
- **Tailwind CSS 4**: stil sistemi, koyu/açık tema token'ları
- **Geist, Geist Mono ve Source Serif 4**: `next/font` ile yüklenen tipografi; serif, yazı başlıkları ve blog metni için
- **three.js**: Lab'daki Dragon ve Attractors deneyleri
- **Tabler Icons** (outline): ikonlar inline SVG olarak [components/atoms/icons.js](components/atoms/icons.js) registry'sinde tutulur
- **remark / remark-gfm / remark-rehype / rehype-raw / rehype-stringify**: Markdown → HTML pipeline'ı; yazının içine yazılan HTML de işlenir
- **rehype-parse / rehype-remark**: sayfaları ajanlar için markdown'a geri çevirir
- **gray-matter**: yazı frontmatter'ı

## Geliştirici

#### Yunus Eş

- [GitHub](https://github.com/codesignist)
- [LinkedIn](https://www.linkedin.com/in/codesignist)
- [YouTube](https://www.youtube.com/yunuses)
- [X](https://x.com/codesignist)
- [Instagram](https://www.instagram.com/codesignist)
- [NSosyal](https://nsosyal.com/codesignist)

## Lisans

Kaynak kod [MIT](LICENSE) lisanslıdır. `content/` ve `public/` klasörlerindeki yazılar, fotoğraflar ve görseller bu lisansa dahil değildir; tüm hakları saklıdır.
