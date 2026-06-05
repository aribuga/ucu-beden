# Automation

UCU BEDEN is designed to run locally and on GitHub Actions.

## Daily Time

The daily poem should be generated around 09:17 Europe/Istanbul, with 09:47 and 10:10 backups.

GitHub cron uses UTC, and Turkey is UTC+3. GitHub can delay or drop schedules at the top of the hour, so the workflow avoids 09:00 exactly:

```yaml
cron: "17 6 * * *" # 09:17 Europe/Istanbul
cron: "47 6 * * *" # 09:47 Europe/Istanbul backup
cron: "10 7 * * *" # 10:10 Europe/Istanbul backup
```

If the first run works, the backups see that today's poem already exists and skip generation.

## Commands

```bash
npm ci
npm run generate:today
npm run build
```

`npm run generate:today` skips if `data/generated_poems/YYYY-MM-DD.json` already exists.

Use a manual override only when you intentionally want to rewrite the current day:

```bash
npm run generate:today -- --force
```

GitHub Actions manual runs expose the same behavior through the `force_regenerate` checkbox. Leave `target_date` empty to use the current Istanbul date.

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
data/state/
data/sources/
data/settings/
data/analysis/
data/yearly_reports/
```

If no files changed, commit is skipped.
