# Memory And Source System

This document describes the current UCU BEDEN memory/source loop after the trace-memory and source-digestion refactors.

## Memory Trace Storage

Generated memory data lives under:

```txt
data/memory/traces/YYYY-MM-DD.json
data/memory/index.json
data/memory/report.json
```

Trace records are deterministic and rebuildable from existing poems, dreams, daily-life records, sources, and source digests. Rebuilding memory should not rewrite historical poem or dream JSON unless a generation command explicitly does that.

Useful commands:

```bash
npm run rebuild:memory
npm run validate:memory
npm run debug:memory-cycle
npm run debug:latest-memory
```

## Trace Behavior

Memory traces can be active, dim, suppressed, fossilized, overexposed, or unstable. They can be recalled directly, recalled indirectly, linked to dream returns, or pushed out of the prompt when overexposed.

Generation uses `selectMemoryForGeneration(...)` to choose a compact set of traces. It stores:

```txt
selected_trace_ids
direct_trace_ids
indirect_trace_ids
suppressed_trace_ids
memory_prompt_fragments
```

Successful poem/dream generation updates recall metadata and report output. Historical selections should not fail validation just because a trace later became overexposed; current overexposure is temporal and should be treated as a warning for old records.

## Source Digestion

Raw source records are stored in:

```txt
data/sources/YYYY-MM-DD.json
```

Digest records are stored in:

```txt
data/source_digests/YYYY-MM-DD.json
```

Run digestion manually with:

```bash
npm run digest:sources
npm run digest:sources -- --date YYYY-MM-DD
npm run digest:sources -- --date YYYY-MM-DD --force
```

The digest separates:

- `private_factual_digest`: raw audit layer; can contain title, URL, source name, category, factual summary, detected entities, topics, and source health.
- `public_poetic_digest`: safe prompt layer; contains Turkish vocabulary candidates, conceptual drifts, aesthetic cues, rhythm cues, attention shifts, image expansion candidates, sentence moves, rejected unsafe terms, and do-not-surface terms.

Only `public_poetic_digest` and digest-derived `source_influence_packet` may influence poem/dream prompts.

## Prompt Safety

OpenAI poem/dream prompts should receive compact creative briefs, not raw system internals. Keep these out of model input:

- raw RSS titles,
- URLs,
- provider/source names,
- people, institutions, countries, and detected entities,
- raw source sentences,
- full memory stores,
- raw daily-life or walk JSON,
- long debug reports,
- count/score-heavy technical packets.

The compact prompt should include only:

- a short UCU BEDEN voice note,
- today's inner state,
- 2-4 memory residue lines,
- 2-4 source effect lines,
- a short avoid list,
- a short style note,
- JSON output shape.

## Validators

Validation covers:

- unresolved selected trace IDs,
- unsafe memory prompt fragments,
- unsafe public source digest values,
- private/public source separation,
- non-Turkish public digest values,
- language metadata on generated poems/dreams,
- surface validation metadata,
- dream-return link validity,
- overexposed direct recall at generation time.

`npm run validate:memory` is read-only because it calls `rebuild:memory --dry-run --validate`.
