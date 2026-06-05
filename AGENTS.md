# UCU BEDEN - Codex Instructions

This project is a local-first poetic archive and daily generation system for a digital poet named UCU BEDEN.

## Product principles

- Treat UCU BEDEN as a living poetic organism, not a generic poem generator.
- Do not hardcode life stages.
- The poet ages by 1 month per generated day.
- Every 12 generated days equals 1 year.
- Yearly reports must emerge from generated history, not predefined stages.
- User-provided poems in poems_input/ are genetic memory.
- UCU BEDEN's generated poems are lived memory.
- Never overwrite or mutate user input poems.
- Never copy full lines from input poems into generated poems.
- Old poems should influence new poems as memory, but never as direct copy.
- UCU BEDEN may remember its old poems correctly, partially, or incorrectly.
- External sources should influence atmosphere, not create news summaries.
- RSS source items should be mood-tagged and used as pressure, atmosphere, image field, and walking rhythm.
- Hidden voice traits live in `data/settings/personality_settings.json`; they may shape poem generation, but should not be surfaced as public UI copy.
- UCU BEDEN's hidden voice may carry dry sarcasm, absurd domestic humor, panic-comedy, and a small sentimental leak; keep it subtle, object-based, and never a stand-up punchline.
- UCU BEDEN lives around Osmanaga, Kadikoy.
- UCU BEDEN has a 35 m2 1+1 home with a grey couch, blue-figure rug, computer in the living room, and a small bedroom.
- UCU BEDEN often writes poems while walking around Yogurtcu Park and Kalamis Park.
- Walking should influence rhythm, breath, image, and memory.
- The UI should feel like a poetic archive, not a SaaS dashboard.
- The `minimal` theme should preserve the basic black-and-white Space Mono archive feel.
- The `sims2000` theme is an experimental life-sim/old-computer skin and must keep poems readable.
- Active theme is controlled by `data/settings/site_settings.json`, not code changes.
- Logo assets in `public/` should be used as provided and not optimized destructively.

## Engineering principles

- Use TypeScript.
- Use Next.js.
- Keep file-based storage simple and human-readable.
- Make data models explicit.
- Avoid hardcoded API keys.
- Add fallbacks for missing external services.
- Keep RSS sources configurable through `data/settings/rss_sources.json`.
- OpenAI transient failures should retry before falling back to mock generation.
- Keep functions small and testable.
- Add clear scripts for generation and analysis.
- Do not break existing generated archives.
- Every generation must update memory/state unless generation is skipped because today already exists.
