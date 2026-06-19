"use client";

import { useEffect, useState, type CSSProperties } from "react";

import type { VisualMetadata } from "../lib/types";

type VisualStyle = CSSProperties & {
  "--visual-c": string;
};

const missingVisualStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(255, 255, 255, .16), rgba(0, 0, 0, .16)), var(--visual-c)"
};

const placeholderStyle: CSSProperties = {
  maxWidth: "72%",
  padding: "8px 10px",
  border: "1px dotted var(--soft-line)",
  background: "rgba(0, 0, 0, .22)",
  color: "var(--muted)",
  fontSize: 9,
  lineHeight: 1.35,
  textAlign: "center"
};

export function VisualField({ visual, kind }: { visual: VisualMetadata; kind: "poem" | "dream" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const imageSource = visual.image_path?.startsWith("/") ? `${basePath}${visual.image_path}` : visual.image_path;
  useEffect(() => setImageFailed(false), [visual.image_path]);
  const showPlaceholder = !imageSource || imageFailed;

  const style: VisualStyle = {
    "--visual-c": visual.fallback_palette[2],
    ...(showPlaceholder ? missingVisualStyle : {})
  };

  return (
    <div
      className={`visual-field visual-field-${kind}${showPlaceholder ? " visual-field-missing" : ""}`}
      style={style}
      role="img"
      aria-label={showPlaceholder ? "Görsel henüz oluşmadı." : visual.alt_text}
      data-aspect-ratio="4:5"
    >
      {imageSource && !imageFailed ? <img src={imageSource} alt={visual.alt_text} onError={() => setImageFailed(true)} /> : null}
      {showPlaceholder ? <span style={placeholderStyle}>Görsel henüz oluşmadı.</span> : null}
    </div>
  );
}
