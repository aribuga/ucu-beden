import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { pathExists, resolvePath } from "./fileStorage";
import type { VisualMetadata } from "./types";

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

const sharedStyle =
  "Airbrush, lo-fi low quality aesthetic, soft blur, dreamy haze, grainy texture, color bleeding, slight chromatic aberration, scan noise, compression artifact feeling, cheap old digital wallpaper, old postcard feeling, low-resolution image enlarged, soft glowing edges, nostalgic, slightly kitsch, poetic and surreal.";

const kindExtensions = {
  poem: "Create an emotional inner image of the poem. More legible than a dream, symbolic but not literal, atmospheric, connected to the poem's mood.",
  dream: "Create abstract subconscious dream residue. Fragmented, unstable, hallucinatory, symbolic, less literal, never a direct illustration."
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
    `Avoid: ${visual.negative_prompt}; no premium concept art, no hyperrealistic render, no text, no typography, no UI mockup inside the image.`,
    "Compose for a 4:5 portrait crop. Keep important visual material away from the extreme top and bottom edges."
  ].join("\n\n");
}

function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function localImagePath(imagePath: string): string {
  return imagePath.replace(/^\/+/, "");
}

async function shouldSkip(visual: VisualMetadata, force: boolean): Promise<boolean> {
  if (force || visual.provider !== "openai" || !visual.image_path) {
    return false;
  }
  return pathExists(`public/${localImagePath(visual.image_path)}`);
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
  if (await shouldSkip(visual, options.force ?? false)) {
    return visual;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const requestedSize = process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1280";
  const apiSize = apiImageSize(requestedSize);
  const quality = imageQuality(process.env.OPENAI_IMAGE_QUALITY);
  const format = imageFormat(process.env.OPENAI_IMAGE_FORMAT);
  const prompt = promptFor(visual);
  const hash = promptHash(prompt);

  if (!apiKey) {
    return {
      ...visual,
      aspect_ratio: "4:5",
      provider: "metadata-fallback",
      model,
      size: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
      api_size: apiSize,
      quality,
      output_format: format,
      prompt_hash: hash,
      fallback: true,
      error: "OPENAI_API_KEY is not configured."
    };
  }

  try {
    const rawImage = await requestImage({ apiKey, model, prompt, size: apiSize, quality, format });
    const fileName = `${visual.date}-${visual.type}.${format}`;
    const publicPath = `/generated/visuals/${fileName}`;
    const diskPath = resolvePath(`public/generated/visuals/${fileName}`);
    await fs.mkdir(path.dirname(diskPath), { recursive: true });
    await sharp(rawImage).resize(FINAL_WIDTH, FINAL_HEIGHT, { fit: "cover", position: "centre" }).toFormat(format).toFile(diskPath);

    return {
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
    };
  } catch (error) {
    return {
      ...visual,
      aspect_ratio: "4:5",
      provider: "metadata-fallback",
      model,
      size: `${FINAL_WIDTH}x${FINAL_HEIGHT}`,
      api_size: apiSize,
      quality,
      output_format: format,
      prompt_hash: hash,
      fallback: true,
      error: shortError(error)
    };
  }
}
