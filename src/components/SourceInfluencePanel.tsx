import type { SourceBundle } from "../lib/types";

export function SourceInfluencePanel({ source }: { source: SourceBundle }) {
  return (
    <article className="source-row">
      <div className="timeline-title">
        <strong>{source.date}</strong>
        <span className="tiny">{source.fallback_used ? "fallback var" : "canlı kaynak"}</span>
      </div>
      <div className="label-list">
        <div className="label-row">
          <span className="label">hava</span>
          <span>{source.weather.summary}</span>
        </div>
        <div className="label-row">
          <span className="label">gündem</span>
          <span>{source.turkey_news.summary}</span>
        </div>
        <div className="label-row">
          <span className="label">sanat</span>
          <span>{source.art_world.summary}</span>
        </div>
        {source.rss ? (
          <div className="label-row">
            <span className="label">rss mood</span>
            <span>{source.rss.dailyMoodSummary.summary}</span>
          </div>
        ) : null}
      </div>
      {source.rss ? (
        <div className="source-mini-list">
          {source.rss.items.slice(0, 6).map((item) => (
            <div className="source-mini-item" key={`${item.source}-${item.title}`}>
              <strong>{item.source}</strong>
              <span>{item.title}</span>
              <span className="tiny">{item.moodTags.join(", ")} / {item.shortAtmosphere}</span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
