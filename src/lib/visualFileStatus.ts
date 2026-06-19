import { pathExists } from "./fileStorage";
import type { VisualKind, VisualMetadata } from "./types";

const imageFormats = ["png", "webp", "jpeg"] as const;

export type VisualImageFormat = (typeof imageFormats)[number];
export type VisualImageStatus = "missing" | "ready" | "failed";
export type VisualMetadataWithImageStatus = VisualMetadata & { image_status?: VisualImageStatus };

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
    if (await pathExists(publicPathToDiskPath(imagePath))) {
      return { image_path: imagePath, output_format: format };
    }
  }

  return null;
}

export async function reconcileVisualImagePath(visual: VisualMetadata): Promise<{
  visual: VisualMetadata;
  repaired: boolean;
  hadUsableImage: boolean;
}> {
  if (await visualImageExists(visual)) {
    const readyVisual: VisualMetadata = withImageStatus({ ...visual, provider: "openai", fallback: false, error: null }, "ready");
    return {
      visual: readyVisual,
      repaired: visual.provider !== "openai" || visualImageStatus(visual) !== "ready" || visual.fallback !== false || Boolean(visual.error),
      hadUsableImage: true
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
      hadUsableImage: true
    };
  }

  return {
    visual: withImageStatus({
      ...visual,
      image_path: null,
      fallback: true
    }, visualImageStatus(visual) === "failed" ? "failed" : "missing"),
    repaired: Boolean(visual.image_path),
    hadUsableImage: false
  };
}
