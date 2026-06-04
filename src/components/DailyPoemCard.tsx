import Link from "next/link";

import type { DailyPoem } from "../lib/types";

export function DailyPoemCard({ poem }: { poem: DailyPoem }) {
  return (
    <article className="daily-card">
      <Link href={`/poem/${poem.date}`}>
        <div className="timeline-title">
          <strong>{poem.date}</strong>
          <span className="tiny">{poem.age_display}</span>
        </div>
        <div>{poem.title}</div>
        <div className="tiny">{poem.walk_state.current_segment} / {poem.analysis.word_count} kelime</div>
      </Link>
    </article>
  );
}
