# Günlük üretimi doğrulama

21–27 Kasım 2026 tarihli her şiir ve rüyanın üretim kaydı mock sağlayıcısı, HTTP 429 ve başarısız yüzey doğrulaması içeriyor. Arşivde metin isteğinin hata kodu veya Retry-After başlığı yok. Aynı 14 görsel kaydında kullanılabilir dosya yolu boş ve sağlayıcı kredi kalmadığını yazmış. 20 Kasım model kayıtları arşivde kalır. İncelenen sürümde her iki doğrulamanın da geçtiği kayıtlı şiir yok. Bu yüzden eski bir şiire geriye dönük olarak doğrulanmış etiketi vermiyoruz.

## Çevrimdışı kontrol

- `node tests/issue32/entrypoints.mjs` geçici dizinde günlük betikleri çalıştırır. Ağ yanıtları yereldir. Metin ve görsel hataları, yeniden deneme, yazım ve seçici backfill sınanır.
- `node --import tsx tests/issue32/archive.ts` kaynak ve iz kimliklerini karşılaştırır. Her tarihteki iki metin izi karantinada, diğer 12 iz yeniden indekslemede korunur. 22–27 Kasım seçimleri önceki mock rüyalara referans içerir. Bir bağın bulunması son metindeki sözcüklerin kaynağını belirlemez.
- `npm run backfill:visuals -- --dry-run --from=2026-11-21 --to=2026-11-27 --kind=dream` yalnızca doğrulanmış metne bağlı eksik görselleri listeler. Bu yedi günde aday yok. Depo genelinde iki doğrulaması kayıtlı tek uygun rüyanın (15 Haziran) görseli zaten var. Doğrulama bilgisi eksik eski kayıtlar manuel incelemeye kalır.
- Karantina yerel kod ve 14 kimlik içeren manifest üzerinden uygulanır. Kaynak metinler ve dönemin iz dosyaları yerinde kalır. Geri almak için değişiklik commit’ini geri çekip önceki sürümü kullanın. Gelecekte ayrı onayla elde edilen yeni içerikleri eski mock politika ile tekrar üretmeyin. İndeks ve rapor türetilmiş verilerdir. Geri dönüş gerekirse son iyi kod ve indeks/rapor çiftini birlikte geri yükleyin.

## Operasyon

Metin ve görsel için OpenAI Platform’da iş akışının kullandığı proje ve organizasyonun Limits, Usage ve Billing alanlarını ayrı kontrol edin. Proje/model limiti, anahtarın proje ilişkisi, bakiye ve harcama sınırı incelenmelidir. Bilinmeyen 429 tanısını kota olarak kaydetmeyin. Kota kodunda veya doğrulanmış kredi mesajında çağrı hemen durur. Geçici 429 ve 5xx için istek başına en fazla üç deneme vardır. Sağlayıcı 10 saniyeden uzun bekleme istediğinde yeni deneme sonraki çalışmaya kalır.

GitHub Actions uyarılarını sağlayıcı, aşama ve hata sınıfı başına bir açık olayda birleştirin. Tarih ve tekrar sayısını aynı olayda güncelleyin. İlk başarılı şiir, rüya ve görsel aşamalarını ayrı ayrı doğruladıktan sonra ilgili olayı kapatın. Bu teslimde bildirim gönderimi kurulmadı.

Hesap tarafı düzeltme ve tek günlük ücretli doğrulama için ayrıca onay alın. Sonrasında tek İstanbul tarihi için şiir ve rüyanın iki doğrulama bayrağını, gerçek görsel dosyalarının açılmasını, dış dünya kaydını ve hafızada doğrudan/dolaylı seçilen kimlikleri kontrol edin. Aynı tarihte tekrar çalıştırıp dosya sayısını ve mevcut görsel özetlerini karşılaştırın. Herhangi bir aşama başarısızsa o aşamanın tarih ve hata sınıfını kaydedin. Önceki sağlıklı yayını koruyun.
