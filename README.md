# Gölge Derinlikleri

Mobil için izometrik 3D keşif / roguelike RPG. Tamamen prosedürel: zindanlar, PBR dokular, modeller ve sesler çalışma anında üretilir.

**Hazır APK:** [`release/GolgeDerinlikleri.apk`](release/GolgeDerinlikleri.apk) — telefona indirip "Bilinmeyen kaynaklara izin ver" ile kurun (Android 7.0+, OpenGL ES 3.0).

## Özellikler
- **5 biyom / zindan stili**, 10 kat + sonsuz mod: Kadim Mahzen, Kor Mağaraları, Donmuş Salonlar, Zehirli Bataklık, Boşluk Tapınağı
- **9 düşman türü**, her biri farklı yapay zekâ ile (yakın dövüş, okçu, atılan örümcek, bölünen balçık, şarj eden golem, ışınlanan hayalet, yelpaze ateşli göz...)
- **5 boss**, çok fazlı saldırı desenleri (halka, spiral, çağırma, şarj, alan darbesi), %50 can altında öfke modu
- **Fizik:** kütle ve itme tabanlı çarpışmalar, yüzey tutunması (buzda kayma), duvara savrulan düşmanlara çarpma hasarı, kırılabilir eşyalar, seken/dönen katı enkaz parçaları, eşyaların arkasına siper alma
- **Dövüş hissi:** 3 vuruşluk kombo (ağır bitirici), vuruş duraksaması, yönlü kamera tepmesi, kılıç izi, sersemletme, titreşim
- **Haritalar:** biyoma özel oda şekilleri (salonlar, mağaralar, yuvarlak/sekizgen odalar, haç planlı tapınaklar), sütunlu salonlar, diken tuzakları, şifa çeşmeleri
- **15 güç (perk)**, seviye atladıkça 3'ten 1 seçim; sandıklar, altın, iksirler
- **Grafik:** PBR malzemeler, prosedürel normal/pürüzlülük haritaları, dinamik yumuşak gölgeler, meşale gölgeleri, GTAO ortam kapatma (Ultra), HDR bloom, ACES ton eşleme, animasyonlu sıvılar (lav, zehir, buz), duvar kesme (cutaway) shader'ı
- **Ses:** WebAudio ile gerçek zamanlı sentez — konvolüsyon yankısı, kompresör, biyoma özel üretken müzik ve ortam sesleri
- **Optimizasyon:** parçalara bölünmüş (chunk) zindan geometrisi ve görüş dışı ayıklama, pişirilmiş ortam gölgesi, uzak düşmanları uyutma, nesne havuzları, sabit ışık havuzu (shader yeniden derleme yok), dinamik çözünürlük ölçekleme, cihaz bazlı otomatik kalite
- **Erişilebilirlik:** 3 zorluk seviyesi, otomatik saldırı, otomatik iksir, sabit joystick, tuş boyutu/saydamlığı ve sürükle-bırak tuş yerleşim düzenleyicisi
- Ana menü, ayarlar (kalite, müzik/efekt sesi, sarsıntı, FPS), duraklatma, Android geri tuşu desteği

> Not: Mobil WebView'da donanımsal ışın izleme (RT çekirdekleri) API'si yoktur; "Ultra RT" modu bu görünümü gerçek zamanlı gölgeler, ortam kapatma, PBR yansımalar ve bloom ile taklit eder.

## Kontroller
Sol yarı: sanal joystick · ⚔ saldırı (basılı tut, otomatik nişan) · atılma · kor novası · iksir.
Masaüstü: WASD / J (saldırı) / K (atılma) / L (nova) / Q (iksir) / Esc.

## Derleme
```bash
./build-apk.sh          # web paketini derler + APK üretir (ANDROID_HOME gerekli)
cd web && npm run serve # tarayıcıda test: http://localhost:8080
```
Yayın imzası için `android/keystore.properties` (storeFile, storePassword, keyAlias, keyPassword) ekleyin; yoksa debug anahtarıyla imzalanır.
