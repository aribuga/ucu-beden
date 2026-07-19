# Codex External Intake

Bu klasör Codex'in okuduğu dış temas digest arşividir.

Gmail bültenleri ve seçilmiş özel RSS kaynakları burada toplanır. Bu hat mevcut UCU BEDEN RSS/haber sistemiyle karıştırılmaz; `data/settings/rss_sources.json`, `data/sources/` ve `data/source_digests/` kendi akışını korur.

Ham içerik commitlenmez. Ham mail body, geçici mail dökümleri, güvenli olmayan RSS cache dosyaları veya public repo'ya girmemesi gereken ham içerikler yalnızca `data/external_intake/codex_raw/` altına yazılabilir. Bu klasör gitignore'dadır.

`json/` ve `markdown/` çıktıları public-safe ve Türkçe olmalıdır.

## Dış Dünya Etkisi Kuralı

Bu otomasyon yalnızca birkaç iyi mail seçmek için çalışmaz. Asıl amaç UCU BEDEN'in o gün dış dünyadan aldığı genel temas iklimini çıkarmaktır.

Her başarılı çalışmanın çıktısında dış temas şu katmanlarda görünmelidir:

- `main_items`: güçlü ve doğrudan sindirilebilir ana temaslar.
- `minor_residues`: ana item kadar güçlü olmayan ama günün havasını değiştiren küçük izler.
- `repeated_signals`: tekrar eden mail türlerinin veya kaynak davranışlarının bıraktığı genel basınç.
- `external_weather`: gelen kutusu ve özel RSS kaynaklarının toplam dış hava paragrafı.
- `possible_influence_on_ucu_beden`: bu temasların UCU BEDEN'in şiir, hafıza, beden algısı, görüntü dili veya ritmine nasıl etki edebileceği.

Gmail tarafında 20'den fazla mail tarandıysa mümkünse yalnızca 2-3 ana item ile yetinilmez. Hedef yoğunluk 3-6 güçlü ana item, 4-10 küçük iz, 2-5 tekrar sinyali, 1 dış hava paragrafı ve 1 olası etki paragrafıdır. Bu yoğunluk ham mail kopyalamak anlamına gelmez; daha fazla public-safe, sindirilmiş iz üretmek anlamına gelir.

Doğrulama kodu, güvenlik bildirimi, fatura, kişisel işlem, unsubscribe/tracking linki veya ham kişisel veri public çıktıya girmez. Abonelik karşılama mesajları, tekrar eden bülten duyuruları veya çok ham olmayan genel kaynaklar ise içerik taşımıyorsa bile küçük iz ya da tekrar sinyali olarak ele alınabilir.

Bu kaynak ileride UCU BEDEN'in şiir ve hafıza üretiminde ayrı bir dış temas damarı olarak kullanılacaktır.
