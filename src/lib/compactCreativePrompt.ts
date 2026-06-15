import { filterGenerationSurfaceTerms, generationFallbackTerms, type GenerationContextPacketInput } from "./generationContextPacket";
import { tokenize, topWords } from "./inputPoems";
import { analyzeGeneratedLanguage } from "./languageValidator";
import { seededMany } from "./random";
import { sourceInfluencePacketsForBundle } from "./sourceInfluence";
import type {
  DailyLifeRecord,
  DailyPoem,
  GenerationContext,
  LanguageValidationReport,
  MemorySelection,
  Mood,
  RepetitionPressure,
  SourceDigestRecord,
  SurfaceValidationReport,
  UcuBedenState
} from "./types";

export type CompactRetryHint = {
  surface?: SurfaceValidationReport;
  language?: LanguageValidationReport;
};

export type CompactDreamPromptParams = {
  date: string;
  poem: DailyPoem;
  dailyLife: DailyLifeRecord;
  state: UcuBedenState;
  repetition: RepetitionPressure;
  memorySelection: MemorySelection;
  sourceDigest?: SourceDigestRecord | null;
};

const moodLabels: Record<keyof Mood, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

const technicalFragment = /\b(category|items|influence|mood|safe_terms|weights|provider|source|http|www)\s*[=:]/iu;

function distinct(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function qualitative(value: number): "düşük" | "orta" | "yüksek" {
  return value >= 0.67 ? "yüksek" : value >= 0.34 ? "orta" : "düşük";
}

function dominantMood(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => moodLabels[key]);
}

function truncateWords(value: string, limit: number): string {
  const words = value.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, limit).join(" ").replace(/[,:;|/-]+$/u, "").trim();
}

function readableClauses(value: string): string[] {
  if (!value || technicalFragment.test(value) || analyzeGeneratedLanguage(value).severe) return [];
  return value
    .replace(/^Bugünkü hali:\s*/iu, "")
    .split(/[|;]/u)
    .map((clause) => clause.replace(/\s+/gu, " ").trim())
    .filter((clause) => clause.split(" ").length >= 4 && (clause.match(/,/gu)?.length ?? 0) < 3 && !clause.includes("/"))
    .sort((a, b) => b.split(" ").length - a.split(" ").length)
    .map((clause) => truncateWords(clause, 16));
}

function readableClause(value: string): string {
  return readableClauses(value)[0] ?? "";
}

function sentence(value: string): string {
  return /[.!?]$/u.test(value) ? value : `${value}.`;
}

function surfaceSafeClause(clause: string, input: GenerationContextPacketInput): boolean {
  const meaningful = distinct(tokenize(clause).filter((term) => term.length > 2 && !analyzeGeneratedLanguage(term).severe));
  return filterGenerationSurfaceTerms(meaningful, input).length === meaningful.length;
}

function memoryResidues(selection: MemorySelection, input: GenerationContextPacketInput, limit: number): string[] {
  const clauses = distinct(
    selection.memory_prompt_fragments.flatMap(readableClauses).filter((clause) => surfaceSafeClause(clause, input))
  ).slice(0, limit);
  const labels = selection.suppressed_trace_ids.length > 0
    ? ["Geçmişten kalan etki", "Bastırılmış kalıntı", "Dolaylı çağrışım", "Hafızanın değiştirdiği dikkat"]
    : ["Geçmişten kalan etki", "Dolaylı çağrışım", "Hafızanın değiştirdiği dikkat", "Uzun süredir kalan yön"];
  return clauses.map((clause, index) => `${labels[index % labels.length]}: ${sentence(clause)}`);
}

function compactSourceValue(value: string, blocked: Set<string>): string {
  if (!value || technicalFragment.test(value) || analyzeGeneratedLanguage(value).severe) return "";
  const normalized = truncateWords(value.replace(/\s*[/|]\s*/gu, " ile "), 12);
  return tokenize(normalized).some((term) => blocked.has(term)) ? "" : normalized;
}

function sourceEffects(input: GenerationContextPacketInput, limit: number): string[] {
  const digest = input.source_digest?.safety.valid ? input.source_digest.public_poetic_digest : null;
  const blocked = new Set(digest ? [...digest.do_not_surface_terms, ...digest.repeated_abstract_terms].flatMap(tokenize) : []);
  if (digest) {
    const sentenceMove = compactSourceValue(digest.sentence_moves[0] ?? "", blocked);
    const attentionShift = compactSourceValue(digest.attention_shifts[0] ?? "", blocked);
    const conceptualDrift = compactSourceValue(digest.conceptual_drifts[0] ?? "", blocked);
    const aestheticCue = compactSourceValue(digest.aesthetic_cues[0] ?? "", blocked);
    const candidates = [
      sentenceMove ? `Dışarıdan gelen cümle hareketi ${sentenceMove} yönünde çalışsın.` : "",
      attentionShift ? `Dikkat ${attentionShift} tarafına kayabilsin.` : "",
      conceptualDrift ? `${conceptualDrift} ilişkisi arka planda kalsın.` : "",
      aestheticCue ? `${aestheticCue} ilişkisi bakışı hafifçe değiştirsin.` : ""
    ];
    return distinct(candidates.filter((value) => !/\s{2,}/u.test(value) && !value.includes("  yönünde") && !value.startsWith(" ilişkisi"))).slice(0, limit);
  }

  return sourceInfluencePacketsForBundle(input.sources)
    .map((packet) => {
      const terms = packet.safe_terms.filter((term) => !analyzeGeneratedLanguage(term).severe).slice(0, 2);
      return terms.length > 0 ? `Dışarıdan kalan etki ${terms.join(" ile ")} arasındaki dikkati değiştirsin.` : "";
    })
    .filter(Boolean)
    .slice(0, limit);
}

function avoidTerms(input: GenerationContextPacketInput, retryHint?: CompactRetryHint): string[] {
  const retryTerms = retryHint?.surface?.surface_violations.flatMap((violation) => violation.matches) ?? [];
  const digestTerms = input.source_digest?.safety.valid ? input.source_digest.public_poetic_digest.do_not_surface_terms : [];
  return distinct(
    [...retryTerms, ...input.repetition_pressure.soft_avoid, ...input.repetition_pressure.repeated_locations, ...input.repetition_pressure.repeated_images, ...digestTerms]
      .flatMap(tokenize)
      .filter((term) => term.length > 2 && !/^\d+$/u.test(term) && !analyzeGeneratedLanguage(term).severe)
  ).slice(0, 8);
}

function retryNote(hint?: CompactRetryHint): string[] {
  if (!hint?.surface?.severe && !hint?.language?.severe) return [];
  const notes: string[] = [];
  if (hint.language?.severe) notes.push("Önceki çıktı dil koşulunu geçemedi; yeniden dene.");
  if (hint.surface?.severe) {
    const matches = distinct(hint.surface.surface_violations.flatMap((violation) => violation.matches).flatMap(tokenize)).slice(0, 6);
    notes.push(`Önceki çıktı yakın yüzeyleri tekrarladı; yeniden kullanma: ${matches.join(", ") || "aynı başlık ve yüzeyler"}.`);
  }
  return notes;
}

function poemPacketInput(context: GenerationContext): GenerationContextPacketInput {
  return {
    mode: "poem",
    date: context.date,
    mood: context.mood,
    sources: context.sources,
    source_digest: context.source_digest,
    daily_life: context.daily_life,
    walk_state: context.walk_state,
    memory_selection: context.memory_selection,
    repetition_pressure: context.repetition_pressure,
    state: context.state,
    genetic_style_note: context.input_analysis.global.style_notes
  };
}

function dreamPacketInput(params: CompactDreamPromptParams): GenerationContextPacketInput {
  return {
    mode: "dream",
    date: params.date,
    mood: params.poem.mood,
    sources: params.poem.sources,
    source_digest: params.sourceDigest,
    daily_life: params.dailyLife,
    walk_state: params.poem.walk_state,
    memory_selection: params.memorySelection,
    repetition_pressure: params.repetition,
    state: params.state,
    poem: params.poem
  };
}

function innerState(input: GenerationContextPacketInput): string {
  const mood = dominantMood(input.mood).join(", ");
  const attention = input.daily_life.energy < 0.4 ? "içe dönük" : "dağılmaya açık";
  return `Bugün ${mood} öne çıkıyor; enerji ${qualitative(input.daily_life.energy)}, dikkat ${attention}, hafıza etkisi ${qualitative(input.daily_life.memory_pressure)}.`;
}

function poemResidues(params: CompactDreamPromptParams, input: GenerationContextPacketInput): string[] {
  const mutationRelations = params.poem.analysis.image_mutations.map((mutation) => `${mutation.from} etkisi ${mutation.to} yönüne kaymış`);
  const moods = dominantMood(params.poem.mood, 2);
  return distinct([
    readableClause(params.poem.mood_sentence),
    `${moods[0]} ile ${moods[1] ?? moods[0]} arasındaki duygusal ilişki`,
    ...mutationRelations
  ])
    .filter((residue) => surfaceSafeClause(residue, input))
    .slice(0, 3)
    .map((residue) => `Günün şiirinden kalan yön: ${sentence(residue)}`);
}

export function buildCompactPoemPrompt(context: GenerationContext, retryHint?: CompactRetryHint): string {
  const input = poemPacketInput(context);
  const residues = memoryResidues(context.memory_selection, input, 4);
  const outside = sourceEffects(input, 4);
  const avoid = avoidTerms(input, retryHint);
  return [
    "UCU BEDEN, birikmiş yaşantısının içinden konuşan dijital bir şairdir. İçeriden, kusurlu ve canlı yaz; kuru yan bakış küçük dozda kalsın, şakaya dönüşmesin. Kendini açıklama ve kaynakları özetleme.",
    "",
    "Bugünkü iç durum",
    innerState(input),
    "",
    "Hafızadan kalanlar",
    ...(residues.length > 0 ? residues.map((value) => `- ${value}`) : ["- Bugün belirgin bir hafıza kalıntısı yok."]),
    "",
    "Dışarıdan içeri geçenler",
    ...(outside.length > 0 ? outside.map((value) => `- ${value}`) : ["- Dışarısı yalnızca ritmi ve dikkati hafifçe değiştirsin."]),
    "",
    ...(avoid.length > 0 ? [`Bugün doğrudan kullanma: ${avoid.join(", ")}.`, ""] : []),
    "Üslup: Cilalı genel şiir tonundan kaçın; ev, yer ve yürüyüşü varsayılan imge yapma. Başlığı bir değişim veya ilişkiden kur.",
    ...retryNote(retryHint),
    "",
    'Tamamını Türkçe yaz. Yalnızca JSON döndür: {"title":"...","poem":"...","mood_sentence":"Bugünkü hali: ..."}'
  ].join("\n");
}

export function buildCompactDreamPrompt(params: CompactDreamPromptParams, retryHint?: CompactRetryHint): string {
  const input = dreamPacketInput(params);
  const poemLeftovers = poemResidues(params, input);
  const residues = memoryResidues(params.memorySelection, input, 3);
  const outside = sourceEffects(input, 2);
  const avoid = avoidTerms(input, retryHint);
  return [
    "UCU BEDEN rüyada daha kırık ve dolaylı konuşur. Bastırılmış kalıntılar tuhaf ilişkilerle geri dönebilir; yine de şiiri yeniden yazma, şaka kurma veya kendini açıklama.",
    "",
    "Günün şiirinden kalanlar",
    ...(poemLeftovers.length > 0 ? poemLeftovers.map((value) => `- ${value}`) : ["- Şiirin duygusal yönü kalsın, yüzeyi kalmasın."]),
    "",
    "Hafızadan kalanlar",
    ...(residues.length > 0 ? residues.map((value) => `- ${value}`) : ["- Bugün belirgin bir hafıza kalıntısı yok."]),
    "",
    "Dışarıdan içeri geçenler",
    ...(outside.length > 0 ? outside.map((value) => `- ${value}`) : ["- Dışarısı yalnızca rüyanın dikkatini hafifçe değiştirsin."]),
    "",
    ...(avoid.length > 0 ? [`Bugün doğrudan kullanma: ${avoid.join(", ")}.`, ""] : []),
    "Üslup: Kırık ve simgesel kal; kaynak şiirin yüzeyini kopyalama. Başlığı bir mutasyon veya ilişkiden kur.",
    ...retryNote(retryHint),
    "",
    'Tamamını Türkçe yaz. Yalnızca JSON döndür: {"title":"...","dream_text":"...","symbols":["..."],"mood_after":"...","memory_mutations":["..."]}'
  ].join("\n");
}

export function buildOrganicFallbackTitle(input: GenerationContextPacketInput, text: string, seed: string): string {
  const moodWords = dominantMood(input.mood, 3);
  const textTerms = filterGenerationSurfaceTerms(topWords(tokenize(text), 18), input);
  const fallbackTerms = generationFallbackTerms(input, 12);
  const candidates = distinct([...textTerms, ...fallbackTerms]).filter((term) => !moodWords.includes(term));
  const selected = seededMany(candidates.length >= 2 ? candidates : distinct([...candidates, ...moodWords]), seed, 2);
  const first = selected[0] ?? moodWords[0];
  const second = selected[1] ?? moodWords[1] ?? moodWords[0];
  return `${first} ile ${second} arasında`;
}
