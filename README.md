# PERFECT TIMING

Tek parmakla oynanan, dikey ekranlı, minimalist bir mobil arcade oyunu. Hareket eden bloğu doğru
anda durdurup hedef alana yerleştirirsin. *Easy to learn, hard to master.*

- **Teknoloji:** HTML5 Canvas ve saf JavaScript (ES modules). Bağımlılık ve build adımı yok.
- **Platform:** Mobil tarayıcı (portre), PWA olarak ana ekrana eklenebilir. Masaüstünde portre çerçeve içinde çalışır.
- **Neden bu teknoloji:** Klasör boştu, ortamda Godot/Unity yoktu, Node.js vardı. HTML5, telefonda anında
  test edilebiliyor ve gerektiğinde Capacitor ile Android/iOS uygulamasına sarılabiliyor.

## Çalıştırma

```bash
npm start
```

Ardından tarayıcıda `http://localhost:5173` adresini açın. Telefondan aynı Wi-Fi üzerinden test için:

```bash
HOST=0.0.0.0 npm start
```

Sonra telefonda `http://<bilgisayar-ip>:5173` adresini açın. Windows PowerShell'de: `$env:HOST="0.0.0.0"; npm start`.

> ES modülleri `file://` üzerinden yüklenmez. Oyunu her zaman bir sunucu üzerinden açın.

## Test

```bash
npm test
```

Node'un yerleşik test koşucusu (`node:test`) kullanılıyor. 44 test şunları kapsar: örtüşme hesabı ve derecelendirme,
puan/çarpan/seri, zorluk eğrisi ve hareket desenleri, oyun durum makinesi (çift dokunma, tek oyun sonu,
pause/resume, restart, continue), görevler, kayıt sistemi (bozuk veri onarımı, depolama hatası) ve
reklam/mağaza sağlayıcısının yokluğu.

## Nasıl oynanır

- Ekrana dokun (masaüstünde **Space/Enter**) → blok düşer.
- Blok hedef çerçeveyle (pembe kesikli alan) ne kadar ortalanırsa o kadar iyi:
  **PERFECT** (sarı işaretlerin arasında) › **GREAT** › **GOOD** › **MISS** (geçerli örtüşme yok → oyun biter).
- Arka arkaya GREAT+ alırsan combo büyür. Her 4 combo'da çarpan +0.5 artar (en fazla ×3). GOOD combo'yu bozar.
- Arka arkaya PERFECT'ler ek bonus verir ve sonraki hedefleri biraz genişletir. Ustalığın ödülü budur.
- **Esc / P** ile duraklatılır. Uygulama arka plana alınınca oyun otomatik duraklar.

## Dosya yapısı

```
index.html              Ekranlar (menü, HUD, pause, oyun sonu, ayarlar, görevler)
styles.css              Tüm arayüz stili, safe-area, animasyonlar
manifest.webmanifest    PWA manifesti (portre, tam ekran)
server.js               Bağımlılıksız yerel statik sunucu
assets/icon.svg         Uygulama ikonu
src/
  config.js             TÜM denge sabitleri (eşikler, puanlar, zorluk, süreler)
  main.js               Bağlantı katmanı: döngü, giriş, yaşam döngüsü, kayıt, görevler
  core/                 Saf oyun mantığı (DOM yok, test edilebilir)
    geometry.js           Örtüşme ve Perfect/Great/Good/Miss derecelendirmesi
    motion.js             Blok hareket desenleri (linear, sine, pulse)
    difficulty.js         Zorluk eğrisi, tur planı, hedef yerleşimi
    scoring.js            Merkezi puan / combo / çarpan / perfect serisi
    session.js            Oyun durum makinesi (ready → moving → dropping/falling → over)
    missions.js           Görev havuzu ve ilerleme
  systems/
    storage.js            Kalıcı kayıt (localStorage, doğrulama, bellek yedeği)
    audio.js              Web Audio ile sentezlenen sesler (ses dosyası yok)
    haptics.js            Titreşim (desteklenmeyen cihazda sessizce devre dışı)
    cosmetics.js          Tema kayıt defteri ve kilit açma kuralları
    monetization.js       Reklam/mağaza entegrasyon noktaları (sağlayıcı yok → kapalı)
  render/
    renderer.js           Canvas çizimi: kule, hedef, blok, kamera, menü arka planı
    effects.js            Havuzlu parçacık, halka, sarsıntı ve flaş efektleri
  ui/ui.js              DOM ekranları, HUD, popup ve toast'lar
tests/                  Otomatik testler (node:test)
docs/MONETIZATION.md    Reklam ve satın alma entegrasyon talimatları
```

## Denge ayarı

Tüm sayılar `src/config.js` dosyasındadır:

| Sabit | Anlamı | Başlangıç |
|---|---|---|
| `ACCURACY.PERFECT` | Perfect toleransı: `max(oran × maxOffset, minWindowMs × hız)` | %7 / 28 ms |
| `ACCURACY.GREAT` | Great toleransı | %24 / 70 ms |
| `ACCURACY.MIN_VALID_OVERLAP_RATIO` | Bundan ince örtüşme MISS sayılır | %4 |
| `DIFFICULTY.*` | Hız 360 → 920, hedef 300 → 120, blok 230 → 130 birim | |
| `DIFFICULTY.PATTERNS` | `sine` 6. seviyede, `pulse` 14. seviyede açılır | |
| `SCORING.*` | Good 10 / Great 20 / Perfect 40, seri bonusu, çarpan | |

Derecelendirme tamamen geometriktir. Zamana dayalı alt sınır, oyun hızlandığında da Perfect penceresinin
en az ±28 ms kalmasını sağlar, böylece geç oyun adil kalır. Hedef çerçevenin içindeki sarı işaretler
Perfect penceresini gösterir, bloğun ortasındaki çentik de oyuncunun hizalayacağı noktadır.

## Uygulanan güvenlik önlemleri

- **Çift puan yok:** Yalnızca `moving` durumu dokunma kabul eder. Çoklu parmak veya hızlı dokunmalar yok sayılır.
- **Tek oyun sonu:** `finish()` korumalı, `gameOver` her koşuda bir kez tetiklenir.
- **Kare süresi sınırı:** `dt` 50 ms ile sınırlı, NaN/negatif değerler yok sayılıyor. Arka plandan dönünce blok ışınlanmaz.
- **Puan güvenliği:** Tüm puanlar sonlu, negatif olmayan tam sayılar. Geçersiz girdi `RangeError` fırlatır, NaN üretmez.
- **Kayıt güvenliği:** Bozuk/elle değiştirilmiş kayıt onarılır. localStorage kapalıysa (gizli mod) oturum bellekte sürer.
- **Hata yalıtımı:** Bir dinleyicideki (UI/ses) hata durum makinesini bozmaz. Bir karedeki hata döngüyü durdurmaz.

## Kozmetik ve ilerleme

- Görevler: 11 görevlik havuzdan aynı anda 3 aktif görev. Tamamlananlar koşu bitince yenileriyle değişir.
- Yıldızlar temaları açar: Neon Night (0), Ember (3), Mint Dusk (8), Monochrome (15).
- Yeni tema eklemek için `src/systems/cosmetics.js` içindeki `THEMES` dizisine bir nesne ekleyin.

## Mobil uygulamaya dönüştürme (isteğe bağlı)

Proje bir web uygulaması olduğu için Capacitor ile paketlenebilir:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
```

Ardından `npx cap init` ve `npx cap add android` adımları gelir (`webDir` = proje kökü veya kopyalanmış bir `www/`).
Bu adımlar bu sürümde **yapılmadı ve test edilmedi.**
