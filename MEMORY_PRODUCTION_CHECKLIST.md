# Memory Production Checklist

Use this checklist after a new daily poem and its dream have been generated.

## Run

```bash
npm run generate:today
npm run generate:dream
npm run rebuild:memory
npm run debug:latest-memory
npm run validate:memory
```

`debug:latest-memory` and `validate:memory` are read-only. Historical poem, dream, and state files must remain unchanged unless a generation command was explicitly run.

## Poem Metadata

- Confirm the latest generated poem has `memory_selection`.
- Confirm `selected_trace_ids`, `direct_trace_ids`, `indirect_trace_ids`, `suppressed_trace_ids`, and `memory_prompt_fragments` are present.
- Confirm every selected trace ID resolves inside `data/memory/traces/`.
- Confirm the prompt guard reports no unsafe memory fragments.
- Confirm selected traces have recall metadata after `rebuild:memory`.

## Dream And Recall

- Confirm the latest dream has the complete `memory_selection` fields.
- Confirm dream mode selects more suppressed traces than poem mode when suppressed traces are available.
- Confirm dream-selected suppressed traces receive dream-return recall metadata.
- Confirm the dream trace and returned suppressed traces are linked after `rebuild:memory`.

## Report And Graph

- Confirm `data/memory/report.json` reflects the latest recall and dream-return state.
- Confirm `/memory` renders the report and does not fall back to legacy state.
- Confirm `/memory/mutations` renders real trace nodes and links.
- Confirm graph node and edge contribution from the latest cycle is visible in `debug:latest-memory`.
- Confirm neither page exposes unsafe raw source text.

## Final Checks

```bash
npm run debug:latest-memory
npm run validate:memory
npm run typecheck
npm run build
```

All commands should complete without unresolved trace IDs, unsafe prompt fragments, invalid dream-return links, or overexposed direct recalls.
