# UCU BEDEN

UCU BEDEN is a local-first poetic archive and daily generation system for a digital poet that ages, remembers, walks, forgets, and changes through its own writing.

It is not a generic poem generator. User poems placed in `poems_input/` become genetic memory. Generated poems in `data/generated_poems/` become lived memory. Weather, Turkish news, art sources, home state, walking state, recurring words, avoided words, and yearly reports influence the next poem without becoming direct news summaries.

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` if you want live services.

```txt
OPENAI_API_KEY=
OPENAI_MODEL=
NEWS_API_KEY=
WEATHER_API_KEY=
NEXT_PUBLIC_BASE_PATH=
```

If keys are missing, UCU BEDEN keeps working with deterministic mock sources and a mock poem generator.

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
- creates mood, daily life, and walking state,
- recalls at least one memory,
- writes `data/generated_poems/YYYY-MM-DD.json`,
- updates state, vocabulary memory, image mutations, and yearly reports.

Force regeneration:

```bash
npm run generate:today -- --force
```

## UI

```bash
npm run dev
```

The home page shows the latest poem, age, mood sentence, current home/walk state, influences, and a timeline. Additional pages:

- `/archive`
- `/memory`
- `/sources`
- `/mood-map`
- `/settings`
- `/poem/YYYY-MM-DD`

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

Memory is file-based for the MVP:

- recent poems,
- word frequencies,
- repeated images,
- avoided or forgotten words,
- home and walk memory,
- input poem analysis,
- yearly reports.

Old lines are not copied into new poems. Images and rhythms can return as mutations.

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

## GitHub Actions And Pages

`.github/workflows/daily-poem-and-deploy.yml` runs at `06:17 UTC`, which is `09:17 Europe/Istanbul`, with backup runs at `06:47 UTC` / `09:47 Europe/Istanbul` and `07:10 UTC` / `10:10 Europe/Istanbul`. GitHub can delay or drop schedules at the top of the hour, so the workflow avoids exact hour marks. The same workflow also runs on normal pushes to `main`, except data-only commits, so site updates deploy without waiting for cron. It generates the daily poem, commits data changes when needed, builds the static site, and deploys to GitHub Pages.

For project pages under a repository subpath, set `NEXT_PUBLIC_BASE_PATH` in the workflow or repository variables.

## Future Ideas

- embeddings for memory retrieval,
- richer RSS collectors,
- admin-only regeneration controls,
- visual memory maps,
- hand-edited yearly annotations,
- stronger LLM schema validation.
