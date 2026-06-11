import Link from "next/link";

import type { DreamRecord, VisualMetadata } from "../lib/types";
import { VisualField } from "./VisualField";

export function DreamArchiveCard({ dream, visual }: { dream: DreamRecord; visual: VisualMetadata }) {
  return (
    <article className="dream-archive-card">
      <Link href={`/dreams/${dream.date}`} className="dream-archive-visual">
        <VisualField visual={visual} kind="dream" />
      </Link>
      <div className="dream-archive-copy">
        <div className="timeline-title">
          <strong>{dream.title}</strong>
          <span className="tiny">{dream.date}</span>
        </div>
        <p>{dream.dream_text.split(/\r?\n/).slice(0, 3).join(" ")}</p>
        <p className="tiny">{dream.mood_after} / {dream.symbols.slice(0, 3).join(", ")}</p>
        <Link href={`/dreams/${dream.date}`}>rüyaya gir</Link>
      </div>
    </article>
  );
}
