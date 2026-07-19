# Codex External Intake

Bu klasör Codex'in okuduğu dış temas digest arşividir.

Gmail bültenleri ve seçilmiş özel RSS kaynakları burada toplanır. Bu hat mevcut UCU BEDEN RSS/haber sistemiyle karıştırılmaz; `data/settings/rss_sources.json`, `data/sources/` ve `data/source_digests/` kendi akışını korur.

Ham içerik commitlenmez. Ham mail body, geçici mail dökümleri, güvenli olmayan RSS cache dosyaları veya public repo'ya girmemesi gereken ham içerikler yalnızca `data/external_intake/codex_raw/` altına yazılabilir. Bu klasör gitignore'dadır.

`json/` ve `markdown/` çıktıları public-safe ve Türkçe olmalıdır.

Bu kaynak ileride UCU BEDEN'in şiir ve hafıza üretiminde ayrı bir dış temas damarı olarak kullanılacaktır.
