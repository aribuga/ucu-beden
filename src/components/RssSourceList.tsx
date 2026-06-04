import type { RssSource, SourceBundle } from "../lib/types";

export function RssSourceList({ sources, collected }: { sources?: RssSource[]; collected?: SourceBundle["rss"] }) {
  const configured = sources ?? [];
  const runtime = collected?.sources ?? [];

  return (
    <section className="section">
      <h2 className="section-title">RSS Kaynakları</h2>
      <div className="label-list">
        {(runtime.length > 0 ? runtime : configured).map((source) => (
          <div className="label-row" key={source.name}>
            <span className="label">{source.name}</span>
            <span>
              {"fetched" in source
                ? `${source.enabled ? "açık" : "kapalı"} / ${source.fetched ? "okundu" : "okunamadı"} / ${source.item_count} item`
                : `${source.enabled ? "açık" : "kapalı"} / ${source.category}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
