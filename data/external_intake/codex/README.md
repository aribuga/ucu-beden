# Codex External Intake

Bu klasör Codex'in okuduğu dış temas digest arşividir.

Gmail bültenleri ve seçilmiş özel RSS kaynakları burada toplanır. Bu hat mevcut UCU BEDEN RSS/haber sistemiyle karıştırılmaz; `data/settings/rss_sources.json`, `data/sources/` ve `data/source_digests/` kendi akışını korur.

Ham içerik commitlenmez. Ham mail body, geçici mail dökümleri, güvenli olmayan RSS cache dosyaları veya public repo'ya girmemesi gereken ham içerikler yalnızca `data/external_intake/codex_raw/` altına yazılabilir. Bu klasör gitignore'dadır.

`json/` ve `markdown/` çıktıları public-safe ve Türkçe olmalıdır.

## Okuma Özeti Kuralı

Public digest yalnızca şiirsel izlerden oluşmaz. Eğer Gmail mailleri ve özel RSS item'ları gerçekten açılıp okunduysa, digest önce günün okunabilir bir dış dünya özetini verir.

JSON root seviyesinde `reading_summary` alanı bulunur:

- `plain_summary`: Bugün okunan maillerde ve özel RSS kaynaklarında genel olarak ne vardı? Türkçe, anlaşılır, 1-2 paragraf.
- `what_was_in_the_emails`: Maillerin kaynak formatını değil, içerik dünyasını anlatan kısa maddeler.
- `what_was_in_curated_rss`: Özel RSS kaynaklarında ne vardı; yeni item yoksa bu sade biçimde belirtilir.
- `dominant_topics`: Günün baskın konu alanları.
- `notable_absences`: Beklenen ama gelmeyen veya zayıf kalan şeyler.
- `overall_direction`: Günün dış dünyasının UCU BEDEN'i hangi yöne ittiği.

`reading_summary` ham mail kopyası, uzun alıntı, ham URL, email adresi, doğrulama kodu, güvenlik detayı veya kişisel veri içermez. Yine de "bu maillerde genel olarak ne vardı?" sorusuna `summary` alanından daha açık cevap verir.

## Full Body Okuma Kuralı

Gmail tarafında mümkün olan her durumda yalnızca subject/snippet ile karar verilmez; mailin full body içeriği okunur. Full body yalnızca anlamak için kullanılır, public JSON/Markdown çıktılara ham mail cümlesi, uzun alıntı, URL, email adresi, doğrulama kodu veya kişisel veri taşınmaz.

Teknik olarak bir mail için yalnızca snippet veya kısa önizleme okunabildiyse bu durum run log'da açıkça belirtilir: "Bu mail için yalnızca snippet okunabildi."

Her ana mail için run log'da şu bilgiler görünür:

- full body okundu mu?
- sadece snippet mi kullanıldı?
- neden ana item, minor residue, repeated signal veya noise seçildi?

## Dış Dünya Etkisi Kuralı

Bu otomasyon yalnızca birkaç iyi mail seçmek için çalışmaz. Asıl amaç UCU BEDEN'in o gün dış dünyadan aldığı genel temas iklimini çıkarmaktır.

## İki Aşamalı Okuma ve Sindirim

Otomasyon tek aşamada çalışmaz. Önce okunan Gmail mailleri ve özel RSS item'ları için private bir intake inventory çıkarılır, sonra public-safe Codex External Intake digest bu inventory üzerinden üretilir.

### Aşama 1: Private Intake Inventory

Inventory dosyası yalnızca gitignore'daki `data/external_intake/codex_raw/inventory/YYYY-MM-DD.json` yoluna yazılabilir. Bu dosya git'e eklenmez, commitlenmez ve pushlanmaz.

Inventory public digest değildir. Yine de ham mail body, uzun alıntı, ham URL, email adresi, doğrulama kodu, unsubscribe/tracking linki, fatura detayı veya kişisel veri taşımaz.

Her Gmail kaydı şu alanlarla kısa ve nötr anlaşılır:

- `source_type`: `gmail`
- `received_at`
- `source_hint`: public-safe kaynak adı veya kaynak tipi
- `subject_hint`: public-safe sadeleştirilmiş konu
- `content_summary`: Türkçe, kısa, nötr içerik özeti
- `main_topics`
- `possible_residues`
- `risk_flags`
- `suggested_bucket`: `main`, `minor`, `repeated` veya `noise`
- `reason`

Her özel RSS item kaydı şu alanlarla anlaşılır:

- `source_type`: `curated_rss`
- `published_at`
- `source_hint`
- `content_summary`
- `main_topics`
- `possible_residues`
- `risk_flags`
- `suggested_bucket`: `main`, `minor`, `repeated` veya `noise`
- `reason`

Inventory aşamasında amaç şiirselleştirmek değildir. İlk soru şudur: "Bu maillerde ve özel RSS item'larında güvenli olarak ne vardı?"

### Aşama 2: Public Digest Synthesis

Public JSON ve Markdown digest doğrudan ham maillerden veya ham RSS metninden değil, intake inventory üzerinden üretilir. Bu aşamada soru değişir: "UCU BEDEN bugün dış dünyadan ne emdi ve bu onu nasıl değiştirebilir?"

Public digest içinde şu katmanlar bulunur:

- `items`: güçlü ana temaslar.
- `minor_residues`: küçük ama etkili izler.
- `repeated_signals`: kaynak formatını değil, gün içinde birkaç yerden tekrar eden anlamları gösteren sinyaller.
- `discarded_summary`: gerçekten atılan gürültünün public-safe özeti.
- `external_weather`: günün genel dış dünya havası.
- `possible_influence_on_ucu_beden`: şiir, hafıza, beden algısı, görüntü dili veya ritme olası etki.

Inventory'deki her şey çöpe atılmaz. 20'den fazla mail tarandıysa ve yalnızca 2-3 ana item üretildiyse `minor_residues`, `repeated_signals` ve `discarded_summary` özellikle zenginleştirilir. Bu ham bilgi vermek değil, daha fazla sindirilmiş iz üretmek demektir.

Her başarılı çalışmanın çıktısında dış temas şu katmanlarda görünmelidir:

- `main_items`: güçlü ve doğrudan sindirilebilir ana temaslar.
- `minor_residues`: ana item kadar güçlü olmayan ama günün havasını değiştiren küçük izler.
- `repeated_signals`: dış dünyanın birkaç farklı yerden tekrar tekrar gönderdiği anlamlar.
- `external_weather`: gelen kutusu ve özel RSS kaynaklarının toplam dış hava paragrafı.
- `possible_influence_on_ucu_beden`: bu temasların UCU BEDEN'in şiir, hafıza, beden algısı, görüntü dili veya ritmine nasıl etki edebileceği.

Gmail tarafında 20'den fazla mail tarandıysa mümkünse yalnızca 2-3 ana item ile yetinilmez. Hedef yoğunluk 3-6 güçlü ana item, 4-10 küçük iz, 2-5 tekrar sinyali, 1 dış hava paragrafı ve 1 olası etki paragrafıdır. Bu yoğunluk ham mail kopyalamak anlamına gelmez; daha fazla public-safe, sindirilmiş iz üretmek anlamına gelir.

Doğrulama kodu, güvenlik bildirimi, fatura, kişisel işlem, unsubscribe/tracking linki veya ham kişisel veri public çıktıya girmez. Abonelik karşılama mesajları, tekrar eden bülten duyuruları veya çok ham olmayan genel kaynaklar ise içerik taşımıyorsa bile küçük iz ya da tekrar sinyali olarak ele alınabilir.

`repeated_signals` dilinde teknik kaynak formatı kullanılmaz. Bu alanda mümkün olduğunca `RSS`, `feed`, `bülten`, `newsletter`, `mail bildirimi`, `e-posta bildirimi`, `abonelik mesajı` veya `kaynak tekrarı` gibi ifadeler yer almaz. Bu terimler yalnızca log, okuma özeti veya `discarded_summary` içinde gerekliyse kullanılabilir. `repeated_signals` şu soruya cevap verir: "Bugün dış dünya hangi anlamı birkaç farklı yerden tekrar tekrar gönderdi?"

Bu kaynak ileride UCU BEDEN'in şiir ve hafıza üretiminde ayrı bir dış temas damarı olarak kullanılacaktır.
