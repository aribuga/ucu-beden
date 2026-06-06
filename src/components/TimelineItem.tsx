import Link from "next/link";

import { formatMoodSentence } from "../lib/moodSentence";
import type { DailyPoem } from "../lib/types";

export function TimelineItem({ poem }: { poem: DailyPoem }) {
  return (
    <article className="timeline-item">
      <Link href={`/poem/${poem.date}`}>
        <div className="timeline-title">
          <strong>{poem.date}</strong>
          <span className="tiny">{poem.age_display}</span>
        </div>
        <div>{poem.title}</div>
        {poem.mood_sentence ? <div className="tiny">{formatMoodSentence(poem.mood_sentence)}</div> : null}
      </Link>
    </article>
  );
}
