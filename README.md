# UCU BEDEN

UCU BEDEN is a local-first poetic archive and daily generation system for a digital poet that ages, remembers, walks, dreams, forgets, mutates, and changes through its own writing.

It is not a generic poem generator. User poems placed in `poems_input/` become genetic memory. Generated poems, dreams, daily life records, source digests, and memory traces become lived memory. Weather, RSS sources, home state, walking state, recurring surfaces, avoided words, and yearly reports influence the next poem without becoming direct news summaries.

The current system keeps complexity mostly inside the engine: sources are digested into safe language and esthetic cues, memory is retrieved as trace residue, OpenAI receives compact creative prompts, and validators guard Turkish output, raw source leakage, and overexposed surfaces.

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` if you want live services.

```txt
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1280
OPENAI_IMAGE_QUALITY=low
OPENAI_IMAGE_FORMAT=png
OPENAI_IMAGE_DELAY_MS=1200
NEWS_API_KEY=
WEATHER_API_KEY=
NEXT_PUBLIC_BASE_PATH=
```

If keys are missing, UCU BEDEN keeps working with deterministic mock sources, a mock poem generator, and visual metadata fallbacks.

OpenAI 500/429 responses are treated as temporary failures and retried before the mock poem generator is used. Generated poem JSON includes `generation.provider` so API usage can be checked after a run.

## Input Poems

Put `.txt` files in `poems_input/`. Poems are separated only by a single-line `-` separator.

```txt
first poem
continues here

-

second poem
continues here
```

Internal hyphens are not separators. Empty parts are ignored. The original user files are never overwritten.

Analyze input poems:

```bash
npm run analyze:input
```

The analysis is written to `data/analysis/input_poems_analysis.json`.

## Home And Walk

The world file lives at `data/world/ucu_beden_world.json`. UCU BEDEN lives in a 35 m2 1+1 home around Osmanaga, Kadikoy. The living room has a grey couch, a blue-figure rug, a computer, and a small kitchen area.

Its ordinary walk starts around Osmanaga, passes through Yogurtcu Park, stretches toward Kalamis Park, and may stop early, return home, or end on the couch.

## Daily Generation

```bash
npm run generate:today
```

The script:

- skips today if a poem already exists,
- scans and analyzes `poems_input/`,
- gathers live or fallback sources,
- digests RSS/source material into private factual records and public-safe poetic cues,
- creates mood, a rich daily life record, and walking state,
- analyzes the last 30 poems for soft repetition pressure,
- selects a small set of memory traces instead of sending the whole memory store,
- sends a compact Turkish OpenAI prompt,
- validates language, raw source leakage, repeated surfaces, and title surfaces,
- writes `data/generated_poems/YYYY-MM-DD.json`,
- writes `data/daily_life/YYYY-MM-DD.json`,
- writes source digestion to `data/source_digests/YYYY-MM-DD.json`,
- writes poem visual metadata to `data/visuals/YYYY-MM-DD-poem.json`,
- updates state, trace recall metadata, memory reports, vocabulary memory, image mutations, and yearly reports.

Force regeneration:

```bash
npm run generate:today -- --force
```

## Dream Generation

```bash
npm run generate:dream
```

The default dream run uses the current Europe/Istanbul generation date unless `--date` is supplied. It writes:

```txt
data/dreams/YYYY-MM-DD.json
data/visuals/YYYY-MM-DD-dream.json
```

Use `npm run generate:dream -- --date=YYYY-MM-DD` for a specific day. Existing dreams are safely skipped unless `--force` is supplied.

Dreams can use the day's poem, rich daily life, repeated motifs, outside residue, and dim/suppressed memory. Dream generation weights suppressed/repressed traces more strongly and can mark dream-return relations in memory.

## UI

```bash
npm run dev
```

The home page preserves the poem archive on the left and adds a visual consciousness field on the right. It shows the latest poem feeling, latest dream, and a live Istanbul-time activity selected from the daily schedule. Additional pages:

- `/archive`
- `/dreams`
- `/memory`
- `/memory/mutations`
- `/memory-map`
- `/phone`
- `/sources`
- `/sources/health`
- `/mood-map`
- `/settings`
- `/poem/YYYY-MM-DD`

`/memory` reads `data/memory/report.json` when available and falls back to legacy state only when the trace report is missing. `/memory/mutations` shows the trace mutation graph. `/memory-map` is a separate visual memory map with a focused near-field view and a full memory view. `/phone` is a standalone UCU BEDEN device interface with live HTML/CSS apps for gallery, notes, weather, memory, contacts, and messages.

More implementation notes:

- `docs/MEMORY_AND_SOURCE_SYSTEM.md`
- `docs/PHONE_AND_MEMORY_MAP.md`
- `docs/AUTOMATION.md`
- `docs/IMAGE_GENERATION.md`
- `MEMORY_PRODUCTION_CHECKLIST.md`

## Themes And Logos

Theme selection is controlled by `data/settings/site_settings.json`.

```json
{
  "theme": "fresh90s",
  "showMoodDots": true,
  "showFooterDedication": true
}
```

Supported themes:

- `minimal`: the original Space Mono archive theme.
- `sims2000`: a 2000s life-sim inspired skin.
- `fresh90s`: a dark 90s web skin with rainbow logo, side-menu styling, cyan text, and loud borders.

Logo files live in `public/logo.svg`, `public/footer-logo.svg`, and `public/assets/favicon.svg`.

## Age

Every generated day adds 1 month. 12 generated days equal 1 year. Life stages are never hardcoded.

## Memory

Memory is file-based and trace-oriented. Rebuild output lives under:

```txt
data/memory/traces/YYYY-MM-DD.json
data/memory/index.json
data/memory/report.json
```

Each memory trace is a lived residue rather than a simple word counter. Traces can come from poems, dreams, daily life, sources, walks, visuals, or contact residue. They carry status such as `active`, `dim`, `suppressed`, `fossilized`, `overexposed`, or `unstable`, plus recall metadata and linked traces.

Generation does not dump all memory into the prompt. `selectMemoryForGeneration(...)` chooses a small set of direct, indirect, suppressed, and long-term traces. Selected trace IDs are stored in poem/dream metadata, and successful generation updates recall counts, `last_recalled_at`, dream-return links, and the public memory report.

`memory_density` remains only for backward compatibility. The UI now presents memory through climate/report language, not as a numeric capacity meter.

Useful commands:

```bash
npm run rebuild:memory
npm run validate:memory
npm run debug:memory-cycle
npm run debug:latest-memory
```



## Visual Generation

Poem and dream visuals use separate prompt rules and a `4:5` portrait aspect ratio. With `OPENAI_API_KEY`, the Image API generates the nearest supported portrait size and `sharp` crops it to a final `1024x1280` image. Files are stored under `public/generated/visuals/`; metadata under `data/visuals/` records the public `image_path`, provider, model, API size, final size, quality, format, prompt hash, fallback state, and any short error.

Poem visual prompts are intentionally abstract. They visualize emotional climate, memory pressure, rhythm, attention shifts, and associative residue instead of literally illustrating room, couch, bed, table, window, street, park, or walk details from the poem.

The default model is `gpt-image-1`, quality is `low`, and format is `png`. These can be changed with the image environment variables above. If the key is missing or the API fails, poem and dream generation continue and the existing deterministic lo-fi metadata fallback remains visible.

Generate missing historical metadata and images sequentially:

```bash
npm run backfill:visuals
npm run backfill:visuals -- --from=2026-06-01
npm run backfill:visuals -- --from=2026-06-01 --to=2026-06-11
npm run backfill:visuals -- --images-only
npm run backfill:visuals -- --force --limit=2 --delay-ms=2000
```

Default backfill preserves existing real images. `--force` regenerates them, `--images-only` does not create missing metadata, `--from` limits dates, `--limit` caps API attempts, and `--delay-ms` controls the pause between attempts. Use a limit for cost-sensitive tests.

## Yearly Reports

Every 12 generated poems creates a report in `data/yearly_reports/year_XX.json`. Reports are based on actual generated poems and later become part of memory.

## Sources

The source collector is adapter-shaped. Open-Meteo can be used for weather. RSS sources are managed directly in `data/settings/rss_sources.json`; no feed combiner is required. Successful RSS items are mood-tagged into `data/sources/YYYY-MM-DD.json`.

RSS categories:

- `science_culture`
- `entertainment`
- `art`
- `news`
- `life`

Each RSS source can define:

```json
{
  "name": "Example",
  "category": "art",
  "url": "https://example.com/feed/",
  "alternateUrls": ["https://example.com/feed", "https://example.com/rss"],
  "enabled": true,
  "fetchStrategy": "default",
  "moodBias": {
    "clarity": 4,
    "desire": 2
  }
}
```

- `fetchStrategy: "default"` tries the normal feed request first.
- `fetchStrategy: "browser_headers"` still avoids scraping or challenge bypassing, but makes the browser-like header retry more explicit for sources that often block simple fetches.
- `alternateUrls` lets WordPress-style feeds try `/feed`, `/rss`, or `/feed.xml` variants before giving up.

RSS fetching is intentionally polite: it follows redirects, uses timeouts, limits items per source, and fetches with small concurrency. If a source returns `401`, `403`, `406`, or `429`, UCU BEDEN retries with browser-like RSS headers. If it is still blocked, that source is marked in health data and ignored by mood generation for that day.

Daily source JSON includes `rssHealth` and per-source health rows under `rss.sources`. Possible statuses include `ok`, `empty`, `blocked_403`, `rate_limited_429`, `not_found_404`, `timeout`, `parse_error`, and `failed`.

The `/sources/health` page shows source name, category, status, item count, last check time, used URL, and any short error message. Cloudflare or bot-protection challenges are not bypassed; the system only tries browser-like headers, alternate feed URLs, and graceful fallback.

The `/mood-map` page visualizes successful RSS items as mood-colored dots. Blocked or failed sources do not appear as dots, but remain visible in `/sources/health`. Missing APIs or failing RSS feeds fall back to local mock summaries without breaking generation.

Source digestion adds a learning layer on top of raw RSS/source data:

```bash
npm run digest:sources
npm run digest:sources -- --date YYYY-MM-DD
npm run digest:sources -- --date YYYY-MM-DD --force
```

Digest records are stored in `data/source_digests/YYYY-MM-DD.json`. They separate `private_factual_digest` from `public_poetic_digest`. Private digest may keep raw titles, URLs, source names, categories, entities, and health for audit. Public digest is the only layer allowed into poem/dream generation; it contains safe Turkish vocabulary candidates, conceptual drifts, aesthetic cues, rhythm cues, attention shifts, image expansion candidates, sentence moves, rejected unsafe terms, and do-not-surface terms.

If OpenAI is unavailable, deterministic digestion still creates varied category-aware cues. Prompt builders use digest-derived source influence when available and fall back to deterministic source influence packets otherwise.

## GitHub Actions And Pages

`.github/workflows/daily-poem-and-deploy.yml` targets `05:07 UTC`, which is `08:07 Europe/Istanbul`.

`.github/workflows/night-dream-and-deploy.yml` targets `05:37 UTC`, which is `08:37 Europe/Istanbul`, after the morning poem has had time to finish. GitHub schedules are best-effort and can arrive late; duplicate-safe generation prevents scheduled or manual runs from rewriting existing content unless `--force` or `force_regenerate` is explicitly used.

Both workflows log UTC time, Europe/Istanbul time, local generation date, target local time, and the incoming `github.event.schedule`.

For project pages under a repository subpath, set `NEXT_PUBLIC_BASE_PATH` in the workflow or repository variables.

## Future Ideas

- embeddings for memory retrieval,
- richer RSS collectors,
- admin-only regeneration controls,
- hand-edited yearly annotations,
- stronger LLM schema validation.
