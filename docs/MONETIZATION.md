# Reklam ve Gelir Modeli — Entegrasyon Noktaları

Bu sürümde **hiçbir reklam gösterilmez ve hiçbir satın alma yapılmaz.** SDK veya kimlik bilgisi
olmadığı için sahte reklam da yoktur. `src/systems/monetization.js` yalnızca arayüzü tanımlar;
sağlayıcı verilmediğinde her şey "kullanılamaz" döner ve ilgili butonlar gizli kalır.

## 1. Ödüllü reklamla bir kez devam etme

Hazır olan altyapı:

- `GameSession.continueRun()`: Biten koşuyu aynı seviyeden, skoru koruyarak, serileri sıfırlayarak bir kez canlandırır (`RUN.MAX_CONTINUES`). Testi: `tests/session.test.js`.
- `main.js` → `tryContinue()`: Önce `ads.showRewarded()` çağrılır, oyun yalnızca `rewarded === true` ise devam eder.
- Oyun sonu ekranındaki `CONTINUE (WATCH AD)` butonu yalnızca `ads.isRewardedAvailable()` true dönerse görünür.
- Kayıt: Devam edilen koşu `countRun: false` ile kaydedilir, yani tek koşu iki kez sayılmaz.

Gerçek sağlayıcıyı bağlamak için `src/main.js` içindeki `new AdService(null)` satırını değiştirin:

```js
const ads = new AdService({
  isRewardedReady: () => /* SDK'da yüklü bir ödüllü reklam var mı */ false,
  showRewarded: async () => {
    // SDK'nın ödüllü reklamını göster; kullanıcı ödülü kazandıysa:
    return { rewarded: true };
  },
});
```

Mobil paketleme için önerilen yol şudur: Oyunu Capacitor ile Android/iOS'a sarın ve bir AdMob
eklentisini (ör. `@capacitor-community/admob`) yalnızca native platformda yükleyin. Uygulama ve reklam birimi
kimlikleri (App ID / Ad Unit ID) olmadan entegrasyonu etkinleştirmeyin. Geliştirme sırasında
yalnızca sağlayıcının resmi **test** reklam birimlerini kullanın.

## 2. Reklam kaldırma satın alımı

- Ürün kimliği: `PRODUCT_IDS.REMOVE_ADS`
- Kayıtta `purchases.removeAds` alanı hazır.
- `StoreService` bir sağlayıcı bekler: `{ isAvailable(), purchase(productId), restore() }`.
- Ödüllü "continue" isteğe bağlı olduğu için reklam kaldırma satın alımından etkilenmez. Zorunlu reklam zaten yok.

## 3. Kozmetik tema paketleri

- `src/systems/cosmetics.js` içindeki her temaya `productId` eklenebilir. `isThemeUnlocked()` bu durumda
  `purchases.products` listesini de kontrol eder.
- Şu an temalar yalnızca görevlerden kazanılan yıldızlarla açılır.

## Oyuncu deneyimi kuralları (bilinçli tasarım kararları)

- Kaybettikten hemen sonra otomatik reklam yok. Reklam yalnızca oyuncu "continue" seçerse gösterilir.
- Her koşuda en fazla bir devam hakkı var.
- Reklam yüklenemezse veya SDK hata verirse oyun normal oyun sonu akışıyla devam eder.
