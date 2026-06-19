import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { resolvePath } from "./fileStorage";
import type { VisualMetadata } from "./types";
import {
  inspectVisualImageFile,
  inspectVisualImagePath,
  publicVisualImagePath,
  type VisualImageInspection,
  type VisualMetadataWithImageStatus,
  visualImageIsUsable
} from "./visualFileStatus";

type ImageFormat = "png" | "webp" | "jpeg";
type ImageQuality = "low" | "medium" | "high";
type OpenAIImageSize = "1024x1024" | "1024x1536" | "1536x1024";

type GenerateVisualOptions = {
  force?: boolean;
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

const API_URL = "https://api.openai.com/v1/images/generations";
const FINAL_WIDTH = 1024;
const FINAL_HEIGHT = 1280;
const RETRY_DELAYS_MS = [1_000, 3_000];
const DEFAULT_VALIDATION_ATTEMPTS = 3;

const sharedStyle =
  "Airbrush, lo-fi low quality aesthetic, grainy texture, color bleeding, slight chromatic aberration, scan noise, compression artifact feeling, cheap old digital wallpaper, old postcard feeling, low-resolution image enlarged, soft glowing edges, nostalgic, slightly kitsch, poetic and surreal. Keep recognizable abstract forms and foreground shapes; do not let blur erase the composition.";

const kindExtensions = {
  poem: "Create a full-frame abstract collage for the poem. Do not illustrate the poem's objects literally; translate mood, memory pressure, rhythm, and attention shifts into visible non-text forms, color blocks, shadows, stains, and movement.",
  dream: "Create full-frame abstract subconscious dream residue. Fragmented, unstable, hallucinatory, symbolic, less literal, never a direct illustration, but still filled with distinct non-text forms."
} as const;

function imageFormat(value: string | undefined): ImageFormat {
  return value === "webp" || value === "jpeg" ? value : "png";
}

function imageQuality(value: string | undefined): ImageQuality {
  return value === "medium" || value === "high" ? value : "low";
}

function apiImageSize(value: string | undefined): OpenAIImageSize {
  if (value === "1024x1024" || value === "1536x1024") {
    return value;
  }
  return "1024x1536";
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function promptFor(visual: VisualMetadata): string {
  return [
    visual.visual_prompt,
    kindExtensions[visual.type],
    sharedStyle,
    "Absolute image rule: no visible text of any kind. Do not render letters, words, captions, subtitles, handwriting, signage, labels, logos, watermarks, UI text, or fake alphabets.",
    "Technical visibility rule: the final image must be fully opaque and visibly filled. Do not create transparent pixels, alpha masks, empty gradients, or a nearly blank background.",
    "Mandatory composition rule: include at least four distinct non-text visual elements, such as a dark soft-edged silhouette, a wave-like or spiral form, torn color blocks, stained paper texture, scratch/noise patterns, shadow layers, or glowing non-letter marks. The image should be visibly composed, not just a smooth background.",
    `Avoid: ${visual.negative_prompt}; no premium concept art, no hyperrealistic render, no text, no typography, no UI mockup inside the image.`,
    "Compose for a 4:5 portrait crop. Keep important visual material away from the extreme top and bottom edges."
  ].join("\n\n");
}

function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function withImageStatus(visual: VisualMetadata, image_status: VisualMetadataWithImageStatus["image_status"]): VisualMetadata {
  return { ...visual, image_status } as VisualMetadataWithImageStatus;
}

async function shouldSkip(visual: VisualMetadata, force: boolean): Promise<boolean> {
  if (force || !visual.image_path) {
    return false;
  }
  return visualImageIsUsable(visual);
}

function validationAttempts(): number {
  const parsed = Number(process.env.OPENAI_IMAGE_VALIDATION_ATTEMPTS);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(1, Math.floor(parsed))) : DEFAULT_VALIDATION_ATTEMPTS;
}

function inspectionSummary(inspection: VisualImageInspection): string {
  return [
    inspection.reason ?? "unknown_image_validation_failure",
    inspection.alpha_mean === undefined ? null : `alpha_mean=${inspection.alpha_mean}`,
    inspection.transparent_ratio === undefined ? null : `transparent_ratio=${inspection.transparent_ratio}`,
    inspection.luminance_stddev === undefined ? null : `luminance_stddev=${inspection.luminance_stddev}`,
    inspection.edge_score === undefined ? null : `edge_score=${inspection.edge_score}`,
    inspection.strong_edge_ratio === undefined ? null : `strong_edge_ratio=${inspection.strong_edge_ratio}`,
    inspection.entropy === undefined ? null : `entropy=${inspection.entropy}`
  ]
    .filter(Boolean)
    .join("; ");
}

async function opaqueImagePipeline(rawImage: Buffer): Promise<sharp.Sharp> {
  const metadata = await sharp(rawImage).metadata();
  if (!metadata.hasAlpha) {
    return sharp(rawImage).removeAlpha();
  }

  const { data, info } = await sharp(rawImage).raw().toBuffer({ resolveWithObject: true });
  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let source = 0, target = 0; source < data.length; source += info.channels, target += 3) {
    if (info.channels === 1) {
      rgb[target] = data[source];
      rgb[target + 1] = data[source];
      rgb[target + 2] = data[source];
    } else if (info.channels === 2) {
      rgb[target] = data[source];
      rgb[target + 1] = data[source];
      rgb[target + 2] = data[source];
    } else {
      rgb[target] = data[source];
      rgb[target + 1] = data[source + 1];
      rgb[target + 2] = data[source + 2];
    }
  }
  return sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } });
}

async function writeOpaqueGeneratedImage(rawImage: Buffer): Promise<void> {
  const pipeline = await opaqueImagePipeline(rawImage);
  await pipeline
    .resize(FINAL_WIDTH, FINAL_HEIGHT, { fit: "cover", position: "centre" })
    .toFormat(format)
    .toFile(diskPath);
}

async function requestImage(args: {
  apiKey: string;
  model: string;
  prompt: string;
  size: OpenAIImageSize;
  quality: ImageQuality;
  format: ImageFormat;
}): Promise<Buffer> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: args.model,
        prompt: args.prompt,
        n: 1,
        size: args.size,
        quality: args.quality,
        output_format: args.format
      })
    });
    const body = (await response.json()) as OpenAIImageResponse;
    const encoded = body.data?.[0]?.b64_json;
    if (response.ok && encoded) {
      return Buffer.from(encoded, "base64");
    }

    const message = body.error?.message ?? `OpenAI image generation returned ${response.status}`;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === RETRY_DELAYS_MS.length) {
      throw new Error(message);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error("OpenAI image generation ended without an image.");
}

export async function generateVisualImage(
  visual: VisualMetadata,
  options: GenerateVisualOptions = {}
): Promise<VisualMetadata> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const requestedSize = process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1280";
  const apiSize = apiImageSize(requestedSize);
  const quality = imageQuality(process.env.OPENAI_IMAGE_QUALITY);
  const format = imageFormat(process.env.OPENAI_IMAGE_FORMAT);
  const prompt = promptFor(visual);
  const hash = promptHash(prompt);

  if (await shouldSkip(visual, options.force ?? false)) {
    return withImageStatus({ ...visual, fallback: false, error: null, prompt_hash: hash }, "ready");
  }

  const staleInspection = visual.image_path ? await inspectVisualImagePath(visual.image_path) : null;
  const staleImageIssue = staleInspection && !staleInspection.usable ? inspectionSummary(staleInspection) : null;

  if (!apiKey) {
    return withImageStatus({
      ...visual,
      aspect_ratio: "4:5",
      image_path: null,
      provider: "metadata-fallback",
      model,
      size: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
      api_size: apiSize,
      quality,
      output_format: format,
      prompt_hash: hash,
      fallback: true,
      error: staleImageIssue
        ? `OPENAI_API_KEY is not configured and stored image is not usable: ${staleImageIssue}`
        : "OPENAI_API_KEY is not configured."
    }, "failed");
  }

  try {
    const fileName = `${visual.date}-${visual.type}.${format}`;
    const publicPath = publicVisualImagePath(visual.date, visual.type, format);
    const diskPath = resolvePath(`public/generated/visuals/${fileName}`);
    await fs.mkdir(path.dirname(diskPath), { recursive: true });

    let lastInspection: VisualImageInspection | null = null;
    const attempts = validationAttempts();
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const rawImage = await requestImage({ apiKey, model, prompt, size: apiSize, quality, format });
      const tempPath = `${diskPath}.tmp-${process.pid}-${Date.now()}-${attempt}.${format}`;
      await writeOpaqueGeneratedImage(rawImage, tempPath, format);
      const inspection = await inspectVisualImageFile(tempPath);
      if (inspection.usable) {
        await fs.rename(tempPath, diskPath);
        lastInspection = inspection;
        break;
      }
      lastInspection = inspection;
      await fs.rm(tempPath, { force: true });
      console.log(
        JSON.stringify({
          stage: "visual_image_validation",
          status: "failed",
          date: visual.date,
          type: visual.type,
          attempt,
          attempts,
          reason: inspection.reason,
          alpha_mean: inspection.alpha_mean,
          transparent_ratio: inspection.transparent_ratio,
          luminance_stddev: inspection.luminance_stddev,
          edge_score: inspection.edge_score,
          strong_edge_ratio: inspection.strong_edge_ratio,
          entropy: inspection.entropy
        })
      );
    }

    if (!lastInspection?.usable) {
      throw new Error(`Generated image failed validation after ${attempts} attempt(s): ${lastInspection ? inspectionSummary(lastInspection) : "no inspection result"}`);
    }

    return withImageStatus({
      ...visual,
      aspect_ratio: "4:5",
      generated_at: new Date().toISOString(),
      image_path: publicPath,
      provider: "openai",
      model,
      size: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
      api_size: apiSize,
      quality,
      output_format: format,
      prompt_hash: hash,
      fallback: false,
      error: null
    }, "ready");
  } catch (error) {
    return withImageStatus({
      ...visual,
      aspect_ratio: "4:5",
      image_path: null,
      provider: "metadata-fallback",
      model,
      size: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
      api_size: apiSize,
      quality,
      output_format: format,
      prompt_hash: hash,
      fallback: true,
      error: staleImageIssue
        ? `${shortError(error)}; stored image is not usable: ${staleImageIssue}`
        : shortError(error)
    }, "failed");
  }
}
