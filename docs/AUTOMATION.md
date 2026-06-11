# Automation

UCU BEDEN is designed to run locally and on GitHub Actions.

## Morning Time

The morning record targets 08:00 Europe/Istanbul.

GitHub cron uses UTC, and Turkey is UTC+3 year-round:

```yaml
cron: "0 5 * * *"  # 08:00 Europe/Istanbul
cron: "23 5 * * *" # 08:23 Europe/Istanbul backup
```

The morning workflow writes daily life, poem, poem visual metadata, sources, and updated memory. If the first run works, the backup sees that the day already exists and skips duplicate generation.

The workflow also runs on normal pushes to `main`, except data-only commits. This lets code, theme, and documentation updates deploy immediately without creating a data commit loop.

## Night Time

The night workflow targets 02:00 Europe/Istanbul:

```yaml
cron: "0 23 * * *"  # 02:00 Europe/Istanbul on the next day
cron: "27 23 * * *" # 02:27 Europe/Istanbul backup
```

By default the night script dreams from the completed previous Istanbul calendar day. This guarantees that its poem and daily life record already exist.

GitHub scheduled workflows are best-effort and may start late. The backup schedules and safe skip behavior improve reliability without creating duplicate poems or dreams.

## Commands

```bash
npm ci
npm run generate:today
npm run generate:dream
npm run build
```

`npm run generate:today` skips if `data/generated_poems/YYYY-MM-DD.json` already exists.

Use a manual override only when you intentionally want to rewrite the current day:

```bash
npm run generate:today -- --force
```

GitHub Actions manual runs expose the same behavior through the `force_regenerate` checkbox. Leave `target_date` empty to use the current Istanbul date.

The night workflow's empty `target_date` means the previous completed Istanbul day.

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
poem
poem_visual_prompt
dream
dream_visual_prompt
memory
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
data/settings/
data/analysis/
data/yearly_reports/
```

If no files changed, commit is skipped.

## Visual Fallback And Current State

Visual metadata contains prompts and a deterministic fallback palette/seed. A real image provider can later fill `image_path`; until then the site renders a lo-fi visual record from metadata.

The current state panel uses the latest `data/daily_life/YYYY-MM-DD.json` schedule and the current Europe/Istanbul time in the visitor's browser. Because the site is a static export, new daily data becomes public after the workflow rebuilds and deploys the site.
