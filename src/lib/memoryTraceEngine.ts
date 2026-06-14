import { createHash } from "node:crypto";

import {
  listDreams,
  listFiles,
  listGeneratedPoems,
  listMemoryTraces,
  listSourceDigests,
  listSources,
  pathExists,
  readJsonFile,
  storagePaths,
  writeJsonFile
} from "./fileStorage";
import { tokenize } from "./inputPoems";
import { sourceInfluencePacketsForBundle } from "./sourceInfluence";
import type {
  DailyLifeRecord,
  DailyPoem,
  MemoryClimateDimension,
  MemoryIndex,
  MemoryReport,
  MemorySelection,
  MemoryTrace,
  MemoryTraceFile,
  MemoryTraceKind,
  MemoryTraceSource,
  MemoryTraceStatus,
  Mood,
  MoodKey,
  RepetitionPressure,
  SourceBundle,
  SourceDigestRecord,
  WalkState
} from "./types";

const traceSources: MemoryTraceSource[] = ["poem", "dream", "daily_life", "source", "walk", "visual", "contact_residue"];
const traceStatuses: MemoryTraceStatus[] = ["active", "dim", "suppressed", "fossilized", "overexposed", "unstable"];
const moodKeys: MoodKey[] = ["melancholy", "anger", "tenderness", "fatigue", "absurdity", "clarity", "desire", "hope"];
const publicUnsafePattern = /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;

type TraceDraft = Omit<MemoryTrace, "id" | "recallability" | "decay" | "status">;

export type MemoryArchive = {
  traces: MemoryTrace[];
  trace_files: MemoryTraceFile[];
  index: MemoryIndex;
  report: MemoryReport;
};

export type MemoryValidation = {
  valid: boolean;
  trace_count: number;
  duplicate_ids: string[];
  non_deterministic_ids: string[];
  invalid_source_refs: string[];
  unsafe_public_text: string[];
  idempotency_signature: string;
  memory_state_signature: string;
};

export type MemoryPromptValidation = {
  valid: boolean;
  safe_fragments: string[];
  unsafe_fragments: Array<{ fragment: string; matches: string[] }>;
};

export type MemoryCycleRecallUpdate = {
  id: string;
  status_before: MemoryTraceStatus;
  status_after: MemoryTraceStatus;
  times_recalled_before: number;
  times_recalled_after: number;
  times_returned_in_dream_before: number;
  times_returned_in_dream_after: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function compact(value: string | null | undefined, limit = 360): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const clipped = normalized.slice(0, limit);
  const wordBoundary = clipped.lastIndexOf(" ");
  return wordBoundary > limit * 0.65 ? clipped.slice(0, wordBoundary) : clipped;
}

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

function entityKeywords(title: string, keywords: string[]): string[] {
  const titleTokens = title.split(/\s+/).map((token) => ({
    original: token,
    raw: token.replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+|[^A-Za-zÇĞİÖŞÜçğıöşü]+$/gu, ""),
    normalized: normalized(token).replace(/^[^a-zçğıöşü]+|[^a-zçğıöşü]+$/gu, "")
  }));
  return keywords.filter((keyword) => {
    const value = normalized(keyword);
    return titleTokens.some((token) => {
      const entityShape =
        token.original.endsWith(":") ||
        (token.raw.length >= 2 && token.raw === token.raw.toLocaleUpperCase("tr"));
      return token.normalized === value && /^[A-ZÇĞİÖŞÜ]/u.test(token.raw) && entityShape;
    });
  });
}

function entityPhrases(title: string): string[] {
  const runs: string[][] = [];
  let current: string[] = [];
  for (const token of title.split(/\s+/)) {
    const clean = token.replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+|[^A-Za-zÇĞİÖŞÜçğıöşü]+$/gu, "");
    if (/^[A-ZÇĞİÖŞÜ]/u.test(clean)) current.push(clean);
    else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs.filter((run) => run.length >= 2).map((run) => run.join(" "));
}

function countryNames(): string[] {
  const displayNames = new Intl.DisplayNames(["tr"], { type: "region" });
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const names: string[] = [];
  for (const first of alphabet) {
    for (const second of alphabet) {
      const code = `${first}${second}`;
      const name = displayNames.of(code);
      if (name && name !== code) names.push(name);
    }
  }
  return distinct(names);
}

const countryUnsafeTerms = countryNames();

function promptUnsafeTerms(sources: SourceBundle[]): string[] {
  const terms = sources.flatMap((source) => {
    const rssItems = source.rss?.items ?? [];
    const rssSources = source.rss?.sources ?? [];
    const knowledge = source.rss?.dailyMoodSummary.externalKnowledgeFragments ?? [];
    return [
      source.weather.provider,
      source.turkey_news.provider,
      source.art_world.provider,
      ...rssItems.flatMap((item) => [item.title, item.source, item.url ?? "", ...entityKeywords(item.title, item.keywords), ...entityPhrases(item.title)]),
      ...rssSources.flatMap((item) => [item.name, item.url ?? "", item.usedUrl ?? "", ...(item.attemptedUrls ?? [])]),
      ...knowledge.flatMap((item) => [item.source, item.title, ...entityKeywords(item.title, item.usableWords), ...entityPhrases(item.title)])
    ];
  });
  return distinct([...terms, ...countryUnsafeTerms].map(normalized).filter((term) => term.length >= 3 && !/^\d+$/.test(term))).sort((a, b) => b.length - a.length);
}

function unsafeFragmentMatches(fragment: string, unsafeTerms: string[]): string[] {
  const value = normalized(fragment);
  return distinct([
    ...(publicUnsafePattern.test(fragment) ? ["url_or_contact"] : []),
    ...unsafeTerms.filter((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-zçğıöşü0-9])${escaped}([^a-zçğıöşü0-9]|$)`, "u").test(value);
    })
  ]);
}

export async function validateMemoryPromptFragments(fragments: string[], rawSources?: SourceBundle[]): Promise<MemoryPromptValidation> {
  const sources = rawSources ?? (await listSources());
  const unsafeTerms = promptUnsafeTerms(sources);
  const unsafeFragments = fragments
    .map((fragment) => ({ fragment, matches: unsafeFragmentMatches(fragment, unsafeTerms) }))
    .filter((item) => item.matches.length > 0);
  const unsafeSet = new Set(unsafeFragments.map((item) => item.fragment));
  return {
    valid: unsafeFragments.length === 0,
    safe_fragments: distinct(fragments.filter((fragment) => !unsafeSet.has(fragment))),
    unsafe_fragments: unsafeFragments
  };
}

export async function filterPublicSafeMemoryTraces(traces: MemoryTrace[], rawSources?: SourceBundle[]): Promise<MemoryTrace[]> {
  const sources = rawSources ?? (await listSources());
  const unsafeTerms = promptUnsafeTerms(sources);
  return traces.filter((trace) => unsafeFragmentMatches(`${trace.text} ${trace.transformed_text}`, unsafeTerms).length === 0);
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function traceIdentity(trace: Pick<MemoryTrace, "date" | "source" | "source_ref" | "kind" | "text">): string {
  return [trace.date, trace.source, trace.source_ref, trace.kind, compact(trace.text).toLocaleLowerCase("tr")].join("|");
}

export function deterministicTraceId(trace: Pick<MemoryTrace, "date" | "source" | "source_ref" | "kind" | "text">): string {
  return `mem_${trace.date}_${trace.source}_${trace.kind}_${stableHash(traceIdentity(trace)).slice(0, 12)}`;
}

function dateDistance(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, Math.round((toMs - fromMs) / 86_400_000));
}

function dominantMoodTags(mood: Partial<Mood> | undefined, limit = 3): MoodKey[] {
  if (!mood) return [];
  return moodKeys
    .map((key) => [key, mood[key] ?? 0] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .filter(([, value]) => value > 0)
    .slice(0, limit)
    .map(([key]) => key);
}

function moodWeight(mood: Partial<Mood> | undefined): number {
  if (!mood) return 0.4;
  const values = moodKeys.map((key) => mood[key] ?? 0).sort((a, b) => b - a);
  return clamp01(((values[0] ?? 0) + (values[1] ?? 0)) / 200);
}

function draft(params: {
  date: string;
  source: MemoryTraceSource;
  source_ref: string;
  kind: MemoryTraceKind;
  text: string;
  transformed_text?: string;
  emotional_weight: number;
  repression?: number;
  mutation_rate?: number;
  linked_traces?: string[];
  mood_tags?: MoodKey[];
  origin?: MemoryTrace["origin"];
}): TraceDraft | null {
  const text = compact(params.text);
  const transformedText = compact(params.transformed_text ?? text);
  if (!text || !transformedText) return null;
  return {
    date: params.date,
    source: params.source,
    source_ref: params.source_ref,
    kind: params.kind,
    text,
    transformed_text: transformedText,
    emotional_weight: clamp01(params.emotional_weight),
    repression: clamp01(params.repression ?? 0.15),
    mutation_rate: clamp01(params.mutation_rate ?? 0.2),
    linked_traces: distinct(params.linked_traces ?? []).sort(),
    mood_tags: distinct(params.mood_tags ?? []) as MoodKey[],
    origin: params.origin ?? "observed",
    last_recalled_at: null,
    times_recalled: 0,
    last_dream_return_at: null,
    times_returned_in_dream: 0
  };
}

function traceFromDraft(item: TraceDraft): MemoryTrace {
  return {
    ...item,
    id: deterministicTraceId(item),
    recallability: 0,
    decay: 0,
    status: "active"
  };
}

function poemDraft(poem: DailyPoem): TraceDraft | null {
  const images = poem.analysis.new_images.slice(0, 6);
  return draft({
    date: poem.date,
    source: "poem",
    source_ref: `${storagePaths.generatedPoems}/${poem.date}.json`,
    kind: "episodic",
    text: poem.title,
    transformed_text: compact([poem.mood_sentence, images.join(", ")].filter(Boolean).join(" | ")),
    emotional_weight: moodWeight(poem.mood),
    mutation_rate: 0.35,
    mood_tags: dominantMoodTags(poem.mood)
  });
}

function dailyLifeDrafts(record: DailyLifeRecord): TraceDraft[] {
  const sourceRef = `${storagePaths.dailyLife}/${record.date}.json`;
  return [
    draft({
      date: record.date,
      source: "daily_life",
      source_ref: `${sourceRef}#body_state`,
      kind: "body",
      text: record.body_state,
      transformed_text: compact([record.body_state, record.weather_reaction, record.posture].join(" | ")),
      emotional_weight: clamp01((record.energy + record.irritation + record.tenderness) / 3),
      mood_tags: []
    }),
    draft({
      date: record.date,
      source: "daily_life",
      source_ref: `${sourceRef}#attention`,
      kind: "attention",
      text: record.current_focus || record.attention,
      transformed_text: compact([record.current_focus || record.attention, record.object_focus, record.location].join(" | ")),
      emotional_weight: clamp01((record.shame_self_awareness + record.tenderness) / 2),
      mutation_rate: 0.25
    }),
    draft({
      date: record.date,
      source: "daily_life",
      source_ref: `${sourceRef}#avoidance`,
      kind: "avoidance",
      text: record.avoidance,
      transformed_text: compact([record.avoidance, record.memory_sentence].join(" | ")),
      emotional_weight: clamp01((record.memory_pressure + record.irritation) / 2),
      repression: 0.82,
      mutation_rate: 0.45
    })
  ].filter((item): item is TraceDraft => item !== null);
}

function walkDraft(date: string, walk: WalkState, mood: Mood): TraceDraft | null {
  return draft({
    date,
    source: "walk",
    source_ref: `${storagePaths.generatedPoems}/${date}.json#walk_state`,
    kind: "route",
    text: walk.current_segment,
    transformed_text: compact([walk.current_segment, walk.weather_on_body, walk.seen_objects.slice(0, 5).join(", "), walk.line_written_while_walking].join(" | ")),
    emotional_weight: moodWeight(mood),
    mutation_rate: 0.3,
    mood_tags: dominantMoodTags(mood)
  });
}

function sourceDrafts(bundle: SourceBundle, dailyLife: DailyLifeRecord | undefined, history: SourceBundle[], digest?: SourceDigestRecord): TraceDraft[] {
  const packets = sourceInfluencePacketsForBundle(bundle, history, digest);
  if (packets.length > 0) {
    return packets.map((packet) =>
      draft({
        date: bundle.date,
        source: "source",
        source_ref: digest
          ? `${storagePaths.sourceDigests}/${bundle.date}.json#source_influence_packet:${packet.category}`
          : `${storagePaths.sources}/${bundle.date}.json#source_influence_packet:${packet.category}`,
        kind: "external_pressure",
        text: compact([packet.category, packet.influence_kind.join(" / "), packet.mood_bias.join(" / ")].filter(Boolean).join(" | ")),
        transformed_text: compact(packet.summary_for_prompt),
        emotional_weight: clamp01((packet.pressure_weight + packet.aesthetic_weight + packet.conceptual_weight + packet.rhythm_weight) / 4),
        repression: clamp01(0.15 + packet.pressure_weight * 0.2),
        mutation_rate: clamp01((packet.aesthetic_weight + packet.conceptual_weight + packet.rhythm_weight) / 3),
        mood_tags: packet.mood_bias
      })
    ).filter((item): item is TraceDraft => item !== null);
  }
  const summary = bundle.rss?.dailyMoodSummary;
  const moodTags = summary ? [summary.dominantMood, summary.secondaryMood] : [];
  const emotionalWeight = summary ? moodWeight(summary.moodScores) : clamp01(bundle.turkey_news.emotional_weight / 100);
  const internalEffect = compact(
    [
      dailyLife?.outside_pressure,
      dailyLife?.weather_reaction,
      dailyLife?.social_distance,
      moodTags.join(" / ")
    ]
      .filter(Boolean)
      .join(" | ")
  );
  const legacyDraft = draft({
    date: bundle.date,
    source: "source",
    source_ref: `${storagePaths.sources}/${bundle.date}.json`,
    kind: "external_pressure",
    text: compact(moodTags.join(" / ") || bundle.weather.body_effect),
    transformed_text: internalEffect || compact(bundle.weather.body_effect),
    emotional_weight: emotionalWeight,
    repression: 0.25,
    mutation_rate: 0.65,
    mood_tags: moodTags
  });
  return legacyDraft ? [legacyDraft] : [];
}

function dreamDraft(dream: Awaited<ReturnType<typeof listDreams>>[number], poem: DailyPoem | undefined): TraceDraft | null {
  return draft({
    date: dream.date,
    source: "dream",
    source_ref: `${storagePaths.dreams}/${dream.date}.json`,
    kind: "dream_return",
    text: dream.mood_after || dream.title,
    transformed_text: compact([dream.memory_mutations.join(" | "), dream.symbols.slice(0, 6).join(", ")].filter(Boolean).join(" | ")),
    emotional_weight: poem ? moodWeight(poem.mood) : 0.65,
    repression: 0.52,
    mutation_rate: 0.82,
    mood_tags: poem ? dominantMoodTags(poem.mood) : []
  });
}

function legacyResidueDraft(poem: DailyPoem, poemTracesByDate: Map<string, MemoryTrace>): TraceDraft | null {
  const linked = distinct(
    poem.memory_fragments.flatMap((fragment) =>
      Array.from(fragment.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g), (match) => poemTracesByDate.get(match[0])?.id ?? "")
    )
  ).filter((id) => id !== poemTracesByDate.get(poem.date)?.id);
  if (linked.length === 0) return null;
  const linkedText = linked.slice(0, 2).map((id) => Array.from(poemTracesByDate.values()).find((trace) => trace.id === id)?.transformed_text ?? "");
  return draft({
    date: poem.date,
    source: "contact_residue",
    source_ref: `${storagePaths.generatedPoems}/${poem.date}.json#memory_fragments`,
    kind: "legacy_inferred",
    text: compact(linkedText.join(" | ")),
    transformed_text: compact(linkedText.join(" | ")),
    emotional_weight: moodWeight(poem.mood),
    mutation_rate: 0.55,
    linked_traces: linked,
    mood_tags: dominantMoodTags(poem.mood),
    origin: "legacy_inferred"
  });
}

function linkDailyTraces(traces: MemoryTrace[], dreams: Awaited<ReturnType<typeof listDreams>>): MemoryTrace[] {
  const byDate = new Map<string, MemoryTrace[]>();
  for (const trace of traces) byDate.set(trace.date, [...(byDate.get(trace.date) ?? []), trace]);
  const dreamSourceDates = new Map(dreams.map((dream) => [dream.date, dream.source_date]));
  return traces.map((trace) => {
    const sameDay = byDate.get(trace.date) ?? [];
    const linked =
      trace.source === "poem"
        ? sameDay.filter((candidate) => ["daily_life", "walk", "source"].includes(candidate.source)).map((candidate) => candidate.id)
        : trace.source === "source"
          ? sameDay.filter((candidate) => candidate.source === "daily_life").map((candidate) => candidate.id)
          : trace.source === "dream"
            ? (byDate.get(dreamSourceDates.get(trace.date) ?? trace.date) ?? []).filter((candidate) => candidate.source === "poem" || candidate.kind === "avoidance").map((candidate) => candidate.id)
            : [];
    return { ...trace, linked_traces: distinct([...trace.linked_traces, ...linked]).filter((id) => id !== trace.id).sort() };
  });
}

function applyRecallMetadata(traces: MemoryTrace[], poems: DailyPoem[], dreams: Awaited<ReturnType<typeof listDreams>>): MemoryTrace[] {
  const byId = new Map(traces.map((trace) => [trace.id, trace]));
  const recall = new Map<string, { times: number; last: string | null; dreamTimes: number; lastDream: string | null }>();
  const recordRecall = (selection: MemorySelection | undefined, recalledAt: string, dream: boolean) => {
    if (!selection) return;
    for (const id of distinct(selection.selected_trace_ids)) {
      const current = recall.get(id) ?? { times: 0, last: null, dreamTimes: 0, lastDream: null };
      current.times += 1;
      current.last = !current.last || current.last < recalledAt ? recalledAt : current.last;
      if (dream && selection.suppressed_trace_ids.includes(id)) {
        current.dreamTimes += 1;
        current.lastDream = !current.lastDream || current.lastDream < recalledAt ? recalledAt : current.lastDream;
      }
      recall.set(id, current);
    }
  };
  for (const poem of poems) recordRecall(poem.memory_selection, poem.generated_at, false);
  for (const dream of dreams) {
    recordRecall(dream.memory_selection, dream.generated_at, true);
    const dreamTrace = traces.find((trace) => trace.source === "dream" && trace.date === dream.date);
    if (!dreamTrace || !dream.memory_selection) continue;
    const returnedIds = dream.memory_selection.suppressed_trace_ids.filter((id) => byId.has(id));
    dreamTrace.linked_traces = distinct([...dreamTrace.linked_traces, ...returnedIds]).sort();
    for (const id of returnedIds) {
      const trace = byId.get(id);
      if (trace) trace.linked_traces = distinct([...trace.linked_traces, dreamTrace.id]).sort();
    }
  }
  return traces.map((trace) => {
    const metadata = recall.get(trace.id);
    return metadata
      ? {
          ...trace,
          last_recalled_at: metadata.last,
          times_recalled: metadata.times,
          last_dream_return_at: metadata.lastDream,
          times_returned_in_dream: metadata.dreamTimes
        }
      : trace;
  });
}

function finalizeTraces(traces: MemoryTrace[], builtThrough: string | null): MemoryTrace[] {
  const frequency = new Map<string, number>();
  for (const trace of traces) {
    const key = compact(trace.transformed_text).toLocaleLowerCase("tr");
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }
  return traces
    .map((trace) => {
      const age = builtThrough ? dateDistance(trace.date, builtThrough) : 0;
      const decay = clamp01(age / 120);
      const recallability = clamp01(0.28 + trace.emotional_weight * 0.4 + Math.max(0, 1 - age / 30) * 0.32 - trace.repression * 0.18);
      const repeats = frequency.get(compact(trace.transformed_text).toLocaleLowerCase("tr")) ?? 1;
      const status: MemoryTraceStatus =
        trace.times_recalled >= 4
          ? "overexposed"
          : trace.repression >= 0.72
          ? "suppressed"
          : repeats >= 3
            ? "overexposed"
            : trace.mutation_rate >= 0.72
              ? "unstable"
              : decay >= 0.8
                ? "fossilized"
                : recallability < 0.4
                  ? "dim"
                  : "active";
      return { ...trace, recallability, decay, status };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function emptyBuckets<T extends string>(keys: T[]): Record<T, string[]> {
  const buckets = {} as Record<T, string[]>;
  for (const key of keys) buckets[key] = [];
  return buckets;
}

function buildIndex(traces: MemoryTrace[], builtThrough: string | null): MemoryIndex {
  const byDate: Record<string, string[]> = {};
  const bySource = emptyBuckets(traceSources);
  const byStatus = emptyBuckets(traceStatuses);
  for (const trace of traces) {
    byDate[trace.date] = [...(byDate[trace.date] ?? []), trace.id];
    bySource[trace.source].push(trace.id);
    byStatus[trace.status].push(trace.id);
  }
  return {
    version: 1,
    built_through: builtThrough,
    trace_count: traces.length,
    trace_ids: traces.map((trace) => trace.id),
    by_date: byDate,
    by_source: bySource,
    by_status: byStatus
  };
}

function dimension(value: number, traceIds: string[], label: string): MemoryClimateDimension {
  const normalized = clamp01(value);
  return {
    value: normalized,
    trace_ids: traceIds.slice(0, 12),
    summary: `${label}: ${traceIds.length} iz, ortalama ${Math.round(normalized * 100)}.`
  };
}

function average(traces: MemoryTrace[], value: (trace: MemoryTrace) => number): number {
  return traces.length ? traces.reduce((sum, trace) => sum + value(trace), 0) / traces.length : 0;
}

function buildReport(traces: MemoryTrace[], builtThrough: string | null, sources: SourceBundle[]): MemoryReport {
  const unsafeTerms = promptUnsafeTerms(sources);
  const publicTraces = traces.filter((trace) => unsafeFragmentMatches(`${trace.text} ${trace.transformed_text}`, unsafeTerms).length === 0);
  const suppressed = publicTraces.filter((trace) => trace.status === "suppressed");
  const external = publicTraces.filter((trace) => trace.source === "source");
  const dreams = publicTraces.filter((trace) => trace.kind === "dream_return" || trace.times_returned_in_dream > 0);
  const indirect = publicTraces.filter((trace) => trace.status === "overexposed");
  const recalled = publicTraces.filter((trace) => trace.recallability >= 0.65 && trace.status !== "overexposed");
  return {
    version: 1,
    built_through: builtThrough,
    trace_count: traces.length,
    climate: {
      pressure: dimension(average(publicTraces, (trace) => trace.emotional_weight), publicTraces.filter((trace) => trace.emotional_weight >= 0.65).map((trace) => trace.id), "pressure"),
      clarity: dimension(average(publicTraces, (trace) => trace.recallability * (1 - trace.decay)), recalled.map((trace) => trace.id), "clarity"),
      leakage: dimension(publicTraces.length ? external.length / publicTraces.length : 0, external.map((trace) => trace.id), "leakage"),
      decay: dimension(average(publicTraces, (trace) => trace.decay), publicTraces.filter((trace) => trace.decay >= 0.45).map((trace) => trace.id), "decay"),
      repression: dimension(average(publicTraces, (trace) => trace.repression), suppressed.map((trace) => trace.id), "repression"),
      recallability: dimension(average(publicTraces, (trace) => trace.recallability), recalled.map((trace) => trace.id), "recallability")
    },
    easily_recalled: recalled.sort((a, b) => b.recallability - a.recallability).slice(0, 12).map((trace) => trace.id),
    suppressed: suppressed.slice(0, 12).map((trace) => trace.id),
    external_leakage: external.slice(-12).map((trace) => trace.id),
    dream_returns: dreams.slice(-12).map((trace) => trace.id),
    indirect_only: indirect.slice(0, 12).map((trace) => trace.id)
  };
}

async function readDailyLifeRecords(): Promise<DailyLifeRecord[]> {
  const files = await listFiles(storagePaths.dailyLife, ".json");
  const records = await Promise.all(files.map((file) => readJsonFile<DailyLifeRecord | null>(file, null)));
  return records.filter((record): record is DailyLifeRecord => record !== null).sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildMemoryArchive(): Promise<MemoryArchive> {
  const [poems, dreams, dailyLife, sources, sourceDigests] = await Promise.all([listGeneratedPoems(), listDreams(), readDailyLifeRecords(), listSources(), listSourceDigests()]);
  const poemByDate = new Map(poems.map((poem) => [poem.date, poem]));
  const dailyByDate = new Map(dailyLife.map((record) => [record.date, record]));
  const drafts: TraceDraft[] = [];
  for (const poem of poems) {
    const poemItem = poemDraft(poem);
    const walkItem = walkDraft(poem.date, poem.walk_state, poem.mood);
    if (poemItem) drafts.push(poemItem);
    if (walkItem) drafts.push(walkItem);
  }
  for (const record of dailyLife) drafts.push(...dailyLifeDrafts(record));
  const digestByDate = new Map(sourceDigests.map((digest) => [digest.date, digest]));
  for (const source of sources) drafts.push(...sourceDrafts(source, dailyByDate.get(source.date), sources.filter((item) => item.date < source.date), digestByDate.get(source.date)));
  for (const dream of dreams) {
    const item = dreamDraft(dream, poemByDate.get(dream.source_date));
    if (item) drafts.push(item);
  }
  let traces = drafts.map(traceFromDraft);
  const poemTracesByDate = new Map(traces.filter((trace) => trace.source === "poem").map((trace) => [trace.date, trace]));
  for (const poem of poems) {
    const residue = legacyResidueDraft(poem, poemTracesByDate);
    if (residue) traces.push(traceFromDraft(residue));
  }
  traces = linkDailyTraces(traces, dreams);
  traces = applyRecallMetadata(traces, poems, dreams);
  const dates = distinct([...poems.map((poem) => poem.date), ...dreams.map((dream) => dream.date), ...dailyLife.map((record) => record.date), ...sources.map((source) => source.date)]).sort();
  const builtThrough = dates.at(-1) ?? null;
  traces = finalizeTraces(traces, builtThrough);
  const traceFiles = dates.map((date): MemoryTraceFile => ({ version: 1, date, traces: traces.filter((trace) => trace.date === date) }));
  return { traces, trace_files: traceFiles, index: buildIndex(traces, builtThrough), report: buildReport(traces, builtThrough, sources) };
}

export function previewMemoryCycleEffects(params: {
  date: string;
  recalled_at: string;
  traces: MemoryTrace[];
  poem_selection: MemorySelection;
  dream_selection: MemorySelection;
  sources: SourceBundle[];
}): {
  traces: MemoryTrace[];
  index: MemoryIndex;
  report: MemoryReport;
  recall_updates: MemoryCycleRecallUpdate[];
  dream_return_candidates: string[];
} {
  const poemIds = new Set(params.poem_selection.selected_trace_ids);
  const dreamIds = new Set(params.dream_selection.selected_trace_ids);
  const dreamReturnIds = new Set(params.dream_selection.suppressed_trace_ids);
  const projected = params.traces.map((trace) => {
    const recallDelta = Number(poemIds.has(trace.id)) + Number(dreamIds.has(trace.id));
    const dreamReturnDelta = Number(dreamReturnIds.has(trace.id));
    return recallDelta === 0 && dreamReturnDelta === 0
      ? { ...trace, linked_traces: [...trace.linked_traces], mood_tags: [...trace.mood_tags] }
      : {
          ...trace,
          linked_traces: [...trace.linked_traces],
          mood_tags: [...trace.mood_tags],
          times_recalled: trace.times_recalled + recallDelta,
          last_recalled_at: recallDelta > 0 ? params.recalled_at : trace.last_recalled_at,
          times_returned_in_dream: trace.times_returned_in_dream + dreamReturnDelta,
          last_dream_return_at: dreamReturnDelta > 0 ? params.recalled_at : trace.last_dream_return_at
        };
  });
  const traces = finalizeTraces(projected, params.date);
  const beforeById = new Map(params.traces.map((trace) => [trace.id, trace]));
  const recallUpdates = traces
    .filter((trace) => poemIds.has(trace.id) || dreamIds.has(trace.id))
    .map((trace): MemoryCycleRecallUpdate => {
      const before = beforeById.get(trace.id) ?? trace;
      return {
        id: trace.id,
        status_before: before.status,
        status_after: trace.status,
        times_recalled_before: before.times_recalled,
        times_recalled_after: trace.times_recalled,
        times_returned_in_dream_before: before.times_returned_in_dream,
        times_returned_in_dream_after: trace.times_returned_in_dream
      };
    });
  return {
    traces,
    index: buildIndex(traces, params.date),
    report: buildReport(traces, params.date, params.sources),
    recall_updates: recallUpdates,
    dream_return_candidates: params.dream_selection.suppressed_trace_ids.filter((id) => beforeById.has(id))
  };
}

export async function writeMemoryArchive(archive: MemoryArchive): Promise<void> {
  await Promise.all([
    ...archive.trace_files.map((traceFile) => writeJsonFile(`${storagePaths.memoryTraces}/${traceFile.date}.json`, traceFile)),
    writeJsonFile(storagePaths.memoryIndex, archive.index),
    writeJsonFile(storagePaths.memoryReport, archive.report)
  ]);
}

export function memoryArchiveStateSignature(archive: Pick<MemoryArchive, "traces">): string {
  return stableHash(
    archive.traces
      .map((trace) =>
        JSON.stringify({
          id: trace.id,
          status: trace.status,
          linked_traces: [...trace.linked_traces].sort(),
          last_recalled_at: trace.last_recalled_at,
          times_recalled: trace.times_recalled,
          last_dream_return_at: trace.last_dream_return_at,
          times_returned_in_dream: trace.times_returned_in_dream
        })
      )
      .sort()
      .join("\n")
  );
}

function sourcePath(sourceRef: string): string {
  return sourceRef.split("#")[0];
}

export async function validateMemoryArchive(archive: MemoryArchive, rawSources?: SourceBundle[]): Promise<MemoryValidation> {
  const idCounts = new Map<string, number>();
  for (const trace of archive.traces) idCounts.set(trace.id, (idCounts.get(trace.id) ?? 0) + 1);
  const duplicateIds = Array.from(idCounts.entries()).filter(([, count]) => count > 1).map(([id]) => id).sort();
  const nonDeterministicIds = archive.traces.filter((trace) => deterministicTraceId(trace) !== trace.id).map((trace) => trace.id).sort();
  const invalidSourceRefs: string[] = [];
  for (const trace of archive.traces) if (!(await pathExists(sourcePath(trace.source_ref)))) invalidSourceRefs.push(trace.source_ref);
  const sourceBundles = rawSources ?? (await listSources());
  const sourceNames = distinct(sourceBundles.flatMap((source) => source.rss?.sources.map((item) => item.name) ?? [])).filter((name) => name.length >= 4);
  const unsafePublicText = archive.traces
    .filter((trace) => {
      const publicText = `${trace.text} ${trace.transformed_text}`;
      return publicUnsafePattern.test(publicText) || (trace.source === "source" && sourceNames.some((name) => publicText.toLocaleLowerCase("tr").includes(name.toLocaleLowerCase("tr"))));
    })
    .map((trace) => trace.id)
    .sort();
  const idempotencySignature = stableHash(archive.traces.map((trace) => trace.id).sort().join("\n"));
  return {
    valid: duplicateIds.length === 0 && nonDeterministicIds.length === 0 && invalidSourceRefs.length === 0 && unsafePublicText.length === 0,
    trace_count: archive.traces.length,
    duplicate_ids: duplicateIds,
    non_deterministic_ids: nonDeterministicIds,
    invalid_source_refs: distinct(invalidSourceRefs).sort(),
    unsafe_public_text: unsafePublicText,
    idempotency_signature: idempotencySignature,
    memory_state_signature: memoryArchiveStateSignature(archive)
  };
}

function overlapScore(trace: MemoryTrace, mood: Mood): number {
  const dominant = new Set(dominantMoodTags(mood, 3));
  return trace.mood_tags.filter((tag) => dominant.has(tag)).length / Math.max(1, dominant.size);
}

function repeatedTrace(trace: MemoryTrace, repetition: RepetitionPressure | undefined): boolean {
  if (!repetition) return false;
  const repeated = [...repetition.repeated_images, ...repetition.repeated_locations, ...repetition.repeated_words]
    .map((item) => item.replace(/\s+\(\d+\)$/g, "").toLocaleLowerCase("tr"));
  const text = trace.transformed_text.toLocaleLowerCase("tr");
  return repeated.some((item) => item.length > 2 && text.includes(item));
}

function takeWithSourceLimit<T extends { trace: MemoryTrace }>(items: T[], limit: number, maxPerSource: number): T[] {
  const selected: T[] = [];
  const seen = new Set<string>();
  const sourceCounts = new Map<MemoryTraceSource, number>();
  for (const item of items) {
    if (seen.has(item.trace.id) || (sourceCounts.get(item.trace.source) ?? 0) >= maxPerSource) continue;
    selected.push(item);
    seen.add(item.trace.id);
    sourceCounts.set(item.trace.source, (sourceCounts.get(item.trace.source) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

function retrievalScore(trace: MemoryTrace, params: { date: string; mood: Mood; mode: "poem" | "dream"; repetition?: RepetitionPressure }): number {
  const age = dateDistance(trace.date, params.date);
  const recency = Math.max(0, 1 - age / 21);
  const dreamSuppression = params.mode === "dream" ? trace.repression * 0.5 : -trace.repression * 0.2;
  const repeatedPenalty = repeatedTrace(trace, params.repetition) ? 0.22 : 0;
  const stableTieBreak = Number.parseInt(stableHash(`${params.date}|${params.mode}|${trace.id}`).slice(0, 6), 16) / 0xffffff / 100;
  return trace.recallability * 0.36 + trace.emotional_weight * 0.2 + overlapScore(trace, params.mood) * 0.22 + recency * 0.22 + dreamSuppression - repeatedPenalty + stableTieBreak;
}

export async function selectMemoryForGeneration(params: {
  date: string;
  mood: Mood;
  mode: "poem" | "dream";
  repetition?: RepetitionPressure;
  limit?: number;
  traces?: MemoryTrace[];
  sources?: SourceBundle[];
}): Promise<MemorySelection> {
  const [traces, sources] = await Promise.all([params.traces ? Promise.resolve(params.traces) : listMemoryTraces(), params.sources ? Promise.resolve(params.sources) : listSources()]);
  const unsafeTerms = promptUnsafeTerms(sources);
  const safeForPrompt = (trace: MemoryTrace) => unsafeFragmentMatches(trace.transformed_text, unsafeTerms).length === 0;
  const limit = params.limit ?? (params.mode === "dream" ? 10 : 8);
  const eligible = traces.filter((trace) => trace.date < params.date);
  const ranked = eligible
    .filter((trace) => trace.status !== "overexposed" && safeForPrompt(trace))
    .map((trace) => ({ trace, score: retrievalScore(trace, params) }))
    .sort((a, b) => b.score - a.score || a.trace.id.localeCompare(b.trace.id));
  const recent = ranked.filter(({ trace }) => dateDistance(trace.date, params.date) <= 4).slice(0, params.mode === "dream" ? 3 : 4);
  const longTerm = ranked.filter(({ trace }) => dateDistance(trace.date, params.date) > 4).slice(0, 2);
  const suppressed =
    params.mode === "dream"
      ? ranked.filter(({ trace }) => trace.status === "suppressed").slice(0, 4)
      : ranked.filter(({ trace }) => trace.status === "suppressed").slice(0, 1);
  const candidates = params.mode === "dream" ? [...suppressed, ...recent, ...longTerm, ...ranked] : [...recent, ...longTerm, ...suppressed, ...ranked];
  const direct = takeWithSourceLimit(candidates, limit, 3);
  const directIds = direct.map(({ trace }) => trace.id);
  const byId = new Map(eligible.map((trace) => [trace.id, trace]));
  const overexposedLinks = eligible
    .filter((trace) => trace.status === "overexposed")
    .sort((a, b) => retrievalScore(b, params) - retrievalScore(a, params) || a.id.localeCompare(b.id))
    .flatMap((trace) => trace.linked_traces);
  const indirectIds = distinct([...direct.flatMap(({ trace }) => (trace.origin === "legacy_inferred" ? trace.linked_traces : [])), ...overexposedLinks])
    .filter((id) => !directIds.includes(id))
    .filter((id) => {
      const trace = byId.get(id);
      return trace ? trace.status !== "overexposed" && safeForPrompt(trace) : false;
    })
    .slice(0, 2);
  const indirect = indirectIds.map((id) => byId.get(id)).filter((trace): trace is MemoryTrace => trace !== undefined);
  const selectedIds = distinct([...directIds, ...indirectIds]);
  const promptFragments = [...direct.map(({ trace }) => compact(trace.transformed_text, 240)), ...indirect.map((trace) => compact(trace.transformed_text, 240))];
  return {
    mode: params.mode,
    selected_trace_ids: selectedIds,
    direct_trace_ids: directIds,
    indirect_trace_ids: indirectIds,
    suppressed_trace_ids: [...direct.map(({ trace }) => trace), ...indirect].filter((trace) => trace.status === "suppressed").map((trace) => trace.id),
    prompt_fragments: promptFragments,
    memory_prompt_fragments: promptFragments
  };
}
