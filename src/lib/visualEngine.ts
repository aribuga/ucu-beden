import { hashSeed, seededMany } from "./random";
import { buildCompactPoemVisualPrompt } from "./compactCreativePrompt";
import { generateVisualBriefWithLLM, recentPoemVisualBriefs } from "./visualBriefGenerator";
import type { DailyPoem, DreamRecord, VisualBrief, VisualBriefGenerationMeta, VisualMetadata } from "./types";

const styleTags = [
  "airbrush",
  "soft blur",
  "low-resolution",
  "dreamy haze",
  "grainy texture",
  "color bleeding",
  "scan noise",
  "compression artifacts",
  "old digital wallpaper"
];

const palettes: Array<[string, string, string]> = [
  ["#ef6fb1", "#7bd5c7", "#172b5b"],
  ["#f5d45f", "#c56ecf", "#15385f"],
  ["#f19aa8", "#74b7d5", "#483d78"],
  ["#79c8aa", "#f0a3d3", "#152b38"],
  ["#cf7ac8", "#8dd3e7", "#4b315f"]
];

const negativePrompt =
  "ultra sharp commercial illustration, clean corporate design, stock photo, sterile SaaS UI, glossy modern AI art, detailed 3D render, photorealism, literal scene, literal room scene, recognizable couch, recognizable bed, literal table, literal window, literal carpet, literal street scene, literal park scene, apartment interior scene, human silhouette, person silhouette, standing figure, face, portrait, humanoid figure, body outline, text, typography, letters, words, captions, subtitles, handwriting, signage, labels, logos, watermarks, blank image, empty gradient, plain background, featureless image, smooth gradient only, empty color field";

function poemVisualMetadata(
  poem: DailyPoem,
  visualBrief: VisualBrief | null,
  visualBriefGeneration: VisualBriefGenerationMeta | null
): VisualMetadata {
  const palette = palettes[hashSeed(`${poem.date}:poem-visual`) % palettes.length];
  return {
    date: poem.date,
    type: "poem",
    aspect_ratio: "4:5",
    source_id: poem.date,
    title: poem.title,
    generated_at: new Date().toISOString(),
    visual_prompt: buildCompactPoemVisualPrompt(poem, visualBrief),
    negative_prompt: negativePrompt,
    alt_text: `${poem.title} şiirinin duygusal iklimini ve hafıza basıncını taşıyan soyut lo-fi görsel.`,
    image_path: null,
    provider: "metadata-fallback",
    model: null,
    size: "1024x1280",
    quality: "low",
    output_format: "png",
    fallback: true,
    error: null,
    visual_brief: visualBrief,
    visual_brief_generation: visualBriefGeneration,
    style_tags: styleTags,
    fallback_palette: palette,
    fallback_seed: hashSeed(`${poem.date}:poem-visual`)
  };
}

export function createPoemVisualFallback(poem: DailyPoem): VisualMetadata {
  return poemVisualMetadata(poem, null, null);
}

export async function createPoemVisual(poem: DailyPoem): Promise<VisualMetadata> {
  const recentBriefs = await recentPoemVisualBriefs(poem.date);
  const result = await generateVisualBriefWithLLM({
    date: poem.date,
    poemText: poem.poem_text,
    title: poem.title,
    mood: poem.mood,
    mood_sentence: poem.mood_sentence,
    daily_life: poem.daily_life,
    memory_fragments: poem.memory_fragments,
    memory_selection: poem.memory_selection,
    source_influences: poem.influences,
    sources: poem.sources,
    recent_visual_briefs: recentBriefs
  });
  return poemVisualMetadata(poem, result.brief, result.generation);
}

export function createDreamVisual(dream: DreamRecord): VisualMetadata {
  const palette = palettes[hashSeed(`${dream.date}:dream-visual`) % palettes.length];
  const symbols = seededMany(dream.symbols, `${dream.date}:dream-symbols`, 5);
  return {
    date: dream.date,
    type: "dream",
    aspect_ratio: "4:5",
    source_id: dream.source_date,
    title: dream.title,
    generated_at: new Date().toISOString(),
    visual_prompt: `4:5 portrait aspect ratio; UCU BEDEN dream recorder residue; broken symbolic traces of ${symbols.join(", ") || "a misplaced domestic object"}; unstable subconscious composition, fragmentary airbrush haze, low quality old digital wallpaper, soft blur, chromatic bleeding, scan noise, emotionally correct but logically impossible; no writing, no letters, no readable marks; keep the frame filled with abstract non-text forms and tactile visual noise`,
    negative_prompt: negativePrompt,
    alt_text: `${dream.title} rüyasından ${symbols.slice(0, 3).join(", ") || "kırık semboller"} taşıyan bulanık kayıt.`,
    image_path: null,
    provider: "metadata-fallback",
    model: null,
    size: "1024x1280",
    quality: "low",
    output_format: "png",
    fallback: true,
    error: null,
    style_tags: [...styleTags, "fragmentary", "subconscious"],
    fallback_palette: palette,
    fallback_seed: hashSeed(`${dream.date}:dream-visual`)
  };
}
