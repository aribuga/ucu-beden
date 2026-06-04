# Automation

UCU BEDEN is designed to run locally and on GitHub Actions.

## Daily Time

The daily poem should be generated at 09:00 Europe/Istanbul.

GitHub cron uses UTC, and Turkey is UTC+3, so the workflow runs at:

```yaml
cron: "0 6 * * *"
```

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

## Secrets

Optional secrets:

```txt
OPENAI_API_KEY
OPENAI_MODEL
NEWS_API_KEY
WEATHER_API_KEY
```

Missing keys do not stop the workflow. Sources and poems fall back to deterministic mock data.

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
data/analysis/
data/yearly_reports/
```

If no files changed, commit is skipped.
