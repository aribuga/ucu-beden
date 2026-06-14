import { tokenize } from "./inputPoems";
import { analyzeGeneratedLanguage } from "./languageValidator";
import { buildSourceInfluencePackets, sourcePublicTextUnsafeMatches, sourceUnsafeTermSet } from "./sourceInfluence";
import type {
  DailyPoem,
  MoodTaggedSourceItem,
  SourceBundle,
  SourceDigestRecord,
  SourceDigestValidation,
  SourceInfluencePacket,
  SourcePublicPoeticDigest
} from "./types";

type OpenAIPublicDigest = Pick<
  SourcePublicPoeticDigest,
  | "safe_vocabulary_candidates"
  | "conceptual_drifts"
  | "aesthetic_cues"
  | "rhythm_cues"
  | "attention_shifts"
  | "image_expansion_candidates"
  | "sentence_moves"
  | "internalized_effect"
>;

const publicFields: Array<keyof OpenAIPublicDigest> = [
  "safe_vocabulary_candidates",
  "conceptual_drifts",
  "aesthetic_cues",
  "rhythm_cues",
  "attention_shifts",
  "image_expansion_candidates",
  "sentence_moves",
  "internalized_effect"
];

const commonTerms = new Set(
  tokenize("bir bu şu ve ile için gibi daha çok ama çünkü kadar olan olarak var yok yeni son bugün dünya haber ilk her kendi sonra önce")
);

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalized(value: string): string {
  return tokenize(value).join(" ");
}

function rounded(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function cleanEntityToken(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function detectedEntities(title: string): string[] {
  return distinct(
    title
      .split(/\s+/g)
      .map(cleanEntityToken)
      .filter((token) => token.length > 1 && /\p{L}/u.test(token) && (/^\p{Lu}/u.test(token) || token === token.toLocaleUpperCase("tr")))
  );
}

function privateDigest(source: SourceBundle): SourceDigestRecord["private_factual_digest"] {
  return {
    items: (source.rss?.items ?? []).map((item) => ({
      source_title: item.title,
      url: item.url ?? null,
      source_name: item.source,
      category: item.category,
      factual_summary: item.title,
      detected_entities: detectedEntities(item.title),
      topics: item.keywords
    })),
    source_health: source.rss?.sources ?? []
  };
}

function repeatedAbstractTerms(poems: DailyPoem[], windowSize = 20): string[] {
  const window = poems.slice(-windowSize);
  const documents = new Map<string, number>();
  for (const poem of window) {
    const terms = new Set(tokenize(`${poem.title} ${poem.poem_text}`).filter((term) => term.length >= 4 && !commonTerms.has(term) && !/^\d+$/.test(term)));
    for (const term of terms) documents.set(term, (documents.get(term) ?? 0) + 1);
  }
  const minimum = Math.max(3, Math.ceil(window.length * 0.3));
  return Array.from(documents.entries())
    .filter(([, count]) => count >= minimum)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, 18)
    .map(([term]) => term);
}

function titleSentenceMoves(items: MoodTaggedSourceItem[]): string[] {
  const moves: string[] = [];
  const lengths = items.map((item) => tokenize(item.title).length);
  if (lengths.some((length) => length <= 6) && lengths.some((length) => length >= 12)) moves.push("kısa ve uzun cümlelerin dönüşümlü kullanımı");
  if (items.some((item) => item.title.includes("?"))) moves.push("doğrudan yanıt vermeyen soru dönüşü");
  if (items.some((item) => /[:;]/u.test(item.title))) moves.push("cümle ortasında yön değiştiren bağlantı");
  if (items.some((item) => /[-–—]/u.test(item.title))) moves.push("kesintili cümle hareketi");
  if (items.some((item) => item.title.split(",").length >= 3)) moves.push("yoğun yan cümle dizisi");
  if (moves.length === 0) moves.push(lengths.reduce((sum, value) => sum + value, 0) / Math.max(1, lengths.length) > 10 ? "uzatılmış cümle hareketi" : "sıkıştırılmış cümle hareketi");
  return distinct(moves);
}

function turkishPublicText(value: string): boolean {
  const report = analyzeGeneratedLanguage(value);
  return !report.severe && report.english_matches.length === 0;
}

function categoryTerms(items: MoodTaggedSourceItem[], category: MoodTaggedSourceItem["category"]): string[] {
  return distinct(items.filter((item) => item.category === category).flatMap((item) => [...item.keywords, ...tokenize(item.shortAtmosphere)]))
    .filter((term) => term.length >= 3 && !commonTerms.has(term) && turkishPublicText(term))
    .slice(0, 12);
}

function pairTerms(terms: string[], limit = 4): string[] {
  return terms.slice(0, limit * 2).flatMap((term, index) => (index % 2 === 0 && terms[index + 1] ? [`${term} / ${terms[index + 1]}`] : [])).slice(0, limit);
}

function deterministicPublicDigest(source: SourceBundle, repeated: string[]): OpenAIPublicDigest {
  const items = source.rss?.items ?? [];
  const packets = buildSourceInfluencePackets(items, [], source);
  const safeVocabulary = distinct(packets.flatMap((packet) => [...packet.novelty_terms, ...packet.safe_terms]))
    .filter((term) => !repeated.includes(term) && turkishPublicText(term))
    .slice(0, 24);
  const art = categoryTerms(items, "art");
  const science = categoryTerms(items, "science_culture");
  const entertainment = categoryTerms(items, "entertainment");
  const life = categoryTerms(items, "life");
  const news = categoryTerms(items, "news");
  return {
    safe_vocabulary_candidates: safeVocabulary,
    conceptual_drifts: pairTerms(science.length > 0 ? science : safeVocabulary),
    aesthetic_cues: pairTerms([...art, ...life]),
    rhythm_cues: distinct([...titleSentenceMoves(items), ...pairTerms(entertainment, 3)]).slice(0, 8),
    attention_shifts: pairTerms([...life, ...entertainment, ...news]),
    image_expansion_candidates: pairTerms([...art, ...science, ...life]),
    sentence_moves: titleSentenceMoves(items),
    internalized_effect: distinct(packets.map((packet) => packet.safe_terms.filter((term) => !repeated.includes(term)).slice(0, 4).join(" / "))).filter(Boolean)
  };
}

function ngrams(value: string, size: number): string[] {
  const words = tokenize(value);
  return words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(" "));
}

function rawSentenceOverlaps(fragment: string, source: SourceBundle): string[] {
  const value = ` ${normalized(fragment)} `;
  return distinct(
    (source.rss?.items ?? []).flatMap((item) => [...ngrams(item.title, 4), ...ngrams(item.title, 5)]).filter((phrase) => value.includes(` ${phrase} `))
  );
}

function sanitizePublicDigest(candidate: OpenAIPublicDigest, source: SourceBundle, repeated: string[]) {
  const unsafeTerms = sourceUnsafeTermSet(source.rss?.items ?? [], source);
  const repeatedSet = new Set(repeated.map(normalized));
  const rejected = new Map<string, number>();
  const cleanField = (field: keyof OpenAIPublicDigest): string[] =>
    distinct(candidate[field] ?? [])
      .filter((fragment) => {
        const unsafe = sourcePublicTextUnsafeMatches(fragment, unsafeTerms);
        const overlaps = rawSentenceOverlaps(fragment, source);
        const repeatsBlockedTerm = tokenize(fragment).some((term) => repeatedSet.has(term));
        const language = analyzeGeneratedLanguage(fragment);
        if (unsafe.length > 0) rejected.set("raw_entity_or_source", (rejected.get("raw_entity_or_source") ?? 0) + 1);
        if (overlaps.length > 0) rejected.set("raw_sentence_overlap", (rejected.get("raw_sentence_overlap") ?? 0) + 1);
        if (repeatsBlockedTerm) rejected.set("repeated_abstract_term", (rejected.get("repeated_abstract_term") ?? 0) + 1);
        if (language.english_matches.length > 0) rejected.set("ingilizce_terim", (rejected.get("ingilizce_terim") ?? 0) + 1);
        return unsafe.length === 0 && overlaps.length === 0 && !repeatsBlockedTerm && language.english_matches.length === 0 && !/https?:|www\.|@/iu.test(fragment);
      })
      .slice(0, field === "safe_vocabulary_candidates" ? 24 : 10);
  const safe = Object.fromEntries(publicFields.map((field) => [field, cleanField(field)])) as OpenAIPublicDigest;
  const safeRepeated = distinct(repeated)
    .filter((term) => {
      const unsafe = sourcePublicTextUnsafeMatches(term, unsafeTerms);
      const overlaps = rawSentenceOverlaps(term, source);
      return unsafe.length === 0 && overlaps.length === 0 && turkishPublicText(term) && !/https?:|www\.|@/iu.test(term);
    })
    .slice(0, 24);
  return {
    publicDigest: {
      ...safe,
      rejected_unsafe_terms: Array.from(rejected.entries()).map(([reason, count]) => `${reason}:${count}`),
      do_not_surface_terms: safeRepeated,
      repeated_abstract_terms: safeRepeated
    } satisfies SourcePublicPoeticDigest,
    rejected
  };
}

function publicDigestText(publicDigest: SourcePublicPoeticDigest): string[] {
  return [
    ...publicDigest.safe_vocabulary_candidates,
    ...publicDigest.conceptual_drifts,
    ...publicDigest.aesthetic_cues,
    ...publicDigest.rhythm_cues,
    ...publicDigest.attention_shifts,
    ...publicDigest.image_expansion_candidates,
    ...publicDigest.sentence_moves,
    ...publicDigest.internalized_effect,
    ...publicDigest.do_not_surface_terms,
    ...publicDigest.repeated_abstract_terms
  ];
}

function digestSimilarity(publicDigest: SourcePublicPoeticDigest, history: SourceDigestRecord[]): number {
  const current = new Set(publicDigestText(publicDigest).flatMap(tokenize));
  if (current.size === 0 || history.length === 0) return 0;
  const similarities = history.slice(-7).map((record) => {
    const previous = new Set(publicDigestText(record.public_poetic_digest).flatMap(tokenize));
    const intersection = Array.from(current).filter((term) => previous.has(term)).length;
    return intersection / Math.max(1, new Set([...current, ...previous]).size);
  });
  return rounded(similarities.reduce((sum, value) => sum + value, 0) / similarities.length);
}

function digestInfluencePackets(source: SourceBundle, publicDigest: SourcePublicPoeticDigest): SourceInfluencePacket[] {
  const blocked = new Set(publicDigest.do_not_surface_terms.map(normalized));
  const fallback = buildSourceInfluencePackets(source.rss?.items ?? [], [], source);
  return fallback.map((packet, index) => {
    const terms = distinct([...packet.safe_terms, ...publicDigest.safe_vocabulary_candidates])
      .filter((term) => !blocked.has(normalized(term)) && turkishPublicText(term))
      .slice(0, 12);
    const effect = publicDigest.internalized_effect[index % Math.max(1, publicDigest.internalized_effect.length)] ?? terms.slice(0, 4).join(" / ");
    const movement = publicDigest.sentence_moves[index % Math.max(1, publicDigest.sentence_moves.length)] ?? publicDigest.rhythm_cues[0] ?? "";
    return {
      ...packet,
      safe_terms: terms,
      novelty_terms: terms.filter((term) => !packet.repeated_terms.includes(term)).slice(0, 8),
      repeated_terms: packet.repeated_terms.filter((term) => !blocked.has(normalized(term))),
      rejected_terms: distinct([...packet.rejected_terms, ...publicDigest.rejected_unsafe_terms]),
      summary_for_prompt: distinct([effect, movement]).filter(Boolean).join("; ")
    };
  });
}

function parseOpenAIPublicDigest(text: string): OpenAIPublicDigest | null {
  const value = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  try {
    const parsed = JSON.parse(start >= 0 && end > start ? value.slice(start, end + 1) : value) as Record<string, unknown>;
    if (!publicFields.every((field) => Array.isArray(parsed[field]) && (parsed[field] as unknown[]).every((item) => typeof item === "string"))) return null;
    return parsed as OpenAIPublicDigest;
  } catch {
    return null;
  }
}

async function openAIPublicDigest(source: SourceBundle): Promise<{ digest: OpenAIPublicDigest | null; model: string; error: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) return { digest: null, model, error: "OPENAI_API_KEY is not set" };
  const schemaProperties = Object.fromEntries(publicFields.map((field) => [field, { type: "array", items: { type: "string" } }]));
  const inputItems = (source.rss?.items ?? []).map((item) => ({
    category: item.category,
    title: item.title,
    keywords: item.keywords,
    short_atmosphere: item.shortAtmosphere,
    mood_tags: item.moodTags
  }));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_output_tokens: 900,
        input: [
          "Kaynak malzemeyi UCU BEDEN için güvenli dil öğrenme malzemesine sindir.",
          "Şiir, haber özeti, olgu raporu veya kaynak özeti yazma.",
          "Başlıkları, cümleleri, adları, sağlayıcıları, kişileri, kurumları, ülkeleri, bağlantıları veya olguları tekrarlama.",
          "Yalnızca aktarılabilir Türkçe kelimeler, kavramsal ilişkiler, estetik ipuçları, ritim davranışları, dikkat hareketleri, imge genişlemeleri, cümle davranışları ve içselleştirilmiş etkiler çıkar.",
          "Bütün alanların bütün değerleri Türkçe olmalı. İngilizce kaynaklardan gelen kavramları Türkçeye sindir.",
          "Cümle hareketleri kaynak cümleyi kopyalamadan davranışı Türkçe tarif etmeli.",
          JSON.stringify(inputItems)
        ].join("\n"),
        text: {
          format: {
            type: "json_schema",
            name: "ucu_beden_source_public_digest",
            strict: true,
            schema: {
              type: "object",
              properties: schemaProperties,
              required: publicFields,
              additionalProperties: false
            }
          }
        }
      })
    });
    if (!response.ok) return { digest: null, model, error: `OpenAI returned ${response.status}` };
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? "";
    const digest = parseOpenAIPublicDigest(text);
    return { digest, model, error: digest ? null : "OpenAI response had no valid source digest" };
  } catch (error) {
    return { digest: null, model, error: error instanceof Error ? error.message : "OpenAI source digestion failed" };
  }
}

export async function digestSourcesWithOpenAI(params: {
  source: SourceBundle;
  history?: SourceDigestRecord[];
  recentPoems?: DailyPoem[];
}): Promise<SourceDigestRecord> {
  const history = (params.history ?? []).filter((digest) => digest.date < params.source.date);
  const repeated = repeatedAbstractTerms((params.recentPoems ?? []).filter((poem) => poem.date < params.source.date));
  const fallback = deterministicPublicDigest(params.source, repeated);
  const openAI = await openAIPublicDigest(params.source);
  const candidate = openAI.digest ?? fallback;
  const { publicDigest } = sanitizePublicDigest(candidate, params.source, repeated);
  const packets = digestInfluencePackets(params.source, publicDigest);
  const unsafeTerms = sourceUnsafeTermSet(params.source.rss?.items ?? [], params.source);
  const unsafePublicMatches = distinct(publicDigestText(publicDigest).flatMap((text) => sourcePublicTextUnsafeMatches(text, unsafeTerms)));
  const rawSentenceOverlap = distinct(publicDigestText(publicDigest).flatMap((text) => rawSentenceOverlaps(text, params.source)));
  const privatePublicSeparation = unsafePublicMatches.length === 0 && rawSentenceOverlap.length === 0;
  const publicLanguageSafe = publicDigestText(publicDigest).every(turkishPublicText);
  return {
    date: params.source.date,
    generated_at: new Date().toISOString(),
    provider: openAI.digest ? "openai" : "deterministic",
    model: openAI.digest ? openAI.model : null,
    fallback_reason: openAI.digest ? null : openAI.error,
    private_factual_digest: privateDigest(params.source),
    public_poetic_digest: publicDigest,
    source_influence_packet: packets,
    safety: {
      valid: privatePublicSeparation && publicLanguageSafe,
      private_public_separation: privatePublicSeparation,
      unsafe_public_matches: unsafePublicMatches,
      raw_sentence_overlap: rawSentenceOverlap
    },
    similarity: {
      compared_digest_count: Math.min(7, history.length),
      recent_digest_similarity: digestSimilarity(publicDigest, history),
      repeated_abstract_terms: repeated
    }
  };
}

export function publicPoeticDigestPromptFragments(digest: SourceDigestRecord | null | undefined): string[] {
  if (!digest?.safety.valid) return [];
  const publicDigest = digest.public_poetic_digest;
  const rows: Array<[string, string[]]> = [
    ["Kelime öğrenme", publicDigest.safe_vocabulary_candidates],
    ["Kavramsal kayma", publicDigest.conceptual_drifts],
    ["Estetik ipuçları", publicDigest.aesthetic_cues],
    ["Ritim ipuçları", publicDigest.rhythm_cues],
    ["Dikkat kaymaları", publicDigest.attention_shifts],
    ["İmge genişlemesi", publicDigest.image_expansion_candidates],
    ["Cümle hareketleri", publicDigest.sentence_moves],
    ["İçselleştirilmiş etki", publicDigest.internalized_effect],
    ["Doğrudan yüzeye çıkarma", publicDigest.do_not_surface_terms]
  ];
  return rows.filter(([, values]) => values.length > 0).map(([label, values]) => `${label}: ${values.slice(0, 8).join(" | ")}`);
}

export function validateSourceDigests(digests: SourceDigestRecord[], sources: SourceBundle[]): SourceDigestValidation {
  const sourceByDate = new Map(sources.map((source) => [source.date, source]));
  const invalidDates: string[] = [];
  const missingSourceDates: string[] = [];
  const unsafePublic: Array<{ date: string; matches: string[] }> = [];
  const separationFailures: string[] = [];
  const missingPackets: string[] = [];
  const nonTurkishPublic: Array<{ date: string; matches: string[] }> = [];
  for (const digest of digests) {
    const source = sourceByDate.get(digest.date);
    if (!source) {
      missingSourceDates.push(digest.date);
      continue;
    }
    const unsafe = sourceUnsafeTermSet(source.rss?.items ?? [], source);
    const matches = distinct(publicDigestText(digest.public_poetic_digest).flatMap((text) => sourcePublicTextUnsafeMatches(text, unsafe)));
    const overlaps = distinct(publicDigestText(digest.public_poetic_digest).flatMap((text) => rawSentenceOverlaps(text, source)));
    const nonTurkish = distinct(publicDigestText(digest.public_poetic_digest).flatMap((text) => analyzeGeneratedLanguage(text).english_matches));
    if (matches.length > 0 || overlaps.length > 0) unsafePublic.push({ date: digest.date, matches: distinct([...matches, ...overlaps.map(() => "raw_sentence_overlap")]) });
    if (!digest.safety.private_public_separation || matches.length > 0 || overlaps.length > 0) separationFailures.push(digest.date);
    if (digest.source_influence_packet.length === 0) missingPackets.push(digest.date);
    if (nonTurkish.length > 0) nonTurkishPublic.push({ date: digest.date, matches: nonTurkish });
    if (!digest.safety.valid || !Array.isArray(digest.public_poetic_digest.repeated_abstract_terms)) invalidDates.push(digest.date);
  }
  return {
    valid: invalidDates.length === 0 && missingSourceDates.length === 0 && unsafePublic.length === 0 && separationFailures.length === 0 && missingPackets.length === 0 && nonTurkishPublic.length === 0,
    digest_count: digests.length,
    source_digest_available: digests.length > 0,
    invalid_digest_dates: distinct(invalidDates),
    missing_source_dates: distinct(missingSourceDates),
    unsafe_public_digest: unsafePublic,
    private_public_separation_failures: distinct(separationFailures),
    missing_digest_influence_packet: distinct(missingPackets),
    repeated_abstract_terms_available: digests.every((digest) => Array.isArray(digest.public_poetic_digest.repeated_abstract_terms)),
    non_turkish_public_digest: nonTurkishPublic
  };
}
