import Link from "next/link";

import { RssSourceList } from "../../../components/RssSourceList";
import { UcuBedenHeader } from "../../../components/UcuBedenHeader";
import { getLatestPoem, listSources, readRssSources, readState } from "../../../lib/fileStorage";
import type { RssSource, SourceBundle } from "../../../lib/types";

type RuntimeRssSource = NonNullable<SourceBundle["rss"]>["sources"][number];
type MaybeLegacyRuntimeRssSource = Partial<RuntimeRssSource> & {
  name: string;
  category: RuntimeRssSource["category"];
  enabled: boolean;
  fetched: boolean;
  item_count: number;
};

function fallbackRuntimeSources(sources: RssSource[]): RuntimeRssSource[] {
  const checkedAt = new Date().toISOString();
  return sources.map((source) => ({
    name: source.name,
    category: source.category,
    url: source.url,
    enabled: source.enabled,
    fetched: false,
    status: source.softDisabled && source.softDisabledReason === "blocked_403" ? "blocked_403" : source.enabled ? "empty" : "disabled",
    item_count: 0,
    lastCheckedAt: checkedAt,
    error: source.softDisabled && source.softDisabledReason === "blocked_403" ? "Soft-disabled after repeated 403" : undefined
  }));
}

function normalizeRuntimeSource(source: MaybeLegacyRuntimeRssSource, collectedAt?: string): RuntimeRssSource {
  const status =
    source.status ??
    (source.fetched
      ? source.item_count > 0
        ? "ok"
        : "empty"
      : source.error?.includes("403")
        ? "blocked_403"
        : source.enabled
          ? "error"
          : "disabled");

  return {
    name: source.name,
    category: source.category,
    url: source.url,
    enabled: source.enabled,
    fetched: source.fetched,
    status,
    item_count: source.item_count,
    lastCheckedAt: source.lastCheckedAt ?? collectedAt ?? new Date().toISOString(),
    retriedWithBrowserHeaders: source.retriedWithBrowserHeaders,
    error: source.error
  };
}

function applyConfiguredOverrides(runtimeSources: RuntimeRssSource[], configuredSources: RssSource[]): RuntimeRssSource[] {
  const configuredByName = new Map(configuredSources.map((source) => [source.name, source]));

  return runtimeSources.map((source) => {
    const configured = configuredByName.get(source.name);
    if (configured?.softDisabled && configured.softDisabledReason === "blocked_403") {
      return {
        ...source,
        fetched: false,
        status: "blocked_403",
        item_count: 0,
        error: source.error ?? "Soft-disabled after repeated 403"
      };
    }

    return source;
  });
}

function statusLabel(status: RuntimeRssSource["status"]): string {
  const labels: Record<RuntimeRssSource["status"], string> = {
    ok: "OK",
    empty: "BOŞ",
    disabled: "KAPALI",
    blocked_403: "403",
    error: "HATA"
  };
  return labels[status];
}

function sourceLine(source: RuntimeRssSource): string {
  const retry = source.retriedWithBrowserHeaders ? " / header retry" : "";
  const error = source.error ? ` / ${source.error}` : "";
  return `${statusLabel(source.status)} / ${source.item_count} item${retry}${error}`;
}

export default async function SourceHealthPage() {
  const [latest, state, sourceHistory, configuredSources] = await Promise.all([getLatestPoem(), readState(), listSources(), readRssSources()]);
  const latestSource = sourceHistory.at(-1);
  const runtimeSources = applyConfiguredOverrides(latestSource?.rss?.sources
    ? latestSource.rss.sources.map((source) => normalizeRuntimeSource(source, latestSource.collected_at))
    : fallbackRuntimeSources(configuredSources), configuredSources);
  const blockedCount = runtimeSources.filter((source) => source.status === "blocked_403").length;
  const okCount = runtimeSources.filter((source) => source.status === "ok").length;

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section">
        <h2 className="section-title">Kaynak Sağlığı</h2>
        <p>
          <Link href="/sources">Kaynak günlüğüne dön</Link>
        </p>
        <div className="label-list">
          <div className="label-row">
            <span className="label">son kontrol</span>
            <span>{latestSource?.collected_at ?? runtimeSources[0]?.lastCheckedAt ?? "henüz yok"}</span>
          </div>
          <div className="label-row">
            <span className="label">özet</span>
            <span>{okCount} ok / {blockedCount} 403 / {runtimeSources.length} kaynak</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Kapılar</h2>
        <div className="label-list">
          {runtimeSources.map((source) => (
            <div className="label-row" key={`${source.name}-${source.url ?? source.category}`}>
              <span className="label">{source.name}</span>
              <span>{sourceLine(source)}</span>
            </div>
          ))}
        </div>
      </section>

      {latestSource?.rss ? <RssSourceList collected={latestSource.rss} /> : null}
    </main>
  );
}
