import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { pathExists, resolvePath } from "./fileStorage";
import type { VisualKind, VisualMetadata } from "./types";

const imageFormats = ["png", "webp", "jpeg"] as const;
const inspectionWidth = 128;
const inspectionHeight = 160;

export type VisualImageFormat = (typeof imageFormats)[number];
export type VisualImageStatus = "missing" | "ready" | "failed";
export type VisualMetadataWithImageStatus = VisualMetadata & { image_status?: VisualImageStatus };
export type VisualImageInspection = {
  exists: boolean;
  usable: boolean;
  reason: string | null;
  alpha_mean?: number;
  transparent_ratio?: number;
  luminance_stddev?: number;
  edge_score?: number;
  strong_edge_ratio?: number;
  entropy?: number;
};

export function visualImageStatus(visual: VisualMetadata): VisualImageStatus | null {
  return (visual as VisualMetadataWithImageStatus).image_status ?? null;
}

function withImageStatus(visual: VisualMetadata, image_status: VisualImageStatus): VisualMetadata {
  return { ...visual, image_status } as VisualMetadataWithImageStatus;
}

export function publicVisualImagePath(date: string, type: VisualKind, format: VisualImageFormat = "png"): string {
  return `/generated/visuals/${date}-${type}.${format}`;
}

export function publicPathToDiskPath(imagePath: string): string {
  return `public/${imagePath.replace(/^\/+/, "")}`;
}

export async function visualImageExists(visual: Pick<VisualMetadata, "image_path">): Promise<boolean> {
  return Boolean(visual.image_path && (await pathExists(publicPathToDiskPath(visual.image_path))));
}

function resolveDiskPath(diskPath: string): string {
  return path.isAbsolute(diskPath) ? diskPath : resolvePath(diskPath);
}

async function diskPathExists(diskPath: string): Promise<boolean> {
  try {
    await fs.access(resolveDiskPath(diskPath));
    return true;
  } catch {
    return false;
  }
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

export async function inspectVisualImageFile(diskPath: string): Promise<VisualImageInspection> {
  const absolutePath = resolveDiskPath(diskPath);
  if (!(await diskPathExists(absolutePath))) {
    return { exists: false, usable: false, reason: "missing_file" };
  }

  try {
    const alphaBuffer = await sharp(absolutePath)
      .ensureAlpha()
      .resize(inspectionWidth, inspectionHeight, { fit: "fill" })
      .raw()
      .toBuffer();
    let alphaSum = 0;
    let transparentPixels = 0;
    const pixelCount = alphaBuffer.length / 4;
    for (let index = 3; index < alphaBuffer.length; index += 4) {
      const alpha = alphaBuffer[index];
      alphaSum += alpha;
      if (alpha < 250) transparentPixels += 1;
    }

    const alphaMean = alphaSum / pixelCount;
    const transparentRatio = transparentPixels / pixelCount;
    if (alphaMean < 180 || transparentRatio > 0.35) {
      return {
        exists: true,
        usable: false,
        reason: "transparent_image",
        alpha_mean: roundMetric(alphaMean),
        transparent_ratio: roundMetric(transparentRatio)
      };
    }

    const grayscale = await sharp(absolutePath)
      .flatten({ background: "#000000" })
      .resize(inspectionWidth, inspectionHeight, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    let sum = 0;
    let sumSquares = 0;
    let differenceSum = 0;
    let differenceCount = 0;
    let strongEdges = 0;
    const bins = new Uint32Array(32);

    for (const value of grayscale) {
      sum += value;
      sumSquares += value * value;
      bins[Math.min(31, value >> 3)] += 1;
    }

    for (let y = 0; y < inspectionHeight; y += 1) {
      for (let x = 0; x < inspectionWidth; x += 1) {
        const index = y * inspectionWidth + x;
        if (x + 1 < inspectionWidth) {
          const difference = Math.abs(grayscale[index] - grayscale[index + 1]);
          differenceSum += difference;
          differenceCount += 1;
          if (difference >= 8) strongEdges += 1;
        }
        if (y + 1 < inspectionHeight) {
          const difference = Math.abs(grayscale[index] - grayscale[index + inspectionWidth]);
          differenceSum += difference;
          differenceCount += 1;
          if (difference >= 8) strongEdges += 1;
        }
      }
    }

    const mean = sum / grayscale.length;
    const luminanceStddev = Math.sqrt(sumSquares / grayscale.length - mean * mean);
    const edgeScore = differenceSum / differenceCount;
    const strongEdgeRatio = strongEdges / differenceCount;
    let entropy = 0;
    for (const count of bins) {
      if (!count) continue;
      const probability = count / grayscale.length;
      entropy -= probability * Math.log2(probability);
    }

    const metrics = {
      alpha_mean: roundMetric(alphaMean),
      transparent_ratio: roundMetric(transparentRatio),
      luminance_stddev: roundMetric(luminanceStddev),
      edge_score: roundMetric(edgeScore),
      strong_edge_ratio: roundMetric(strongEdgeRatio),
      entropy: roundMetric(entropy)
    };

    if (luminanceStddev < 8 || entropy < 2.2) {
      return { exists: true, usable: false, reason: "blank_image", ...metrics };
    }
    if (edgeScore < 1.5 && strongEdgeRatio < 0.015) {
      return { exists: true, usable: false, reason: "featureless_image", ...metrics };
    }

    return { exists: true, usable: true, reason: null, ...metrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exists: true, usable: false, reason: `invalid_image_file: ${message.replace(/\s+/g, " ").slice(0, 160)}` };
  }
}

export async function inspectVisualImagePath(imagePath: string): Promise<VisualImageInspection> {
  return inspectVisualImageFile(publicPathToDiskPath(imagePath));
}

export async function inspectVisualImage(visual: Pick<VisualMetadata, "image_path">): Promise<VisualImageInspection> {
  if (!visual.image_path) {
    return { exists: false, usable: false, reason: "missing_image_path" };
  }
  return inspectVisualImagePath(visual.image_path);
}

export async function visualImageIsUsable(visual: Pick<VisualMetadata, "image_path">): Promise<boolean> {
  return (await inspectVisualImage(visual)).usable;
}

export async function findExistingVisualImage(
  date: string,
  type: VisualKind,
  preferredFormat?: string
): Promise<{ image_path: string; output_format: VisualImageFormat } | null> {
  const formats: VisualImageFormat[] = [];
  if (preferredFormat === "png" || preferredFormat === "webp" || preferredFormat === "jpeg") {
    formats.push(preferredFormat);
  }
  for (const format of imageFormats) {
    if (!formats.includes(format)) formats.push(format);
  }

  for (const format of formats) {
    const imagePath = publicVisualImagePath(date, type, format);
    if ((await inspectVisualImagePath(imagePath)).usable) {
      return { image_path: imagePath, output_format: format };
    }
  }

  return null;
}

export async function reconcileVisualImagePath(visual: VisualMetadata): Promise<{
  visual: VisualMetadata;
  repaired: boolean;
  hadUsableImage: boolean;
  reason: string | null;
}> {
  const currentInspection = await inspectVisualImage(visual);
  if (currentInspection.usable) {
    const readyVisual: VisualMetadata = withImageStatus({ ...visual, provider: "openai", fallback: false, error: null }, "ready");
    return {
      visual: readyVisual,
      repaired: visual.provider !== "openai" || visualImageStatus(visual) !== "ready" || visual.fallback !== false || Boolean(visual.error),
      hadUsableImage: true,
      reason: null
    };
  }

  const existing = await findExistingVisualImage(visual.date, visual.type, visual.output_format);
  if (existing) {
    return {
      visual: withImageStatus({
        ...visual,
        image_path: existing.image_path,
        output_format: existing.output_format,
        provider: "openai",
        fallback: false,
        error: null
      }, "ready"),
      repaired: true,
      hadUsableImage: true,
      reason: null
    };
  }

  const reason = currentInspection.reason ?? "missing_image";
  return {
    visual: withImageStatus({
      ...visual,
      image_path: null,
      fallback: true,
      error: visual.error ?? (currentInspection.exists ? `Stored image is not usable: ${reason}` : visual.error)
    }, currentInspection.exists ? "failed" : visualImageStatus(visual) === "failed" ? "failed" : "missing"),
    repaired: Boolean(visual.image_path),
    hadUsableImage: false,
    reason
  };
}
