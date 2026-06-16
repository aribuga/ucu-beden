# Phone And Visual Memory Map

This document covers the two non-dashboard memory experiences: `/phone` and `/memory-map`.

## `/phone`

`/phone` is a separate UCU BEDEN device interface. The outer frame is a static asset, but the screen is live HTML/CSS/React.

The phone screen reads existing project data:

- gallery items from generated visual metadata,
- notes from generated poems,
- weather from the latest poem/source bundle,
- memory summary from `data/memory/report.json`,
- age/date/status from state and the latest poem.

The first version includes these apps:

- Galeri,
- Notlar,
- Hava,
- Hafiza,
- Rehber,
- Mesajlar.

Contacts and messages intentionally start with clean empty states. The phone should not invent fake conversations, contacts, or demo records.

Visual assets:

```txt
public/assets/phone-frame.png
public/assets/phone-lock-wallpaper.png
public/assets/phone-glass.png
```

The screen layering is:

1. app UI or lock screen content,
2. subtle CRT/noise/scanline/glow/color separation effects,
3. `phone-glass.png` crack overlay with `pointer-events: none`,
4. phone frame overlay with `pointer-events: none`.

The overlays must not block hover, click, or touch interaction.

## `/memory-map`

`/memory-map` is a visual memory map, separate from `/memory` and `/memory/mutations`.

It uses existing memory, poem, dream, source, and mutation data. It must not create fake/demo graph nodes.

Current view modes:

- focused near field: today's poem, today's dream, related traces, recent mutation/recall relations, and related source effects.
- full memory map: broader memory archive with trace, poem, dream, mutation, source, suppressed, and overexposed nodes.

The map supports:

- pan,
- wheel zoom,
- reset,
- fit to view,
- hover tooltip,
- click detail panel,
- view-mode toggle,
- type/status filters.

Node selection should be single-selection:

```txt
selectedTraceId: string | null
hoveredTraceId: string | null
filter state separate from selection state
```

Only the clicked node should receive the selected state. Filtered or visible nodes should never look selected just because a filter is active. Clicking the background should clear selection.

## Safety

Public UI should show safe trace text, transformed text, public source effects, and report summaries. It should not expose raw source titles, URLs, provider names, private factual digest details, or unsafe source/entity text.

## Smoke Checks

After changing these pages:

```bash
npm run validate:memory
npm run typecheck
npm run build
```

Also inspect:

- `/phone`
- `/memory`
- `/memory/mutations`
- `/memory-map`

with real data and with missing/empty memory data when possible. Empty states should be neutral and should not synthesize fake graph data.
