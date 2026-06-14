import { tokenize } from "./inputPoems";
import type {
  Mood,
  MoodKey,
  MoodTaggedSourceItem,
  RssSourceCategory,
  SourceBundle,
  SourceDigestAnalysis,
  SourceInfluenceKind,
  SourceInfluencePacket,
  SourceInfluenceValidation
} from "./types";

const categories: RssSourceCategory[] = ["news", "art", "science_culture", "entertainment", "life"];
const moodKeys: MoodKey[] = ["melancholy", "anger", "tenderness", "fatigue", "absurdity", "clarity", "desire", "hope"];

const categoryConfig: Record<
  RssSourceCategory,
  {
    influence: SourceInfluenceKind[];
    weights: Pick<SourceInfluencePacket, "aesthetic_weight" | "conceptual_weight" | "rhythm_weight" | "pressure_weight">;
  }
> = {
  news: {
    influence: ["pressure", "mood_pressure"],
    weights: { aesthetic_weight: 0.12, conceptual_weight: 0.28, rhythm_weight: 0.36, pressure_weight: 0.88 }
  },
  art: {
    influence: ["aesthetic_learning", "image_expansion"],
    weights: { aesthetic_weight: 0.9, conceptual_weight: 0.52, rhythm_weight: 0.42, pressure_weight: 0.18 }
  },
  science_culture: {
    influence: ["conceptual_drift", "vocabulary_learning"],
    weights: { aesthetic_weight: 0.34, conceptual_weight: 0.92, rhythm_weight: 0.28, pressure_weight: 0.2 }
  },
  entertainment: {
    influence: ["rhythm_shift", "attention_shift"],
    weights: { aesthetic_weight: 0.45, conceptual_weight: 0.3, rhythm_weight: 0.9, pressure_weight: 0.24 }
  },
  life: {
    influence: ["memory_association", "attention_shift"],
    weights: { aesthetic_weight: 0.4, conceptual_weight: 0.32, rhythm_weight: 0.48, pressure_weight: 0.22 }
  }
};

const technicalSafeTerms = new Set(
  [
    ...categories,
    ...moodKeys,
    ...Object.values(categoryConfig).flatMap((config) => config.influence),
    "category",
    "items",
    "influence",
    "mood",
    "safe_terms",
    "weights",
    "aesthetic",
    "conceptual",
    "rhythm",
    "pressure"
  ].flatMap(tokenize)
);

const blockedTerms = new Set([
  "haber",
  "başlık",
  "bugün",
  "dünya",
  "yeni",
  "son",
  "dakika",
  "olarak",
  "üzerine",
  "karşı",
  "ilgili",
  "göre",
  "etti",
  "oldu",
  "olan",
  "var",
  "yok",
  "rss",
  "feed",
  "http",
  "https",
  "www"
]);

function distinct<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

function rounded(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function countryNames(): string[] {
  const displayNames = new Intl.DisplayNames(["tr"], { type: "region" });
  const names: string[] = [];
  for (const first of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const second of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const code = `${first}${second}`;
      const name = displayNames.of(code);
      if (name && name !== code) names.push(normalized(name));
    }
  }
  return distinct(names);
}

const countryUnsafeTerms = new Set(countryNames().flatMap(tokenize));

function cleanRawToken(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function probableEntityTerms(title: string): string[] {
  return title
    .split(/\s+/g)
    .map(cleanRawToken)
    .filter((token) => token.length > 1 && (/^\p{Lu}/u.test(token) || token === token.toLocaleUpperCase("tr")))
    .flatMap(tokenize);
}

function urlTerms(value: string | undefined): string[] {
  if (!value) return [];
  try {
    return tokenize(new URL(value).hostname.replace(/^www\./, ""));
  } catch {
    return tokenize(value);
  }
}

function unsafeTermSet(items: MoodTaggedSourceItem[], bundle?: SourceBundle): Set<string> {
  const rawTerms = items.flatMap((item) => [
    item.source,
    ...probableEntityTerms(item.title),
    ...urlTerms(item.url)
  ]);
  if (bundle) {
    rawTerms.push(bundle.weather.provider, bundle.turkey_news.provider, bundle.art_world.provider);
    for (const source of bundle.rss?.sources ?? []) rawTerms.push(source.name, ...urlTerms(source.url), ...urlTerms(source.usedUrl));
  }
  return new Set([
    ...countryUnsafeTerms,
    ...rawTerms.flatMap(tokenize).map(normalized).filter((term) => term.length > 1)
  ].filter((term) => !technicalSafeTerms.has(term)));
}

function termRejectionReason(term: string, unsafeTerms: Set<string>): string | null {
  const value = normalized(term);
  if (/^\d+$/.test(value)) return "numeric";
  if (value.length < 3 || value.length > 20) return "length";
  if (blockedTerms.has(value)) return "generic";
  if (unsafeTerms.has(value) || countryUnsafeTerms.has(value)) return "proper_or_source_name";
  if (/https?:|www\.|@/i.test(value)) return "url_or_contact";
  return null;
}

export function filterSafeSourceTerms(params: { terms: string[]; raw_text: string; source: string; url?: string }): string[] {
  const unsafeTerms = new Set(
    [
      ...countryUnsafeTerms,
      ...probableEntityTerms(params.raw_text),
      ...tokenize(params.source),
      ...urlTerms(params.url)
    ].map(normalized).filter((term) => !technicalSafeTerms.has(term))
  );
  return distinct(
    params.terms
      .flatMap(tokenize)
      .map(normalized)
      .filter((term) => termRejectionReason(term, unsafeTerms) === null)
  );
}

function termCandidates(items: MoodTaggedSourceItem[], bundle?: SourceBundle) {
  const unsafeTerms = unsafeTermSet(items, bundle);
  const counts = new Map<string, number>();
  const rejected = new Map<string, number>();
  for (const term of items.flatMap((item) => [...item.keywords, ...tokenize(item.shortAtmosphere)])) {
    const value = normalized(term);
    const reason = termRejectionReason(value, unsafeTerms);
    if (reason) rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
    else counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return {
    counts,
    rejected: Array.from(rejected.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([reason, count]) => `${reason}:${count}`)
  };
}

function moodBias(items: MoodTaggedSourceItem[]): MoodKey[] {
  const totals = Object.fromEntries(moodKeys.map((key) => [key, 0])) as Mood;
  for (const item of items) for (const key of moodKeys) totals[key] += item.moodScores[key];
  return moodKeys.slice().sort((a, b) => totals[b] - totals[a] || a.localeCompare(b)).filter((key) => totals[key] > 0).slice(0, 3);
}

function adjustedWeights(category: RssSourceCategory, items: MoodTaggedSourceItem[]) {
  const base = categoryConfig[category].weights;
  const average = (key: MoodKey) => items.reduce((sum, item) => sum + item.moodScores[key], 0) / Math.max(1, items.length) / 50;
  return {
    aesthetic_weight: rounded(base.aesthetic_weight + average("desire") + average("absurdity") / 2),
    conceptual_weight: rounded(base.conceptual_weight + average("clarity")),
    rhythm_weight: rounded(base.rhythm_weight + average("absurdity") + average("fatigue") / 3),
    pressure_weight: rounded(base.pressure_weight + average("anger") + average("fatigue"))
  };
}

function historicalTerms(history: SourceBundle[], category: RssSourceCategory): Set<string> {
  const terms = history.flatMap((bundle) => {
    const stored = bundle.rss?.source_influence_packet?.find((packet) => packet.category === category);
    if (stored) return stored.safe_terms;
    const items = (bundle.rss?.items ?? []).filter((item) => item.category === category);
    return Array.from(termCandidates(items, bundle).counts.keys());
  });
  return new Set(terms.map(normalized));
}

export function buildSourceInfluencePackets(
  items: MoodTaggedSourceItem[],
  history: SourceBundle[] = [],
  bundle?: SourceBundle
): SourceInfluencePacket[] {
  return categories.flatMap((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length === 0) return [];
    const { counts, rejected } = termCandidates(categoryItems, bundle);
    const previous = historicalTerms(history, category);
    const rankedTerms = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .map(([term]) => term)
      .slice(0, 12);
    const noveltyTerms = rankedTerms.filter((term) => !previous.has(term)).slice(0, 8);
    const repeatedTerms = rankedTerms.filter((term) => previous.has(term) || (counts.get(term) ?? 0) > 1).slice(0, 8);
    const moods = moodBias(categoryItems);
    const weights = adjustedWeights(category, categoryItems);
    const influence = categoryConfig[category].influence;
    const summary = [
      `category=${category}`,
      `items=${categoryItems.length}`,
      `influence=${influence.join(",")}`,
      `mood=${moods.join(",") || "none"}`,
      `safe_terms=${rankedTerms.slice(0, 6).join(",") || "none"}`,
      `weights=aesthetic:${weights.aesthetic_weight},conceptual:${weights.conceptual_weight},rhythm:${weights.rhythm_weight},pressure:${weights.pressure_weight}`
    ].join("; ");
    return [{
      category,
      item_count: categoryItems.length,
      influence_kind: influence,
      safe_terms: rankedTerms,
      novelty_terms: noveltyTerms,
      repeated_terms: repeatedTerms,
      rejected_terms: rejected,
      mood_bias: moods,
      ...weights,
      summary_for_prompt: summary
    }];
  });
}

export function sourceInfluencePacketsForBundle(bundle: SourceBundle, history: SourceBundle[] = []): SourceInfluencePacket[] {
  return bundle.rss?.source_influence_packet ?? buildSourceInfluencePackets(bundle.rss?.items ?? [], history, bundle);
}

export function sourceInfluenceSummaryForPrompt(packets: SourceInfluencePacket[]): string {
  return packets.length > 0
    ? packets.map((packet) => packet.summary_for_prompt).join(" | ")
    : "source_influence_packet=empty";
}

function jaccard(left: string, right: string): number {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = Array.from(a).filter((term) => b.has(term)).length;
  return rounded(intersection / Math.max(1, new Set([...a, ...b]).size));
}

function repeatedPhrases(summaries: string[]): string[] {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    const words = tokenize(summary);
    const seen = new Set<string>();
    for (let index = 0; index < words.length - 1; index += 1) seen.add(`${words[index]} ${words[index + 1]}`);
    for (const phrase of seen) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, 12)
    .map(([phrase]) => phrase);
}

function aggregateRejectedTerms(packets: SourceInfluencePacket[]): string[] {
  const counts = new Map<string, number>();
  for (const value of packets.flatMap((packet) => packet.rejected_terms)) {
    const [reason, rawCount] = value.split(":");
    counts.set(reason, (counts.get(reason) ?? 0) + (Number(rawCount) || 1));
  }
  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([reason, count]) => `${reason}:${count}`);
}

export function analyzeSourceDigest(sources: SourceBundle[], windowDays = 7): SourceDigestAnalysis {
  const window = sources.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-windowDays);
  const packetRows = window.flatMap((bundle, index) =>
    sourceInfluencePacketsForBundle(bundle, window.slice(0, index)).map((packet) => ({ date: bundle.date, packet }))
  );
  const summaries = window.map((source) => source.rss?.dailyMoodSummary.summary ?? "").filter(Boolean);
  const similarities = summaries.slice(1).map((summary, index) => jaccard(summaries[index], summary));
  const categoryDistribution: Partial<Record<RssSourceCategory, number>> = {};
  const itemCounts: Partial<Record<RssSourceCategory, number>> = {};
  for (const { packet } of packetRows) {
    categoryDistribution[packet.category] = (categoryDistribution[packet.category] ?? 0) + 1;
    itemCounts[packet.category] = (itemCounts[packet.category] ?? 0) + packet.item_count;
  }
  const health = window.flatMap((source) => source.rss?.sources ?? []);
  const blockedStatuses = new Set(["blocked_403", "rate_limited_429"]);
  const failedStatuses = new Set(["not_found_404", "timeout", "parse_error", "failed"]);
  const moodCounts = new Map<MoodKey, number>();
  for (const { packet } of packetRows) for (const mood of packet.mood_bias) moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
  const maximum = similarities.length > 0 ? Math.max(...similarities) : 0;
  const average = similarities.length > 0 ? rounded(similarities.reduce((sum, value) => sum + value, 0) / similarities.length) : 0;
  return {
    window_days: window.length,
    rss_summary_similarity: {
      compared_days: similarities.length,
      average,
      maximum,
      warning: similarities.length >= 2 && (average >= 0.72 || maximum >= 0.9)
    },
    source_category_distribution: categoryDistribution,
    item_count_by_category: itemCounts,
    selected_non_news_influences: packetRows
      .filter(({ packet }) => packet.category !== "news")
      .slice(-8)
      .map(({ date, packet }) => ({
        date,
        category: packet.category as Exclude<RssSourceCategory, "news">,
        influence_kind: packet.influence_kind,
        safe_terms: packet.safe_terms.slice(0, 5)
      })),
    novelty_terms: distinct(packetRows.flatMap(({ packet }) => packet.novelty_terms)).slice(0, 20),
    repeated_source_phrases: repeatedPhrases(summaries),
    repeated_mood_words: Array.from(moodCounts.entries()).filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([mood]) => mood),
    rejected_unsafe_terms: aggregateRejectedTerms(packetRows.map(({ packet }) => packet)),
    source_health_summary: {
      total: health.length,
      ok: health.filter((source) => source.status === "ok").length,
      empty: health.filter((source) => source.status === "empty").length,
      blocked: health.filter((source) => blockedStatuses.has(source.status)).length,
      failed: health.filter((source) => failedStatuses.has(source.status)).length,
      empty_or_blocked: health.filter((source) => source.status === "empty" || blockedStatuses.has(source.status)).length
    }
  };
}

function textUnsafeMatches(text: string, unsafeTerms: Set<string>): string[] {
  const words = new Set(tokenize(text));
  return distinct([
    ...(/https?:|www\.|@/i.test(text) ? ["url_or_contact"] : []),
    ...Array.from(unsafeTerms).filter((term) => words.has(term)).map(() => "proper_or_source_name")
  ]);
}

export function validateSourceInfluence(sources: SourceBundle[], windowDays = 7): SourceInfluenceValidation {
  const ordered = sources.slice().sort((a, b) => a.date.localeCompare(b.date));
  const rows = ordered.flatMap((bundle, index) =>
    sourceInfluencePacketsForBundle(bundle, ordered.slice(0, index)).map((packet) => ({ bundle, packet }))
  );
  const categoriesWithItems = distinct(ordered.flatMap((bundle) => bundle.rss?.items.map((item) => item.category) ?? [])).sort();
  const categoriesWithPackets = distinct(rows.map(({ packet }) => packet.category)).sort();
  const nonNewsAvailable = categoriesWithItems.filter((category) => category !== "news");
  const nonNewsRepresented = categoriesWithPackets.filter((category) => category !== "news");
  const nonNewsIgnored = nonNewsAvailable.filter((category) => !nonNewsRepresented.includes(category));
  const unsafePacketText = rows.flatMap(({ bundle, packet }) => {
    const unsafe = unsafeTermSet((bundle.rss?.items ?? []).filter((item) => item.category === packet.category), bundle);
    const text = `${packet.safe_terms.join(" ")} ${packet.novelty_terms.join(" ")} ${packet.repeated_terms.join(" ")} ${packet.summary_for_prompt}`;
    const matches = textUnsafeMatches(text, unsafe);
    return matches.length > 0 ? [{ date: bundle.date, category: packet.category, matches }] : [];
  });
  const digest = analyzeSourceDigest(sources, windowDays);
  const packetProduced = categoriesWithItems.length === 0 || rows.length > 0;
  const categoryDiversityPreserved = categoriesWithItems.every((category) => categoriesWithPackets.includes(category));
  return {
    valid: packetProduced && categoryDiversityPreserved && nonNewsIgnored.length === 0 && unsafePacketText.length === 0,
    source_influence_packet_produced: packetProduced,
    packet_count: rows.length,
    categories_with_items: categoriesWithItems,
    categories_with_packets: categoriesWithPackets,
    category_diversity_preserved: categoryDiversityPreserved,
    non_news_available: nonNewsAvailable,
    non_news_represented: nonNewsRepresented,
    non_news_ignored: nonNewsIgnored,
    unsafe_packet_text: unsafePacketText,
    vocabulary_candidates_safe: unsafePacketText.length === 0,
    rss_summary_similarity_warning: digest.rss_summary_similarity.warning
  };
}
