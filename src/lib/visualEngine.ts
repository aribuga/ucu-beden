import { hashSeed, seededMany } from "./random";
import type { DailyPoem, DreamRecord, VisualMetadata } from "./types";

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
  "ultra sharp commercial illustration, clean corporate design, stock photo, sterile SaaS UI, glossy modern AI art, detailed 3D render, photorealism, literal scene";

export function createPoemVisual(poem: DailyPoem): VisualMetadata {
  const images = poem.analysis.new_images.slice(0, 5);
  const palette = palettes[hashSeed(`${poem.date}:poem-visual`) % palettes.length];
  return {
    date: poem.date,
    type: "poem",
    aspect_ratio: "4:5",
    source_id: poem.date,
    title: poem.title,
    generated_at: new Date().toISOString(),
    visual_prompt: `4:5 portrait aspect ratio; UCU BEDEN poem interior screen; emotional pressure of "${poem.title}"; associative traces of ${images.join(", ") || "an almost empty room"}; ${poem.mood_sentence}; soft airbrush, hazy old postcard, low resolution enlarged texture, gentle scan dirt, poetic but inexpensive digital archive, emotionally readable without literal illustration`,
    negative_prompt: negativePrompt,
    alt_text: `${poem.title} şiirinin ${images.slice(0, 3).join(", ") || "bulanık oda"} izlerini taşıyan lo-fi iç ekranı.`,
    image_path: null,
    provider: "metadata-fallback",
    model: null,
    size: "1024x1280",
    quality: "low",
    output_format: "png",
    fallback: true,
    error: null,
    style_tags: styleTags,
    fallback_palette: palette,
    fallback_seed: hashSeed(`${poem.date}:poem-visual`)
  };
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
    visual_prompt: `4:5 portrait aspect ratio; UCU BEDEN dream recorder residue; broken symbolic traces of ${symbols.join(", ") || "a misplaced domestic object"}; unstable subconscious composition, fragmentary airbrush haze, low quality old digital wallpaper, soft blur, chromatic bleeding, scan noise, emotionally correct but logically impossible`,
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
