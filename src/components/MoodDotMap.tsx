import type { SourceBundle } from "../lib/types";
import { MoodDot } from "./MoodDot";

export function MoodDotMap({ source }: { source: SourceBundle }) {
  const items = source.rss?.items ?? [];

  return (
    <section className="section mood-map-section">
      <div>
        <h2 className="section-title">Dış Dünya Noktacıkları</h2>
        <p>{source.rss?.dailyMoodSummary.summary ?? "Bugün kaynak noktası yok."}</p>
      </div>
      <div className="mood-dot-map" aria-label="RSS kaynaklarının mood haritası">
        {items.map((item, index) => (
          <MoodDot key={`${item.source}-${item.title}`} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}
