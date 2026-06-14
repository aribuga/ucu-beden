import { listGeneratedPoems, listMemoryTraces, listSources, readWorld } from "./fileStorage";
import { tokenize } from "./inputPoems";
import { validateMemoryPromptFragments } from "./memoryTraceEngine";
import type {
  DailyPoem,
  DreamRecord,
  MemoryTrace,
  PoemGenerationMeta,
  RepetitionPressure,
  SourceBundle,
  SurfaceValidationReport,
  SurfaceViolation,
  World
} from "./types";

type GeneratedSurfaceText = {
  title: string;
  poem_text: string;
};

export type SurfaceAnalysisContext = {
  mode?: "poem" | "dream";
  world?: World;
  repetition?: RepetitionPressure;
  recentPoems?: DailyPoem[];
  traces?: MemoryTrace[];
  sources?: SourceBundle[];
  sourcePoem?: DailyPoem;
  windowSize?: number;
};

export type SurfaceDenylist = {
  blocked_terms: string[];
  canonical_home_terms: string[];
  canonical_walk_place_terms: string[];
  overexposed_trace_terms: string[];
  recent_repeated_surface_terms: string[];
  recent_title_terms: string[];
  recent_repeated_phrases: string[];
};

const technicalStopWords = new Set(
  tokenize(
    "bir bu şu o ve ile için gibi daha çok az sonra önce bugün yine ama çünkü kadar olan olarak var yok kendi sadece içinde üzerine üzerinde altında doğru geri yeni eski küçük büyük uzun kısa oldukça sayılabilecek birleşik detay gizli mütevazı"
  )
);

const selfExplanationPatterns = [
  /\bbu\s+(şiir|rüya)\b/iu,
  /\b(şiir|rüya)\s+yazıyorum\b/iu,
  /\bpersona(yı|mı)?\s+açıkla/iu,
  /\b(as an ai|as a language model)\b/iu,
  /\b(yapay zek[aâ]|dil modeli)\s+olarak\b/iu
];

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalized(value: string): string {
  return tokenize(value).join(" ");
}

function meaningfulTerms(values: string[]): string[] {
  return distinct(
    values
      .flatMap(tokenize)
      .filter((term) => term.length >= 4 && !technicalStopWords.has(term) && !/^\d+$/.test(term))
  );
}

function countTerms(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function termsSeenAcrossDocuments(documents: string[], minimumDocuments: number): string[] {
  const counts = new Map<string, number>();
  for (const document of documents) {
    for (const term of new Set(meaningfulTerms([document]))) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minimumDocuments)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .map(([term]) => term);
}

function ngrams(value: string, size: number): string[] {
  const words = tokenize(value);
  return words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(" "));
}

function repeatedRecentPhrases(poems: DailyPoem[]): string[] {
  const documentCounts = new Map<string, number>();
  for (const poem of poems) {
    const phrases = new Set([...ngrams(poem.poem_text, 3), ...ngrams(poem.poem_text, 4)]);
    for (const phrase of phrases) documentCounts.set(phrase, (documentCounts.get(phrase) ?? 0) + 1);
  }
  const repeated = Array.from(documentCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([phrase]) => phrase);
  const latestExact = poems.slice(-4).flatMap((poem) => ngrams(poem.poem_text, 5));
  return distinct([...repeated, ...latestExact]).slice(0, 160);
}

function homeValues(world: World): string[] {
  const rooms = Object.values(world.home.rooms);
  return [
    world.home.city,
    world.home.district,
    world.home.building,
    world.home.apartment_type,
    ...rooms.flatMap((room) => [room.description, ...room.objects])
  ];
}

function walkValues(world: World): string[] {
  return world.walking_routes.flatMap((route) => [
    route.name,
    route.start,
    ...route.segments,
    ...Object.keys(route.mood_effects)
  ]);
}

function stripCountSuffix(value: string): string {
  return value.replace(/\s+\(\d+\)$/u, "");
}

export function buildSurfaceDenylist(params: {
  world: World;
  recentPoems: DailyPoem[];
  traces: MemoryTrace[];
  repetition?: RepetitionPressure;
  windowSize?: number;
}): SurfaceDenylist {
  const recentPoems = params.recentPoems.slice(-(params.windowSize ?? 30));
  const minimumDocuments = Math.max(2, Math.ceil(recentPoems.length * 0.25));
  const canonicalHomeTerms = meaningfulTerms(homeValues(params.world));
  const canonicalWalkPlaceTerms = meaningfulTerms(walkValues(params.world));
  const overexposedTraceTerms = meaningfulTerms(
    params.traces.filter((trace) => trace.status === "overexposed").flatMap((trace) => [trace.text, trace.transformed_text])
  );
  const recentTitleTerms = termsSeenAcrossDocuments(recentPoems.map((poem) => poem.title), Math.max(2, Math.ceil(recentPoems.length * 0.2)));
  const recentRepeatedSurfaceTerms = distinct([
    ...termsSeenAcrossDocuments(recentPoems.map((poem) => poem.poem_text), minimumDocuments),
    ...(params.repetition?.soft_avoid ?? []).flatMap((value) => meaningfulTerms([stripCountSuffix(value)])),
    ...(params.repetition?.repeated_images ?? []).flatMap((value) => meaningfulTerms([stripCountSuffix(value)])),
    ...(params.repetition?.repeated_locations ?? []).flatMap((value) => meaningfulTerms([stripCountSuffix(value)]))
  ]);
  const recentRepeatedPhrases = distinct([
    ...repeatedRecentPhrases(recentPoems),
    ...(params.repetition?.repeated_pairs ?? []).map(stripCountSuffix).map(normalized).filter(Boolean)
  ]);
  return {
    blocked_terms: distinct([
      ...canonicalHomeTerms,
      ...canonicalWalkPlaceTerms,
      ...overexposedTraceTerms,
      ...recentRepeatedSurfaceTerms,
      ...recentTitleTerms
    ]),
    canonical_home_terms: canonicalHomeTerms,
    canonical_walk_place_terms: canonicalWalkPlaceTerms,
    overexposed_trace_terms: overexposedTraceTerms,
    recent_repeated_surface_terms: recentRepeatedSurfaceTerms,
    recent_title_terms: recentTitleTerms,
    recent_repeated_phrases: recentRepeatedPhrases
  };
}

export function stripGeneratedSignature(text: string): string {
  const lines = text.split(/\r?\n/);
  let last = lines.length - 1;
  while (last >= 0 && !lines[last].trim()) last -= 1;
  if (last >= 0 && normalized(lines[last]) === "ucu beden") lines.splice(last, 1);
  return lines.join("\n").trim();
}

function matchedTerms(value: string, terms: string[]): string[] {
  const candidate = tokenize(value);
  return terms.filter((term) =>
    candidate.some((candidateTerm) => candidateTerm === term || (candidateTerm.length >= 5 && term.length >= 5 && candidateTerm.slice(0, 5) === term.slice(0, 5)))
  );
}

function matchedPhrases(value: string, phrases: string[]): string[] {
  const candidate = ` ${normalized(value)} `;
  const matches = distinct(phrases.filter((phrase) => phrase.split(" ").length >= 2 && candidate.includes(` ${phrase} `)))
    .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);
  return matches.filter((phrase, index) => !matches.slice(0, index).some((longer) => ` ${longer} `.includes(` ${phrase} `)));
}

function pushViolation(violations: SurfaceViolation[], kind: SurfaceViolation["kind"], severity: SurfaceViolation["severity"], matches: string[]) {
  if (matches.length === 0) return;
  violations.push({ kind, severity, matches: distinct(matches).slice(0, 12) });
}

function metadataReport(params: {
  violations: SurfaceViolation[];
  denylist: SurfaceDenylist;
  homePlaceMatches: string[];
  repeatedPhrases: string[];
  titleViolation: boolean;
}): SurfaceValidationReport {
  const severe = params.violations.some((violation) => violation.severity === "severe");
  const homePlaceLeakScore = Math.min(100, params.homePlaceMatches.length * 12);
  const repeatedPhraseScore = Math.min(100, params.repeatedPhrases.length * 25);
  return {
    surface_validation_passed: !severe,
    severe,
    surface_violations: params.violations,
    blocked_surface_terms_count: params.denylist.blocked_terms.length,
    title_violation: params.titleViolation,
    home_place_leak_score: homePlaceLeakScore,
    repeated_phrase_score: repeatedPhraseScore,
    signature_ignored_from_analysis: true,
    repeated_surfaces: distinct(
      params.violations
        .filter((violation) => ["repeated_surface", "canonical_home_surface", "canonical_walk_place_surface", "poem_surface_reuse"].includes(violation.kind))
        .flatMap((violation) => violation.matches)
    ),
    final_status: severe ? "rejected_for_retry" : params.violations.length > 0 ? "accepted_with_warning" : "accepted"
  };
}

export async function analyzeGeneratedPoemSurface(
  poem: GeneratedSurfaceText,
  context: SurfaceAnalysisContext = {}
): Promise<SurfaceValidationReport> {
  const [world, recentPoems, traces, sources] = await Promise.all([
    context.world ? Promise.resolve(context.world) : readWorld(),
    context.recentPoems ? Promise.resolve(context.recentPoems) : listGeneratedPoems(),
    context.traces ? Promise.resolve(context.traces) : listMemoryTraces(),
    context.sources ? Promise.resolve(context.sources) : listSources()
  ]);
  const denylist = buildSurfaceDenylist({
    world,
    recentPoems,
    traces,
    repetition: context.repetition,
    windowSize: context.windowSize
  });
  const body = stripGeneratedSignature(poem.poem_text);
  const titleMatches = matchedTerms(poem.title, distinct([
    ...denylist.canonical_home_terms,
    ...denylist.canonical_walk_place_terms,
    ...denylist.overexposed_trace_terms,
    ...denylist.recent_title_terms
  ]));
  const titleTerms = tokenize(poem.title);
  const titleObjectList = titleMatches.length >= 2 && (titleTerms.length <= 5 || /[,/&|]/u.test(poem.title));
  const homeMatches = matchedTerms(body, denylist.canonical_home_terms);
  const walkMatches = matchedTerms(body, denylist.canonical_walk_place_terms);
  const repeatedSurfaceMatches = matchedTerms(body, distinct([...denylist.recent_repeated_surface_terms, ...denylist.overexposed_trace_terms]));
  const repeatedPhraseMatches = matchedPhrases(body, denylist.recent_repeated_phrases);
  const sourcePoemReuse = context.sourcePoem
    ? distinct([
        ...matchedPhrases(body, ngrams(context.sourcePoem.poem_text, 4)),
        ...matchedTerms(body, meaningfulTerms([context.sourcePoem.poem_text])).filter((term) =>
          denylist.blocked_terms.includes(term)
        )
      ])
    : [];
  const unsafe = await validateMemoryPromptFragments([poem.title, body], sources);
  const selfExplanation = selfExplanationPatterns.filter((pattern) => pattern.test(body)).map(() => "self_explanation");
  const homePlaceMatches = distinct([...homeMatches, ...walkMatches]);
  const violations: SurfaceViolation[] = [];

  pushViolation(violations, "title_overexposed_surface", "severe", titleMatches);
  pushViolation(violations, "title_object_list", "severe", titleObjectList ? titleMatches : []);
  pushViolation(violations, "canonical_home_surface", homeMatches.length >= 3 ? "severe" : "warning", homeMatches);
  pushViolation(violations, "canonical_walk_place_surface", walkMatches.length >= 3 ? "severe" : "warning", walkMatches);
  pushViolation(violations, "repeated_surface", repeatedSurfaceMatches.length >= 4 ? "severe" : "warning", repeatedSurfaceMatches);
  pushViolation(violations, "repeated_phrase", repeatedPhraseMatches.length >= 2 ? "severe" : "warning", repeatedPhraseMatches);
  pushViolation(
    violations,
    "poem_surface_reuse",
    sourcePoemReuse.length >= (context.mode === "dream" ? 3 : 2) ? "severe" : "warning",
    sourcePoemReuse
  );
  pushViolation(violations, "raw_source_unsafe", "severe", unsafe.valid ? [] : ["unsafe_public_text"]);
  pushViolation(violations, "self_explanation", "severe", selfExplanation);

  return metadataReport({
    violations,
    denylist,
    homePlaceMatches,
    repeatedPhrases: repeatedPhraseMatches,
    titleViolation: titleMatches.length > 0 || titleObjectList
  });
}

export async function analyzeGeneratedDreamSurface(
  dream: { title: string; dream_text: string },
  context: SurfaceAnalysisContext = {}
): Promise<SurfaceValidationReport> {
  return analyzeGeneratedPoemSurface(
    { title: dream.title, poem_text: dream.dream_text },
    { ...context, mode: "dream" }
  );
}

export function formatStrictSurfaceRetryConstraints(report: SurfaceValidationReport, mode: "poem" | "dream"): string {
  const kinds = distinct(report.surface_violations.map((violation) => violation.kind));
  return [
    "Kalite tekrarı: önceki aday sıkı yüzey doğrulamasını geçemedi.",
    `Kip: ${mode === "dream" ? "rüya" : "şiir"}.`,
    `İhlal türleri: ${kinds.join(",") || "yok"}.`,
    `Engellenen yüzey terimi sayısı: ${report.blocked_surface_terms_count}.`,
    "Ev, yer ve yürüyüş yüzeylerini doğrudan kullanma.",
    "Yakın dönem cümlelerini veya aşırı görünür başlık kelimelerini yeniden kullanma.",
    mode === "dream" ? "Kaynak şiirin kalıntısını yüzeyini kopyalamadan dönüştür." : "Başlığı somut bir yüzeyden değil, ilişki veya değişimden kur.",
    "Yazma sürecini veya personayı açıklama."
  ].join("\n");
}

export function surfaceMetadata(report: SurfaceValidationReport, retryCount: number) {
  return {
    surface_validation_passed: report.surface_validation_passed,
    surface_violations: report.surface_violations,
    retry_count: retryCount,
    blocked_surface_terms_count: report.blocked_surface_terms_count,
    title_violation: report.title_violation,
    home_place_leak_score: report.home_place_leak_score,
    repeated_phrase_score: report.repeated_phrase_score,
    signature_ignored_from_analysis: report.signature_ignored_from_analysis,
    surface_validation_status: report.severe ? "accepted_with_warning" as const : report.final_status
  };
}

function hasSurfaceMetadata(generation: PoemGenerationMeta): boolean {
  return generation.surface_validation_passed !== undefined || generation.surface_violations !== undefined;
}

function validSurfaceMetadata(generation: PoemGenerationMeta): boolean {
  const severe = generation.surface_violations?.some((violation) => violation.severity === "severe") ?? false;
  return (
    typeof generation.surface_validation_passed === "boolean" &&
    Array.isArray(generation.surface_violations) &&
    generation.surface_violations.every(
      (violation) =>
        violation &&
        (violation.severity === "warning" || violation.severity === "severe") &&
        typeof violation.kind === "string" &&
        Array.isArray(violation.matches)
    ) &&
    typeof generation.retry_count === "number" &&
    generation.retry_count >= 0 &&
    typeof generation.blocked_surface_terms_count === "number" &&
    typeof generation.title_violation === "boolean" &&
    typeof generation.home_place_leak_score === "number" &&
    typeof generation.repeated_phrase_score === "number" &&
    generation.signature_ignored_from_analysis === true &&
    ["accepted", "accepted_with_warning", "rejected_for_retry"].includes(generation.surface_validation_status ?? "") &&
    generation.surface_validation_passed === !severe
  );
}

export async function validateStoredSurfaceRecords(params: {
  poems: DailyPoem[];
  dreams: DreamRecord[];
  traces: MemoryTrace[];
  sources: SourceBundle[];
  world?: World;
  repetition?: RepetitionPressure;
}) {
  const world = params.world ?? (await readWorld());
  const records = [
    ...params.poems.map((record) => ({ origin: `poem:${record.date}`, mode: "poem" as const, record })),
    ...params.dreams.map((record) => ({ origin: `dream:${record.date}`, mode: "dream" as const, record }))
  ];
  const enriched = records.filter(({ record }) => hasSurfaceMetadata(record.generation));
  const invalidMetadata = enriched.filter(({ record }) => !validSurfaceMetadata(record.generation)).map(({ origin }) => origin);
  const severeWithoutRetry = enriched
    .filter(({ record }) =>
      record.generation.provider === "openai" &&
      (record.generation.surface_violations ?? []).some((violation) => violation.severity === "severe") &&
      (record.generation.retry_count ?? 0) < 1
    )
    .map(({ origin }) => origin);
  const signatureViolations = enriched
    .filter(({ record }) =>
      (record.generation.surface_violations ?? []).some((violation) => String(violation.kind).includes("signature")) ||
      record.generation.signature_ignored_from_analysis !== true
    )
    .map(({ origin }) => origin);
  const computed = await Promise.all(
    enriched.map(async ({ origin, mode, record }) => {
      const priorPoems = params.poems.filter((poem) => poem.date < record.date);
      const report =
        mode === "poem"
          ? await analyzeGeneratedPoemSurface(
              { title: record.title, poem_text: (record as DailyPoem).poem_text },
              { mode, world, repetition: params.repetition, recentPoems: priorPoems, traces: params.traces, sources: params.sources }
            )
          : await analyzeGeneratedDreamSurface(
              { title: record.title, dream_text: (record as DreamRecord).dream_text },
              {
                mode,
                world,
                repetition: params.repetition,
                recentPoems: priorPoems,
                traces: params.traces,
                sources: params.sources,
                sourcePoem: params.poems.find((poem) => poem.date === (record as DreamRecord).source_date)
              }
            );
      return { origin, report, generation: record.generation };
    })
  );
  const unsafeGeneratedText = computed
    .filter(({ report }) => report.surface_violations.some((violation) => violation.kind === "raw_source_unsafe"))
    .map(({ origin }) => origin);
  const titleWarnings = computed
    .filter(({ report, generation }) => report.title_violation && generation.title_violation !== true)
    .map(({ origin }) => origin);
  return {
    valid: invalidMetadata.length === 0 && severeWithoutRetry.length === 0 && signatureViolations.length === 0 && unsafeGeneratedText.length === 0,
    metadata_records: {
      with_surface_validation: enriched.length,
      legacy_without_surface_validation: records.length - enriched.length
    },
    invalid_surface_validation_metadata: invalidMetadata,
    severe_violation_without_retry: severeWithoutRetry,
    signature_violations: signatureViolations,
    unsafe_generated_text: unsafeGeneratedText,
    title_overexposed_without_warning: titleWarnings
  };
}
