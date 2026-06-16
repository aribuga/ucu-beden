# Memory Production Checklist

Use this checklist after a new daily poem and its dream have been generated.

## Run

```bash
npm run generate:today
npm run generate:dream
npm run digest:sources
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
- Confirm `surface_validation_passed`, `surface_violations`, `retry_count`, `language_validation_passed`, `english_ratio`, and `language_retry_count` are present on new records.
- Confirm any severe surface/language retry is recorded in metadata rather than hidden.
- Confirm compact prompt debug shows OpenAI received the compact prompt, not the full internal debug sections.

## Source Digestion

- Confirm `data/source_digests/YYYY-MM-DD.json` exists for the latest source day.
- Confirm `private_factual_digest` can keep raw audit data, but `public_poetic_digest` contains only safe Turkish prompt material.
- Confirm `source_influence_packet` exists in the digest and is used by generation when available.
- Confirm raw titles, URLs, source/provider names, entities, and raw source sentences do not appear in public prompt fragments.
- Confirm `repeated_abstract_terms` and `do_not_surface_terms` are populated when recent poems overuse abstract or source-derived language.

## Dream And Recall

- Confirm the latest dream has the complete `memory_selection` fields.
- Confirm dream mode selects more suppressed traces than poem mode when suppressed traces are available.
- Confirm dream-selected suppressed traces receive dream-return recall metadata.
- Confirm the dream trace and returned suppressed traces are linked after `rebuild:memory`.

## Report And Graph

- Confirm `data/memory/report.json` reflects the latest recall and dream-return state.
- Confirm `/memory` renders the report and does not fall back to legacy state.
- Confirm `/memory/mutations` renders real trace nodes and links.
- Confirm `/memory-map` renders both the focused near-field view and the full memory view without fake/demo nodes.
- Confirm graph node and edge contribution from the latest cycle is visible in `debug:latest-memory`.
- Confirm neither page exposes unsafe raw source text.

## Phone Smoke Check

- Confirm `/phone` loads the device frame and live HTML/CSS screen.
- Confirm gallery and notes are populated from existing generated visual/poem data.
- Confirm contacts and messages use clean empty states.
- Confirm the phone memory app uses the memory report and does not expose private source data.

## Final Checks

```bash
npm run debug:latest-memory
npm run validate:memory
npm run typecheck
npm run build
```

All commands should complete without unresolved trace IDs, unsafe prompt fragments, invalid dream-return links, invalid source digest separation, non-Turkish public digest values, or generation-time overexposed direct recalls.
