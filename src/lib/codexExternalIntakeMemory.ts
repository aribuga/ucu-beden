import { listFiles, readJsonFile } from "./fileStorage";
import { tokenize } from "./inputPoems";
import type { MemoryTrace, MoodKey } from "./types";

export const codexExternalIntakeJsonDir = "data/external_intake/codex/json";

export type CodexExternalIntakeRecord = {
  date: string;
  path: string;
  data: Record<string, unknown>;
};

export type ExternalIntakeTraceDraft = Omit<MemoryTrace, "id" | "recallability" | "decay" | "status">;

type RepeatedSignal = {
  signal: string;
  residue: string;
  count: number;
  motifs: string[];
};

type ResidueCandidate = {
  text: string;
  transformed_text: string;
  bucket: "main" | "minor" | "repeated" | "visual";
  motifs: string[];
  score: number;
};

const moodKeys: MoodKey[] = ["melancholy", "anger", "tenderness", "fatigue", "absurdity", "clarity", "desire", "hope"];

const publicUnsafePattern = /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu;
const sensitiveOperationalPattern =
  /\b(verification|verify|code|invoice|payment|transaction|unsubscribe|tracking|footer|receipt|security alert|doğrulama|kod|fatura|ödeme|işlem|abonelikten çık|takip linki|güvenlik bildirimi)\b/iu;
const sourceFormatPattern = /\b(gmail|e-posta|email|mail|bülten|newsletter|rss|feed|aposto|substack|reddit|digest)\b/iu;
const sourceFormatReplacePattern = /\b(gmail|e-posta|email|mail|bülten|newsletter|rss|feed|aposto|substack|reddit|digest)\b/giu;
const dateOrLongNumberPattern = /\b(?:\d{4}-\d{2}-\d{2}|\d{4,})\b/gu;
const weakTermPattern = /^(ve|ile|bir|bu|şu|çok|daha|gibi|olan|olarak|için|ama|fakat|bugün|günün|dış|temas)$/u;

const visualCuePattern = /\b(görsel|şiir|poetik|ritim|imge|renk|ışık|ses|doku|hareket|beden|arşiv|ekran|gece|mavi|ateş|su|koku|tat|mekân|hafıza)\b/iu;
const heavyOrPoliticalPattern = /\b(savaş|politik|güvenlik|prosedür|kurum|belge|ölçüm|yangın|iklim|kriz|borç|vize|yasa|siber|denetim|operasyon|geçiş|risk)\b/iu;

const moodRules: Array<{ pattern: RegExp; tags: MoodKey[] }> = [
  { pattern: /\b(ölçüm|prosedür|kurum|belge|güvenlik|denetim|yasa|vize)\b/iu, tags: ["fatigue", "clarity", "anger"] },
  { pattern: /\b(ısı|sıcak|yangın|iklim|beden baskısı|ateş|kuraklık)\b/iu, tags: ["fatigue", "anger"] },
  { pattern: /\b(unutkanlık|arşiv|geri çağırma|hatırlama|saklama)\b/iu, tags: ["melancholy", "tenderness", "clarity"] },
  { pattern: /\b(cihaz|makine|ai|yapay zeka|otomasyon|model|robot|ekran)\b/iu, tags: ["clarity", "absurdity", "fatigue"] },
  { pattern: /\b(platform|prestij|görünürlük|itibar|etiket|sayaç)\b/iu, tags: ["fatigue", "anger", "absurdity"] },
  { pattern: /\b(ritim|müzik|tını|şiirsel çağrı|ses|cümle)\b/iu, tags: ["tenderness", "hope", "clarity"] },
  { pattern: /\b(ilişki|çatışma|etik|güç|tahakküm|haysiyet)\b/iu, tags: ["anger", "tenderness", "clarity"] },
  { pattern: /\b(koku|tat|mekân|yerel hafıza|mutfak|yerellik)\b/iu, tags: ["tenderness", "desire", "melancholy"] }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compact(value: string | null | undefined, limit = 360): string {
  const normalized = (value ?? "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) return normalized;
  const clipped = normalized.slice(0, limit);
  const boundary = clipped.lastIndexOf(" ");
  return (boundary > limit * 0.65 ? clipped.slice(0, boundary) : clipped).trim();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("tr").replace(/\s+/gu, " ").trim();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRecord(root: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = root[key];
  return isRecord(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter(Boolean);
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function dateDistance(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.round((toMs - fromMs) / 86_400_000);
}

function termsFromText(value: string): string[] {
  return distinct(tokenize(value).filter((term) => term.length >= 3 && !weakTermPattern.test(term)));
}

function sanitizePublicText(value: string, unsafeTerms: string[], limit = 320): string {
  let text = compact(value, limit)
    .replace(publicUnsafePattern, " ")
    .replace(dateOrLongNumberPattern, " ")
    .replace(sourceFormatReplacePattern, "dış temas");
  for (const term of unsafeTerms.sort((a, b) => b.length - a.length)) {
    if (term.length < 4) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "giu"), " ");
  }
  text = text.replace(/\s+/gu, " ").replace(/\s+([,.;:!?])/gu, "$1").trim();
  text = compact(text, limit);
  if (!text || publicUnsafePattern.test(text) || sensitiveOperationalPattern.test(text) || sourceFormatPattern.test(text)) return "";
  return text;
}

function sourceHintsFromValue(value: unknown): string[] {
  if (typeof value === "string") return [];
  if (Array.isArray(value)) return value.flatMap(sourceHintsFromValue);
  if (!isRecord(value)) return [];
  const current = [stringValue(value.source_hint), stringValue(value.source_name), stringValue(value.provider)].filter(Boolean);
  return [...current, ...Object.values(value).flatMap(sourceHintsFromValue)];
}

export function externalIntakeUnsafePublicTerms(records: CodexExternalIntakeRecord[]): string[] {
  const sourceHints = records.flatMap((record) => sourceHintsFromValue(record.data));
  const providerHints = sourceHints
    .filter((hint) => /[\/|]/u.test(hint))
    .map((hint) => hint.split(/[\/|]/u)[0]?.trim() ?? "")
    .filter((hint) => hint.length >= 4 && !/[,:;-]/u.test(hint));
  return distinct([
    ...providerHints,
    "Gmail",
    "e-posta",
    "bülten",
    "newsletter",
    "RSS",
    "feed",
    "Aposto",
    "Substack",
    "Reddit",
    "digest"
  ])
    .map(normalized)
    .filter((term) => term.length >= 4);
}

export function unsafeExternalIntakeTextMatches(text: string, unsafeTerms: string[]): string[] {
  const value = normalized(text);
  const matches = unsafeTerms.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-zçğıöşü0-9])${escaped}([^a-zçğıöşü0-9]|$)`, "u").test(value);
  });
  return distinct([
    ...(publicUnsafePattern.test(text) ? ["url_or_contact"] : []),
    ...(sensitiveOperationalPattern.test(text) ? ["sensitive_operational_text"] : []),
    ...(sourceFormatPattern.test(text) ? ["source_format_term"] : []),
    ...matches
  ]);
}

export async function listCodexExternalIntakeRecords(): Promise<CodexExternalIntakeRecord[]> {
  const files = await listFiles(codexExternalIntakeJsonDir, ".json");
  const records = await Promise.all(
    files.map(async (file) => {
      const data = await readJsonFile<unknown>(file, null);
      if (!isRecord(data)) return null;
      const date = stringValue(data.date) || file.match(/(\d{4}-\d{2}-\d{2})\.json$/u)?.[1] || "";
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
      const safety = getRecord(data, "safety");
      if (safety && safety.public_safe === false) return null;
      return { date, path: file, data };
    })
  );
  return records.filter((record): record is CodexExternalIntakeRecord => record !== null).sort((a, b) => a.date.localeCompare(b.date));
}

function repeatedSignalEntries(record: CodexExternalIntakeRecord): RepeatedSignal[] {
  const externalLayers = getRecord(record.data, "external_contact_layers");
  const intake = getRecord(record.data, "intake_synthesis");
  const buckets = [
    record.data.repeated_signals,
    externalLayers?.repeated_signals,
    intake?.repeated_signals
  ];
  const fromObjects = buckets.flatMap(recordArray).map((item): RepeatedSignal => ({
    signal: stringValue(item.signal) || stringValue(item.topic),
    residue: stringValue(item.residue) || stringValue(item.public_residue) || stringValue(item.plain_summary),
    count: numberValue(item.count, 1),
    motifs: stringArray(item.motifs)
  }));
  const fromStrings = buckets.flatMap(stringArray).map((value): RepeatedSignal => {
    const [signal, ...rest] = value.split(":");
    return {
      signal: signal.trim(),
      residue: rest.join(":").trim() || value,
      count: 1,
      motifs: []
    };
  });
  return [...fromObjects, ...fromStrings].filter((item) => item.signal || item.residue);
}

function motifTermsForRecord(record: CodexExternalIntakeRecord): string[] {
  const readingSummary = getRecord(record.data, "reading_summary");
  const atmosphere = getRecord(record.data, "atmosphere");
  const externalLayers = getRecord(record.data, "external_contact_layers");
  const intake = getRecord(record.data, "intake_synthesis");
  const digestItems = [...recordArray(record.data.digest_items), ...recordArray(externalLayers?.digest_items)];
  const raw = [
    ...stringArray(record.data.motifs),
    ...stringArray(readingSummary?.dominant_topics),
    ...stringArray(atmosphere?.pressure_points),
    ...stringArray(atmosphere?.soft_residues),
    ...repeatedSignalEntries(record).map((item) => item.signal),
    ...stringArray(intake?.items),
    ...digestItems.flatMap((item) => stringArray(item.motifs))
  ];
  return distinct(raw.flatMap(termsFromText));
}

function recurrenceByTerm(records: CodexExternalIntakeRecord[]): Map<string, { count: number; dates: string[] }> {
  const byTerm = new Map<string, Set<string>>();
  for (const record of records) {
    for (const term of motifTermsForRecord(record)) {
      const key = normalized(term);
      byTerm.set(key, new Set([...(byTerm.get(key) ?? []), record.date]));
    }
  }
  return new Map(
    Array.from(byTerm.entries()).map(([term, dates]) => [term, { count: dates.size, dates: Array.from(dates).sort() }])
  );
}

function moodTagsForText(text: string): MoodKey[] {
  const tags = moodRules.flatMap((rule) => (rule.pattern.test(text) ? rule.tags : []));
  return distinct(tags).filter((tag): tag is MoodKey => moodKeys.includes(tag as MoodKey));
}

function repressionFor(text: string): number {
  return heavyOrPoliticalPattern.test(text) ? 0.34 : 0.24;
}

function draft(params: {
  date: string;
  source_ref: string;
  text: string;
  transformed_text: string;
  emotional_weight: number;
  repression: number;
  mutation_rate: number;
  mood_tags: MoodKey[];
}): ExternalIntakeTraceDraft | null {
  if (!params.text || !params.transformed_text) return null;
  return {
    date: params.date,
    source: "contact_residue",
    source_ref: params.source_ref,
    kind: "external_pressure",
    text: params.text,
    transformed_text: params.transformed_text,
    emotional_weight: clamp01(params.emotional_weight),
    repression: clamp01(params.repression),
    mutation_rate: clamp01(params.mutation_rate),
    linked_traces: [],
    mood_tags: params.mood_tags,
    origin: "observed",
    last_recalled_at: null,
    times_recalled: 0,
    last_dream_return_at: null,
    times_returned_in_dream: 0
  };
}

function dailyWeatherDraft(record: CodexExternalIntakeRecord, unsafeTerms: string[]): ExternalIntakeTraceDraft | null {
  const readingSummary = getRecord(record.data, "reading_summary");
  const atmosphere = getRecord(record.data, "atmosphere");
  const text = sanitizePublicText(
    [
      stringValue(readingSummary?.overall_direction),
      stringValue(atmosphere?.external_weather),
      stringValue(record.data.external_weather),
      stringValue(record.data.summary)
    ].find(Boolean) ?? "",
    unsafeTerms
  );
  const transformed = sanitizePublicText(
    [
      stringValue(record.data.possible_influence_on_ucu_beden),
      stringValue(atmosphere?.possible_tone),
      stringValue(record.data.summary)
    ].filter(Boolean).join(" "),
    unsafeTerms
  );
  const content = `${text} ${transformed}`;
  return draft({
    date: record.date,
    source_ref: `${record.path}#external_intake_memory:daily_weather`,
    text,
    transformed_text: transformed || text,
    emotional_weight: clamp01(0.68 + Math.min(0.12, repeatedSignalEntries(record).length * 0.02)),
    repression: repressionFor(content),
    mutation_rate: heavyOrPoliticalPattern.test(content) ? 0.62 : 0.58,
    mood_tags: moodTagsForText(content)
  });
}

function repeatedSignalDraft(
  record: CodexExternalIntakeRecord,
  unsafeTerms: string[],
  recurrence: Map<string, { count: number; dates: string[] }>
): ExternalIntakeTraceDraft | null {
  const windowRecords = Array.from(recurrence.entries());
  const candidates = repeatedSignalEntries(record)
    .map((item) => {
      const signalTerms = termsFromText(item.signal);
      const recurrent = Math.max(
        0,
        ...signalTerms.map((term) => {
          const data = recurrence.get(normalized(term));
          return data ? data.dates.filter((date) => dateDistance(date, record.date) >= 0 && dateDistance(date, record.date) <= 21).length : 0;
        })
      );
      return { item, recurrent, score: item.count + recurrent * 2 };
    })
    .sort((a, b) => b.score - a.score || a.item.signal.localeCompare(b.item.signal));
  const selected = candidates[0];
  if (!selected) {
    const fallback = windowRecords
      .filter(([, value]) => value.dates.includes(record.date))
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
    if (!fallback) return null;
    const text = sanitizePublicText(fallback[0], unsafeTerms, 180);
    return draft({
      date: record.date,
      source_ref: `${record.path}#external_intake_memory:repeated_signal`,
      text,
      transformed_text: text,
      emotional_weight: fallback[1].count >= 3 ? 0.84 : 0.78,
      repression: repressionFor(text),
      mutation_rate: 0.62,
      mood_tags: moodTagsForText(text)
    });
  }
  const text = sanitizePublicText(selected.item.signal, unsafeTerms, 180);
  const transformed = sanitizePublicText(selected.item.residue || selected.item.signal, unsafeTerms);
  const content = `${text} ${transformed}`;
  return draft({
    date: record.date,
    source_ref: `${record.path}#external_intake_memory:repeated_signal`,
    text,
    transformed_text: transformed || text,
    emotional_weight: selected.recurrent >= 3 ? 0.84 : 0.78,
    repression: repressionFor(content),
    mutation_rate: 0.64,
    mood_tags: moodTagsForText(content)
  });
}

function residueCandidates(record: CodexExternalIntakeRecord, unsafeTerms: string[]): ResidueCandidate[] {
  const externalLayers = getRecord(record.data, "external_contact_layers");
  const intake = getRecord(record.data, "intake_synthesis");
  const channels = getRecord(record.data, "channels");
  const gmail = channels ? getRecord(channels, "gmail") : null;
  const arrays = [
    ...recordArray(record.data.main_items).map((item) => ({ item, bucket: "main" as const })),
    ...recordArray(gmail?.items).map((item) => ({ item, bucket: "main" as const })),
    ...recordArray(externalLayers?.main_items).map((item) => ({ item, bucket: "main" as const })),
    ...recordArray(record.data.minor_residues).map((item) => ({ item, bucket: "minor" as const })),
    ...recordArray(externalLayers?.minor_residues).map((item) => ({ item, bucket: "minor" as const })),
    ...recordArray(record.data.digest_items).map((item) => ({ item, bucket: "visual" as const })),
    ...recordArray(externalLayers?.digest_items).map((item) => ({ item, bucket: "visual" as const }))
  ];
  const fromObjects = arrays.map(({ item, bucket }): ResidueCandidate => {
    const contentDigest = getRecord(item, "content_digest");
    const text = sanitizePublicText(
      stringValue(item.public_residue) ||
        stringValue(item.residue) ||
        stringValue(item.trace) ||
        stringValue(item.public_effect) ||
        stringValue(item.plain_summary) ||
        stringValue(contentDigest?.why_it_mattered) ||
        stringValue(contentDigest?.what_it_contained),
      unsafeTerms
    );
    const transformed = sanitizePublicText(
      [
        stringValue(item.possible_influence),
        ...(Array.isArray(item.possible_influence) ? stringArray(item.possible_influence) : []),
        stringValue(contentDigest?.why_it_mattered),
        stringValue(item.residue),
        stringValue(item.public_effect)
      ].filter(Boolean).join(" "),
      unsafeTerms
    );
    const motifs = stringArray(item.motifs).filter((motif) => !unsafeExternalIntakeTextMatches(motif, unsafeTerms).length);
    const visualScore = visualCuePattern.test(`${text} ${transformed} ${motifs.join(" ")}`) ? 2 : 0;
    const bucketScore = bucket === "main" ? 3 : bucket === "visual" ? 2 : 1;
    return { text, transformed_text: transformed || text, bucket, motifs, score: bucketScore + visualScore + motifs.length / 10 };
  });
  const fromSynthesis = [
    ...stringArray(intake?.items).map((text) => ({ text, bucket: "main" as const })),
    ...stringArray(intake?.minor_residues).map((text) => ({ text, bucket: "minor" as const }))
  ].map(({ text, bucket }): ResidueCandidate => {
    const safe = sanitizePublicText(text, unsafeTerms);
    return {
      text: safe,
      transformed_text: safe,
      bucket,
      motifs: [],
      score: bucket === "main" ? 2.5 : 1
    };
  });
  return [...fromObjects, ...fromSynthesis]
    .filter((item) => item.text && item.transformed_text)
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
}

function visualResidueDraft(record: CodexExternalIntakeRecord, unsafeTerms: string[]): ExternalIntakeTraceDraft | null {
  const candidates = residueCandidates(record, unsafeTerms);
  const candidate =
    candidates.find((item) => visualCuePattern.test(`${item.text} ${item.transformed_text} ${item.motifs.join(" ")}`)) ?? candidates[0];
  if (!candidate) {
    const motifs = stringArray(record.data.motifs)
      .map((motif) => sanitizePublicText(motif, unsafeTerms, 80))
      .filter(Boolean)
      .slice(0, 6);
    const text = motifs.join(", ");
    return draft({
      date: record.date,
      source_ref: `${record.path}#external_intake_memory:visual_poetic_residue`,
      text,
      transformed_text: text,
      emotional_weight: 0.7,
      repression: repressionFor(text),
      mutation_rate: 0.7,
      mood_tags: moodTagsForText(text)
    });
  }
  const content = `${candidate.text} ${candidate.transformed_text}`;
  const baseWeight = candidate.bucket === "main" ? 0.72 : candidate.bucket === "minor" ? 0.62 : 0.74;
  return draft({
    date: record.date,
    source_ref: `${record.path}#external_intake_memory:visual_poetic_residue`,
    text: candidate.text,
    transformed_text: candidate.transformed_text,
    emotional_weight: visualCuePattern.test(content) ? Math.max(baseWeight, 0.74) : baseWeight,
    repression: Math.min(0.45, repressionFor(content) - 0.04),
    mutation_rate: visualCuePattern.test(content) ? 0.76 : 0.7,
    mood_tags: moodTagsForText(content)
  });
}

export function codexExternalIntakeDrafts(records: CodexExternalIntakeRecord[], windowDays = 21): ExternalIntakeTraceDraft[] {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const recurrence = recurrenceByTerm(sorted);
  const unsafeTerms = externalIntakeUnsafePublicTerms(sorted);
  return sorted.flatMap((record) => {
    const windowedRecurrence = new Map(
      Array.from(recurrence.entries()).map(([term, value]) => [
        term,
        { ...value, dates: value.dates.filter((date) => dateDistance(date, record.date) >= 0 && dateDistance(date, record.date) <= windowDays) }
      ])
    );
    return distinctDrafts([
      dailyWeatherDraft(record, unsafeTerms),
      repeatedSignalDraft(record, unsafeTerms, windowedRecurrence),
      visualResidueDraft(record, unsafeTerms)
    ]);
  });
}

function distinctDrafts(drafts: Array<ExternalIntakeTraceDraft | null>): ExternalIntakeTraceDraft[] {
  const seen = new Set<string>();
  const selected: ExternalIntakeTraceDraft[] = [];
  for (const draftItem of drafts) {
    if (!draftItem) continue;
    const key = normalized(`${draftItem.source_ref}|${draftItem.text}|${draftItem.transformed_text}`);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(draftItem);
    if (selected.length >= 3) break;
  }
  return selected;
}
