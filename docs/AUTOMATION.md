# Automation

UCU BEDEN is designed to run locally and on GitHub Actions.

## Morning Time

The morning record targets roughly 08:00 Europe/Istanbul, offset away from the top of the hour.

GitHub cron uses UTC, and Turkey is UTC+3 year-round:

```yaml
# GitHub schedule uses UTC. 05:07 UTC = 08:07 Europe/Istanbul.
cron: "7 5 * * *"
```

The morning workflow writes daily life, sources, source digest, poem, poem visual metadata, memory traces/report, and updated state. It is idempotent: if today's poem already exists, generation is skipped unless force regeneration is explicitly requested.

The workflow also runs on normal pushes to `main`, except data-only commits. This lets code, theme, and documentation updates deploy immediately without creating a data commit loop.

## Dream Time

The dream workflow currently runs after the morning poem, targeting roughly 08:30 Europe/Istanbul:

```yaml
# GitHub schedule uses UTC. 05:37 UTC = 08:37 Europe/Istanbul.
cron: "37 5 * * *"
```

By default the dream script dreams from the current Istanbul day when the workflow runs in the morning, or from a selected `target_date` when manually dispatched. This keeps the dream tied to the poem that has just been generated.

GitHub scheduled workflows are best-effort and may start late. Late starts only produce a warning in the workflow logs; they do not skip generation. Safe skip behavior prevents duplicates unless `--force` or `force_regenerate` is used.

## Commands

```bash
npm ci
npm run generate:today
npm run generate:dream
npm run digest:sources
npm run rebuild:memory
npm run validate:memory
npm run build
```

`npm run generate:today` skips if `data/generated_poems/YYYY-MM-DD.json` already exists.

Use a manual override only when you intentionally want to rewrite the current day:

```bash
npm run generate:today -- --force
```

GitHub Actions manual runs expose the same behavior through the `force_regenerate` checkbox. Leave `target_date` empty to use the current Istanbul date.

The dream workflow's empty `target_date` also means the current Istanbul date.

## Secrets

Optional secrets:

```txt
OPENAI_API_KEY
OPENAI_MODEL
NEWS_API_KEY
WEATHER_API_KEY
```

Missing keys do not stop the workflow. Sources and poems fall back to deterministic mock data.

OpenAI 500/429 responses are retried before falling back to the mock poem generator. Check generated JSON at:

```txt
data/generated_poems/YYYY-MM-DD.json
```

Look for:

```txt
generation.provider
generation.fallback_reason
```

Morning and night logs expose stage names such as:

```txt
daily_life
source_digest
poem
poem_visual_prompt
dream
dream_visual_prompt
memory
```

They also log timing fields:

```txt
run_started_utc
run_started_europe_istanbul
target_local_time
local_generation_date
github.event.schedule
schedule_delay_minutes
```

## Settings

Theme and source settings live in:

```txt
data/settings/site_settings.json
data/settings/rss_sources.json
```

Changing `theme` between `minimal`, `sims2000`, and `fresh90s` changes the visual skin without code changes.

## GitHub Pages

The workflow builds a static Next.js export and deploys the `out/` folder through GitHub Pages.

For repository subpath publishing, set:

```txt
NEXT_PUBLIC_BASE_PATH=/repository-name
```

## Data Commit

After generation, the workflow commits changed files under:

```txt
data/generated_poems/
data/daily_life/
data/dreams/
data/visuals/
data/state/
data/sources/
data/source_digests/
data/memory/
data/settings/
data/analysis/
data/yearly_reports/
public/generated/visuals/
```

If no files changed, commit is skipped.

## Visual Fallback And Current State

Visual metadata contains prompts and a deterministic fallback palette/seed. A real image provider can later fill `image_path`; until then the site renders a lo-fi visual record from metadata.

The current state panel uses the latest `data/daily_life/YYYY-MM-DD.json` schedule and the current Europe/Istanbul time in the visitor's browser. Because the site is a static export, new daily data becomes public after the workflow rebuilds and deploys the site.
