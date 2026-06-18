# OpenAI Image Generation

UCU BEDEN keeps deterministic visual metadata for every poem and dream. When `OPENAI_API_KEY` is available, `src/lib/openaiImageProvider.ts` also requests a real image from the OpenAI Images API.

## Environment

```txt
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1280
OPENAI_IMAGE_QUALITY=low
OPENAI_IMAGE_FORMAT=png
OPENAI_IMAGE_DELAY_MS=1200
```

OpenAI receives the nearest supported portrait request (`1024x1536` by default). The result is cropped with `sharp` and saved as a real `1024x1280` 4:5 file.

## Prompt Shape

Poem and dream image prompts are built separately from text-generation prompts.

Poem visuals are abstract by design. The prompt should use:

- mood sentence,
- dominant mood,
- selected memory residue that is safe to surface visually,
- source digest cues related to esthetic tone, rhythm, attention, and sentence movement.

Poem visuals should not literally illustrate the poem line by line. Direct home/place/walk surfaces such as room, couch, bed, table, window, rug, street, park, apartment, route, or neighborhood should not become the main motif. They may be translated into atmosphere, pressure, rhythm, fatigue, attention shift, or associative texture.

Generated images must stay text-free. Poem titles, poem lines, captions, handwriting, labels, logos, watermarks, UI text, fake alphabets, and glyph-like marks are explicitly excluded from visual prompts and negative prompts.

Dream visuals can be stranger and more symbolic, but still avoid raw source text and direct reuse of poem surfaces.

## Files And Metadata

Generated images are written to:

```txt
public/generated/visuals/YYYY-MM-DD-poem.png
public/generated/visuals/YYYY-MM-DD-dream.png
```

Their metadata remains under `data/visuals/`. It records `image_path`, provider, model, API size, final size, quality, format, prompt hash, fallback state, and a short error when needed.

If the API key is missing or image generation fails, poem and dream generation continue. The metadata fallback remains visible and the workflow logs `fallback kept`.

## Historical Backfill

```bash
npm run backfill:visuals
npm run backfill:visuals -- --from=2026-06-01
npm run backfill:visuals -- --images-only
npm run backfill:visuals -- --force --limit=2 --delay-ms=2000
```

Default behavior preserves existing real images and generates only missing/fallback records. `--force` regenerates, `--images-only` skips records without metadata, `--from` limits dates, `--limit` caps API attempts, and `--delay-ms` controls the pause between requests.

Scheduled morning and night workflows limit historical backfill to four attempts per run to avoid an unexpected cost burst.
