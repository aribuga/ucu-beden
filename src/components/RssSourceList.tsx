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
            : "error";
    const retry = source.retriedWithBrowserHeaders ? " / header retry" : "";
    const error = source.error ? ` / ${source.error}` : "";
    return `${status} / ${source.item_count} item${retry}${error}`;
  }

  if (source.softDisabled && source.softDisabledReason === "blocked_403") {
    return "blocked_403 / soft-disabled";
  }

  return `${source.enabled ? "açık" : "kapalı"} / ${source.category}`;
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
