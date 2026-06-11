"use client";

import { useEffect, useState, type CSSProperties } from "react";

import type { VisualMetadata } from "../lib/types";

type VisualStyle = CSSProperties & {
  "--visual-a": string;
  "--visual-b": string;
  "--visual-c": string;
  "--visual-shift": string;
};

export function VisualField({ visual, kind }: { visual: VisualMetadata; kind: "poem" | "dream" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const imageSource = visual.image_path?.startsWith("/") ? `${basePath}${visual.image_path}` : visual.image_path;
  useEffect(() => setImageFailed(false), [visual.image_path]);

  const style: VisualStyle = {
    "--visual-a": visual.fallback_palette[0],
    "--visual-b": visual.fallback_palette[1],
    "--visual-c": visual.fallback_palette[2],
    "--visual-shift": `${visual.fallback_seed % 37}px`
  };

  return (
    <div className={`visual-field visual-field-${kind}`} style={style} role="img" aria-label={visual.alt_text} data-aspect-ratio="4:5">
      {imageSource && !imageFailed ? <img src={imageSource} alt={visual.alt_text} onError={() => setImageFailed(true)} /> : null}
      <div className="visual-field-signal" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{kind === "poem" ? "şiir iç ekranı" : "gece kaydı"}</p>
    </div>
  );
}
