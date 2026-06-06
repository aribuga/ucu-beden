import type { RssSource, SourceBundle } from "../lib/types";

type RuntimeRssSource = NonNullable<SourceBundle["rss"]>["sources"][number];

function sourceStatusText(source: RssSource | RuntimeRssSource): string {
  if ("fetched" in source) {
    const status =
      "status" in source && source.status
        ? source.status
        : source.fetched
          ? source.item_count > 0
            ? "ok"
            : "empty"
          : source.error?.includes("403")
            ? "blocked_403"
            : "failed";
    const retry = source.retriedWithBrowserHeaders ? " / header retry" : "";
    const usedUrl = source.usedUrl ? ` / ${source.usedUrl}` : "";
    const error = source.error ? ` / ${source.error}` : "";
    return `${status} / ${source.item_count} item${retry}${usedUrl}${error}`;
  }

  const strategy = source.fetchStrategy ? ` / ${source.fetchStrategy}` : "";
  const alternates = source.alternateUrls?.length ? ` / ${source.alternateUrls.length} alternatif` : "";
  return `${source.enabled ? "açık" : "kapalı"} / ${source.category}${strategy}${alternates}`;
}

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
            <span>{sourceStatusText(source)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
