---
title: YouCam v2 Yayında
date: 2026-10-12
summary: Kayıt yaparken kendinizi görmeniz için yazdığım küçük webcam uygulaması YouCam'in ikinci sürümü çıktı. Claude Opus 5.5 ile baştan yazılan v2, 436 MB'tan 5 MB'a inen boyutun yanında arka plan bulanıklaştırma, ekran ışığı, çerçeve ve oyunun ortasında tek kısayolla gizleme gibi yeniliklerle geliyor.
tags: [ürün, açık kaynak, yapay zeka]
cover: /blog/youcam-v2-yayinda/cover.jpg
---

2020'nin sonlarında OBS ile kayıt yaparken basit ama can sıkıcı bir sorunla karşılaştım: OBS kameranızı kaydediyor ama kayıt sırasında size göstermiyor. Kadrajda mıyım, yüzüm ışık alıyor mu, kayıt bitene kadar bilemiyorsunuz. Bunun için ya ikinci bir monitör ya da ayrı bir program gerekiyor. Küçük ve pratik bir program aradım, bulamadım. Ben de bir pazar günü oturup kendim yazdım.

Adı **YouCam** oldu. Ekranın köşesinde, bütün pencerelerin üstünde duran, daire şeklinde minik bir kamera penceresi. Kayıt yaparken kendinizi görüyorsunuz, o kadar.

![2020'de YouCam'in ilk hali, sağ altta daire içinde ben](/blog/youcam-v2-yayinda/youcam-2020.jpg)

Zamanla ayna, altıgen şekil ve hazır ölçüler geldi. Proje GitHub'da 35 yıldız topladı, katkı verenler de oldu. Ama bir konu hep içimde dert olarak kaldı: boyutu.

## 436 MB'lık minik uygulama

YouCam'in ilk sürümleri NW.js ile yapılmıştı. NW.js her uygulamanın içine koca bir tarayıcı gömüyor. Sonuç olarak ekranın köşesinde duran küçücük bir kamera penceresi için yüzlerce MB indirmeniz gerekiyordu. 2022'de bunun için kendime GitHub'da bir issue açmıştım: "Mini bir uygulama olmasına rağmen boyutu çok büyük, düşürülebilir mi?" O issue tam dört yıl açık kaldı.

## Bu sefer yapay zeka ile

İlk sürümü 2020'de el yordamıyla yazmıştım. v2 ise baştan sona bir yapay zeka ürünü; bütün yenilemeyi Claude Opus 5.5 ile yaptım. Dört yıl açık kalan o issue tek bir günde kapandı. v1.2, v2.0 ve v2.1 sürümleri de bir günden kısa sürede art arda çıktı.

Uygulama bu sefer [Tauri](https://tauri.app/) ile baştan yazıldı. Tauri kendi tarayıcısını taşımak yerine Windows'ta zaten kurulu olanı kullanıyor. İndirme boyutlarına bakınca fark ortada:

| Sürüm | Yıl | İndirme boyutu |
|---|---|---:|
| v1.0.10 | 2022 | 436 MB |
| v1.1.3 | 2023 | 203 MB |
| v1.2.0 | 2026 | 173,5 MB |
| **v2.1.0** | **2026** | **5,1 MB** |

İlk sürüme göre 85 kat daha küçük. Kurulu hali de yüzlerce dosyadan oluşan 550 MB'lık bir klasörden tek bir 9,5 MB'lık exe'ye indi. Üstüne bellek kullanımı da yüzde 15-20 azaldı.

## Neler yeni?

Boyut tek başına güzel bir haber ama asıl keyifli kısım yeni özellikler. 2023'teki v1.1.3'ten bu yana neler geldiğine bakalım.

### Odanız görünmesin

Arka planı tek tuşla (`B`) bulanıklaştırabiliyorsunuz. İki seçenek var: bulanık ve koyu bulanık. Koyu olanı arka planı biraz da karartıyor, böylece siz öne çıkıyorsunuz. Görüntü tamamen bilgisayarınızda işleniyor, hiçbir yere gönderilmiyor.

### İkinci monitör ışık olsun

Ekran ışığı (`L`), yüzünüzü monitörle aydınlatmak için düz renkli bir pencere açıyor. İkinci monitörde tam ekran yaptığınızda küçük bir ışık paneline dönüşüyor. Beyazın dört tonu var, 6500K'den 3200K'ye kadar; odadaki ışığa en yakın olanı seçiyorsunuz. Yandan ya da arkadan renkli ışık isteyenler için kırmızı, pembe, mor, mavi ve camgöbeği var. Bunlar da yetmezse istediğiniz rengi seçebiliyorsunuz.

### Yayıncı çerçevesi

Yayınlarda kameranın etrafında sık gördüğümüz renkli çerçeve artık YouCam'de de var. İstediğiniz renkte ve kalınlıkta, şekli de takip ediyor; altıgende bile. Yanında parlaklık, kontrast ve siyah beyaz ayarları da geldi.

### Oyunun ortasında tek kısayol

`Ctrl+Shift+Y` ile YouCam'i her yerden gizleyip gösterebiliyorsunuz. Oyun açıkken bile, oyundan odağı almadan. Gizliyken kamera tamamen kapanıyor, yani bilgisayarı da yormuyor. Kısayolu ayarlardan değiştirebilir ya da tamamen kapatabilirsiniz.

### Bir şey ters giderse

Eskiden kamera açılamazsa "ERROR" yazan bir uyarı kutusu çıkıyordu, ne olduğunu anlamak size kalıyordu. Artık YouCam nedenini kendi penceresinde söylüyor: kamera başka bir uygulamada mı, izin mi yok, kablo mu çıktı. Kamera geri geldiğinde de kendiliğinden bağlanıyor. Kamerayı OBS kullanıyorsa OBS'in sanal kamerasını öneriyor.

### Ayarlar tek pencerede

Sağ tık menüsü epey kalabalıklaşmıştı. Sık kullanılanlar menüde kaldı, gerisi yeni ayarlar penceresine taşındı (`S`). Pencere kameranın hemen yanında açılıyor, her değişikliği yaparken görüyorsunuz. Windows'un açık ya da koyu temasına da uyuyor.

### Ve diğerleri

- 480p, 720p ve 1080p görüntü kalitesi. Eskiden kamera hep 640x480 açılıyordu.
- Fare tekerleğiyle büyütüp küçültme.
- Kamerayı, ayarları ve pencerenin yerini hatırlama.
- Türkçe arayüz. Windows'un dilini izliyor, ayarlardan da seçilebiliyor. Bir sonraki sürümle birlikte geliyor.

## İndirin

YouCam Windows 10 ve 11'de çalışıyor. [Son sürümü GitHub'dan](https://github.com/codesignist/YouCam/releases/latest) indirebilirsiniz. İki seçenek var:

- **Kurulum programı** (`setup.exe` ile biten dosya): Başlat menüsüne kısayol ekliyor, istediğinizde kolayca kaldırabiliyorsunuz.
- **Portable** (`portable.zip` ile biten dosya): Kurulum yok. Zip'i açıp `youcam.exe`'yi çalıştırmanız yeterli.

Uygulama kod imzalı olmadığı için ilk açılışta Windows SmartScreen uyarı verebilir. "Ek bilgi" ve ardından "Yine de çalıştır" diyerek açabilirsiniz.

Açtıktan sonra kamerayı sürükleyerek istediğiniz yere taşıyın, tekerlekle boyutunu ayarlayın. Gerisi sağ tıkta.

## Açık kaynak

YouCam baştan beri açık kaynak ve ISC lisanslı. Kodlara [GitHub](https://github.com/codesignist/YouCam) üzerinden ulaşabilirsiniz. Görmek istediğiniz bir özellik varsa issue açabilir ya da pull request gönderebilirsiniz. Beğendiyseniz bir yıldız bırakmayı da unutmayın. :)

---

Altı yıl önce kendi ihtiyacım için bir pazar günü el yordamıyla yazdığım bu küçük uygulama, Opus 5.5 ile sonunda olması gerektiği kadar küçük ve beklediğimden çok daha yetenekli oldu. Kayıtlarınızda işinize yaraması dileğiyle.

İyi yayınlar.
