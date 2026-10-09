---
title: AI Yarışında Ters C
date: 2026-09-26
summary: ARC Prize verilerini model aileleri üzerinden yeniden çizdim. Uzun süre "daha iyi ama daha pahalı" yönünde ilerleyen eğri, Opus 5.5 ve GPT-6 Astra ile birlikte sola doğru bükülmeye başladı.
tags: [yapay zeka, veri]
cover: /blog/ai-yarisinda-ters-c/cover.jpg
---

Bir süredir yapay zeka modellerinin başarı/maliyet grafiklerini ve yayınlanan raporları takip ediyorum. Grafikler uzun süre hep aynı hikayeyi anlattı: yeni model daha iyi sonuç veriyor ama daha pahalıya. Bu da çizginin sağa ve yukarı doğru tırmanması demek. Bir noktada ucuzlamanın da gelmesi, çizginin sola doğru bükülmesi gerekir diye tahmin ediyordum. Opus 5.5 ve GPT-6 Astra'nın yayınlanmasıyla birlikte bu gerçekleşmiş oldu. Artık grafikte bir **ters C** formu görmeye başladık.

## ARC Prize neyi ölçüyor?

[ARC Prize](https://arcprize.org/leaderboard), insanlar için kolay ama yapay zeka için zor olan görsel bulmacalardan oluşan bir test serisi. Her bulmacada birkaç örnekten kuralı çıkarıp yeni bir örneğe uygulamak gerekiyor. Yani ezberle değil, akıl yürüterek çözülmesi hedefleniyor. Şu anda üç sürümü var: ARC-AGI-1, 2 ve 3.

Grafikte yatay eksen görev başına maliyeti, dikey eksen başarı yüzdesini gösteriyor. Sol üst köşe en ideal yer; hem ucuz hem başarılı.

## Neden yeniden çizdim?

Leaderboard'da her model, hatta aynı modelin her efor ayarı (low, high, max gibi) ayrı bir nokta olarak duruyor. Yüzlerce nokta var ve bir model ailesinin sürümden sürüme nereye gittiğini görmek neredeyse imkansız.

Ben de verileri alıp her sürümün tüm efor seçeneklerini tek bir noktaya indirdim ve aynı ailenin sürümlerini çıkış sırasına göre tek bir çizgiyle birleştirdim. Böylece Opus'un, GPT'nin, Gemini'ın zaman içinde nasıl bir yol izlediği tek bakışta görünür oldu. Sayfayı [buradan inceleyebilirsiniz](https://codesignist.github.io/ai-trend/).

![Claude Opus ailesinin ARC-AGI eğrisi](/blog/ai-yarisinda-ters-c/opus.jpg)

## Ters C nasıl oluştu?

Turuncu Opus çizgisini takip edelim. Opus 4'ten başlayan çizgi 4.5, 4.6 ve 4.7 ile yukarı çıkarken bir yandan da sağa, yani daha pahalıya kayıyor. Opus 4.7'de ARC-AGI-2'deki bir görev için ortalama 4 dolar civarı harcanıyordu. Opus 4.8 aynı başarıyı daha ucuza verince çizgi sola kıvrılmaya başlıyor. Opus 5 ile hem yukarı hem sola gidiyor, Opus 5.5 ile de sola doğru uzanmaya devam ediyor. Opus 5.5 aynı testte %87 başarıya görev başı 70 sent civarında ulaşıyor. Yani 4.7'nin neredeyse altıda biri maliyetle çok daha iyi bir sonuç.

Önce sağa gidip sonra geri dönen bu çizgi, grafikte ters çevrilmiş bir C harfi gibi duruyor.

## Sadece Opus değil

GPT ailesinde de aynı şeyi görüyoruz. GPT-5.5'e kadar çizgi sağa doğru ilerliyor, sonra GPT-5.6 Sol ve GPT-6 Astra ile sola dönüyor. Astra, ARC-AGI-2'de %86 başarıya görev başı 65 sent civarında ulaşıyor.

![GPT ailesinin ARC-AGI eğrisi](/blog/ai-yarisinda-ters-c/gpt.jpg)

Grafiğin sol tarafında ise DeepSeek ve Kimi gibi modeller var. En yüksek skorlara çıkmasalar da çok daha düşük fiyatlarla epey yol almış durumdalar. DeepSeek V4 Pro, ARC-AGI-2'de görev başı 40 sente %44,5 yapıyor.

Aslında burada iki güç birbirine karşı çalışıyor. Daha iyi sonuç genelde daha çok işlem, yani daha çok maliyet demek. Öte yandan teknoloji yaygınlaştıkça rekabet artıyor, rekabet de fiyat yarışı demek. Uzun süre birinci taraf ağır bastı, şimdi ikincisi de kendini göstermeye başladı.

## ARC-AGI-3'te daha en baştayız

Tabii şu anda sadece ARC-AGI-1 ve 2 sonuçlarına göre konuşuyoruz. Bu iki testte en iyi modeller %90'ın üzerine çıktı ve testler anlamını yitirmeye başladı. Tavana yaklaştıkça çizginin sola gitmesi de kolaylaşıyor.

ARC-AGI-3 tarafında tablo bambaşka. Yakın zamana kadar bütün modeller %5'in altındaydı. Opus 5 ile %30'a, GPT-6 Astra ile ortalamada %45'e çıkıldı ama bir test koşusunun toplam maliyeti Opus 5'te 20 bin, Astra'da 40 bin dolar civarında. Yani burada çizgi hâlâ sağa ve yukarı tırmanıyor. ARC-AGI-3'te ve bundan sonra çıkacak testlerde ters C formunun henüz en başında olabiliriz. Opus 5.5 ise ARC-AGI-3'te henüz ölçülmedi.

## Okurken küçük bir not

Sürümler leaderboard'da aynı efor ayarlarıyla ölçülmemiş. Örneğin Opus 5 sadece en yüksek iki ayarla, Opus 5.5 ise en düşükten en yükseğe beş ayarla ölçülmüş. Düşük ayarlar da ortalamayı biraz aşağı çekiyor. Bu yüzden sayfaya bir de "En iyi seçenek" görünümü ekledim. Orada her sürümün en iyi sonucu ve o sonucun kendi maliyeti karşılaştırılıyor. İki görünümde de ters C aynı şekilde ortaya çıkıyor.

---

Bu çizgi sola doğru ne kadar yanaşacak, hep birlikte göreceğiz. Grafikleri [ARC-AGI sürüm eğrileri](https://codesignist.github.io/ai-trend/) sayfasından kendiniz de inceleyebilir, kaynak kodlarına [GitHub](https://github.com/codesignist/ai-trend) üzerinden ulaşabilirsiniz.
