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

The world file lives at `data/world/ucu_beden_world.json`. UCU BEDEN lives in a 35 m2 1+1 home in Kirimli Apartmani, Osmanaga, Kadikoy. The living room has a grey couch, a blue-figure rug, a computer, and a small kitchen area.

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
- `/settings`
- `/poem/YYYY-MM-DD`

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

The source collector is adapter-shaped. Open-Meteo can be used for weather. News and art sources can be replaced with RSS or API-backed collectors. Missing APIs fall back to local mock summaries.

## GitHub Actions And Pages

`.github/workflows/daily-poem-and-deploy.yml` runs at `06:00 UTC`, which is `09:00 Europe/Istanbul`, generates the daily poem, commits data changes when needed, builds the static site, and deploys to GitHub Pages.

For project pages under a repository subpath, set `NEXT_PUBLIC_BASE_PATH` in the workflow or repository variables.

## Future Ideas

- embeddings for memory retrieval,
- richer RSS collectors,
- admin-only regeneration controls,
- visual memory maps,
- hand-edited yearly annotations,
- stronger LLM schema validation.
