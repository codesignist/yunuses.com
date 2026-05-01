---
title: 3D Ping Pong v3
date: 2026-05-01
summary: 2005'te Flash ile yaptığım 3D Ping Pong oyununu 20 yıl sonra Canvas üzerine yeniden yazdım. Bu yazı, oyunu oynanır kılan değil canlı hissettiren küçük detaylar üzerine.
tags: [lab, oyun, tasarım]
---

2005 yılında 3D Ping Pong oyununu Flash ile, en temel 3D engine mantığında vektörel çizimlerle hazırlamıştım. O yıllarda çok ilgi gördü ve görsellerini geliştirerek kısa sürede v2 sürümünü yayına aldım. Skor tablosu da vardı; epeyce kişi oynayıp eğlenmişti.

Aradan çok uzun zaman geçti. Eski sitemi AI ile minimalist halde yenileyip blog'u da açınca [Lab](/lab) sayfasını neden yeniden hayata geçirmeyeyim dedim. İlk aklıma gelen oyun 3D Ping Pong oldu. AI ile yeniden tasarlayınca hem klasik rakipli modu, hem de eski 3 hakla oynanan modu geliştirdim. Ortaya çok güzel detaylar çıktı. Geliştirdikçe "ripple etkisi neden olmasın", "skor tablosu sayıları digit şeklinde olsun" gibi pek çok küçük fikir aklıma geldi. Sesleri de wav/mp3 kullanmadan doğrudan kodla, saf osilatörlerden ürettim. Sonuç çok güzel oldu.

Aslında bu yazıyı yazma sebebim de bu — oyunun kendisi değil, ona "canlılık" hissi veren küçük detaylar.

## Mavi ben, kırmızı o

Tek karar, en görünür sonuç. Eski arcade'lerin sözsüz dili: rakip okunaklı olmalı. HUD, raketler, ripple halkaları, skor parlamaları, hatta ses tonları... Hepsi bu iki rengin etrafında dönüyor. Ne olursa olsun mavi her zaman ben oluyorum, kırmızı her zaman karşımdaki. Tek başına bu ayrım bile oyunu okunabilir kılıyor.

## 7-segment skor

HUD'a modern bir sayı fontu yerine bilerek eski hesap makinesi/scoreboard estetiği koydum. Her rakam, hexagonal segmentlerden çiziliyor; mavi ve kırmızı dijital ışımayla. Amaç "rakamı okumak" değil, "skoru görmek". Dijital sayacı görünce beyin bir şeyi başka türlü algılıyor modern bir font olsa, bu his kaybolurdu.

## Topu kaybetmemek için halka

3D projeksiyonda derinlik algısı zayıf. Ekrandaki bir nokta yakında mı uzakta mı, gözün anlaması zor. Onun için topun anlık derinliğine ince bir halka çiziyorum; top yaklaştıkça halka büyüyor, uzaklaştıkça küçülüyor. Bu olmadan topun z koordinatındaki derinliği algılanamıyordu.

## Çarpışmanın ağırlığı

Top duvara çarptığında iki şey oluyor: kamera bir an titriyor — yan duvarlarda yatay, ön/arka duvarda derinliksel — ve çarpma noktasından genişleyen halkalar yayılıyor. Halkalar duvar köşesine yakınsa "kırılıyormuş" gibi görünüyor; köşeden sekip yansıyan bir dalganın hissi. Detayların belki en çok yorulduğu kısım buydu, ama olmasaydı oyun çok daha "boş" hissedilirdi.

## Hit flash ve miss flash

Top rakete değdiğinde raket bir an parlıyor — mavi ya da kırmızı, kim vurduysa. Skor olduğunda tüm ekran o tarafın rengiyle 80 milisaniye parlıyor. Geri bildirim olmazsa dijital oyunlar duygusuz hissettiriyor; "bir şey oldu" sinyalini vermek lazım.

## Spawn ve iz

Top ekranda birden belirmiyor. Bir noktadan büyüyerek + halka açılarak doğuyor. Hızlıca giderken de geçtiği yerde sönen bir iz bırakıyor. İkisi de teknik olarak gereksiz; sadece göz takip edebilsin diye var.

## Müzik değil, ritim

Web Audio API ile saf osilatörden 0.05-0.2 saniyelik kısa pip'ler. Çarpma, skor, kayıp can, ateş — hepsi farklı tonlarda. Müzik yok, çünkü pong'a fon değil ritim lazım. Sessize alma butonu da var; herkes ofiste oynamak istemeyebilir.

## İki mod

- **Süre**: 90 saniye, klasik rakipli. En çok skoru toplayan kazanır.
- **Arena**: 3 hak, top kaçırma yok — onun yerine ateş et, AI'yı yavaşlat, hayatta kal.

İkincisi v2'den kalıntı. Tutamadım, geri getirdim — çünkü "klasik ama kişisel" oluyor.

---

Bunların hiçbiri yokken de oyun yine oynanabilir ama bu detaylar olduğunda ise ekran cana geliyor. Oynarken bunlardan birini fark edersen, niyetim tutmuş olur.

Oyunu [şuradan oynayıp](/lab/3d-ping-pong/) skorunuzu sosyal medyada paylaşabilirsiniz. İyi eğlenceler.
