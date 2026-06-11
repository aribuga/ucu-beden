# Archive Day Panels And Dreams

The home page and poem detail routes use `resolvePoemDayView` from `src/lib/dayView.ts`.

For a selected poem date it resolves:

- the stored daily-life record, or a graceful reconstructed fallback,
- that date's poem visual metadata,
- a dream whose `source_date` or `date` matches the poem date,
- the matching dream visual metadata.

On today's page, current state and the day-cycle use live Istanbul time. On historical poem pages, the panel title changes to `o günkü hâli` and the day-cycle displays the recorded generation time instead of pretending the old day is happening now.

## Dreams Archive

`/dreams` reads all JSON records from `data/dreams/`, displays their matching `data/visuals/YYYY-MM-DD-dream.json` visual, and falls back to generated metadata when a visual record is missing.

`/dreams/YYYY-MM-DD` displays the full dream, symbols, visual, generation time, and a link to the source poem when it exists.

## Historical Image Backfill

With `OPENAI_API_KEY` configured:

```bash
npm run backfill:visuals
npm run backfill:visuals -- --from=2026-06-01 --to=2026-06-11
npm run backfill:visuals -- --images-only
npm run backfill:visuals -- --force --limit=2 --delay-ms=2000
```

The default command scans every poem and dream, creates missing metadata, generates missing real images, and preserves existing OpenAI images. Failures are recorded per date while later dates continue. The final log lists generated, skipped, and failed poem/dream dates.
