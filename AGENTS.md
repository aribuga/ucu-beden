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
- UCU BEDEN lives in Osmanaga, Kadikoy, in Kirimli Apartmani.
- UCU BEDEN has a 35 m2 1+1 home with a grey couch, blue-figure rug, computer in the living room, and a small bedroom.
- UCU BEDEN often writes poems while walking around Yogurtcu Park and Kalamis Park.
- Walking should influence rhythm, breath, image, and memory.
- The UI should feel like a poetic archive, not a SaaS dashboard.
- The visual design should be basic, minimal, black-and-white, and use Space Mono.

## Engineering principles

- Use TypeScript.
- Use Next.js.
- Keep file-based storage simple and human-readable.
- Make data models explicit.
- Avoid hardcoded API keys.
- Add fallbacks for missing external services.
- Keep functions small and testable.
- Add clear scripts for generation and analysis.
- Do not break existing generated archives.
- Every generation must update memory/state unless generation is skipped because today already exists.
