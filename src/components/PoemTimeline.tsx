import Link from "next/link";

import type { DailyPoem } from "../lib/types";

import { TimelineItem } from "./TimelineItem";

export function PoemTimeline({ poems, showArchiveLink = false }: { poems: DailyPoem[]; showArchiveLink?: boolean }) {
  return (
    <section className="section">
      <h2 className="section-title">Zaman Çizelgesi</h2>
      <div className="timeline">
        {poems.slice().reverse().map((poem) => (
          <TimelineItem key={poem.date} poem={poem} />
        ))}
      </div>
      {showArchiveLink ? (
        <div className="timeline-title">
          <span />
          <Link className="tiny" href="/archive">tüm arşiv</Link>
        </div>
      ) : null}
    </section>
  );
}
