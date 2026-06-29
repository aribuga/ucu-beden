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
  UcuBedenState,
  VisualBrief
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

const avoidStopTerms = new Set(
  tokenize(
    [
      "değil hafif arasında içinde dışarıdan içeri geçenler bulunan burada araştırma ekseninde ilişki ilişkisi",
      "bugün bugünkü kalan etki etkisi biraz küçük büyük eski yeni kısa uzun doğrudan dolaylı yönünde yönü tarafına sabah gri çıkış",
      "düşük orta yüksek mevcut yok var şiir rüya hafıza dikkat ritim basınç kavramsal estetik çağrışım",
      "melankoli öfke şefkat yorgunluk absürtlük açıklık arzu umut"
    ].join(" ")
  )
);

const surfaceAvoidHints = new Set(
  tokenize(
    "ev oda salon mutfak koltuk yatak halı masa pencere kapı sokak park apartman kaldırım bank ekran sandalye ayakkabı rota yürüyüş mahalle deniz vapur tasma bardak gövde çekmece eşya market yoğurtçu kalamış osmanağa kadıköy salondaki gri"
  )
);

const sourceCueStopTerms = new Set(
  tokenize(
    [
      "bulunan burada araştırma ekseninde arasında ilişkisi ilişki tarafına yönünde dışarıdan gelen kalan açılan aldıkları elde aracılığıyla aylarında birçok değerli",
      "cümle hareketi dikkat bakışı hafifçe değiştirsin çalışsın kayabilsin arka planda kalsın",
      "safe terms influence category source provider items weights mood"
    ].join(" ")
  )
);

const visualSurfaceStopTerms = new Set(
  tokenize(
    "şiir rüya hafıza dikkat ritim basınç kavramsal estetik çağrışım genel soyut atmosfer görev subject content anchor visual"
  )
);

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

function stripCountSuffix(value: string): string {
  return value.replace(/\s+\(\d+\)$/u, "");
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
  const terms = distinct(
    tokenize(value.replace(/\s*[/|]\s*/gu, " "))
      .filter((term) => term.length > 2 && !sourceCueStopTerms.has(term) && !avoidStopTerms.has(term) && !blocked.has(term))
      .filter((term) => !analyzeGeneratedLanguage(term).severe)
  );
  return terms.length >= 2 ? terms.slice(0, 5).join(" ") : "";
}

function sourceEffects(input: GenerationContextPacketInput, limit: number): string[] {
  const digest = input.source_digest?.safety.valid ? input.source_digest.public_poetic_digest : null;
  const blocked = new Set(digest ? [...digest.do_not_surface_terms, ...digest.repeated_abstract_terms].flatMap(tokenize) : []);
  if (digest) {
    const firstUseful = (values: string[]) => values.map((value) => compactSourceValue(value, blocked)).find(Boolean) ?? "";
    const sentenceMove = firstUseful(digest.sentence_moves);
    const attentionShift = firstUseful(digest.attention_shifts);
    const conceptualDrift = firstUseful(digest.conceptual_drifts);
    const aestheticCue = firstUseful(digest.aesthetic_cues);
    const candidates = [
      sentenceMove ? `Cümle ritmi şuradan etkilensin: ${sentenceMove}.` : "",
      attentionShift ? `Dikkat şu yöne hafifçe kayabilsin: ${attentionShift}.` : "",
      conceptualDrift ? `Arka planda şu kavramsal sapma kalsın: ${conceptualDrift}.` : "",
      aestheticCue ? `Görsel ve duygusal ton şuradan beslensin: ${aestheticCue}.` : ""
    ];
    return distinct(candidates.filter((value) => !/\s{2,}/u.test(value))).slice(0, limit);
  }

  return sourceInfluencePacketsForBundle(input.sources)
    .map((packet) => {
      const terms = distinct(packet.safe_terms.flatMap(tokenize).filter((term) => !avoidStopTerms.has(term) && !analyzeGeneratedLanguage(term).severe)).slice(0, 3);
      return terms.length > 0 ? `Dış etki şu güvenli malzemeyi yalnızca ritim ve dikkat olarak taşısın: ${terms.join(", ")}.` : "";
    })
    .filter(Boolean)
    .slice(0, limit);
}

function avoidTerms(input: GenerationContextPacketInput, retryHint?: CompactRetryHint): string[] {
  const retryTerms = retryHint?.surface?.surface_violations.flatMap((violation) => violation.matches) ?? [];
  const digestTerms = input.source_digest?.safety.valid ? input.source_digest.public_poetic_digest.do_not_surface_terms : [];
  const candidates = [...retryTerms, ...input.repetition_pressure.soft_avoid, ...input.repetition_pressure.repeated_locations, ...input.repetition_pressure.repeated_images, ...digestTerms]
    .map(stripCountSuffix)
    .flatMap(tokenize)
    .filter((term) => term.length > 2 && !/^\d+$/u.test(term) && !avoidStopTerms.has(term) && !analyzeGeneratedLanguage(term).severe);
  const concrete = candidates.filter((term) => surfaceAvoidHints.has(term) || term.length >= 4);
  return distinct(concrete).slice(0, 8);
}

function retryNote(hint?: CompactRetryHint): string[] {
  if (!hint?.surface?.severe && !hint?.language?.severe) return [];
  const notes: string[] = [];
  if (hint.language?.severe) notes.push("Önceki çıktı dil koşulunu geçemedi; yeniden dene.");
  if (hint.surface?.severe) {
    const matches = distinct(
      hint.surface.surface_violations
        .flatMap((violation) => violation.matches)
        .flatMap(tokenize)
        .filter((term) => !avoidStopTerms.has(term))
    ).slice(0, 6);
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
    "UCU BEDEN birikmiş yaşantısının içinden konuşan dijital bir şair-persona. İnsan gibi, içeriden, kusurlu ve canlı yaz; kendini açıklama, kaynakları özetleme.",
    "Ton: ince, kuru sarkazm dengeli ve hissedilir olsun. Şiirin her yerine yayılmasın; şakaya, punchline'a, espriye veya aforizmaya dönüşmesin.",
    "",
    "Bugünkü iç durum",
    innerState(input),
    "",
    "Hafızadan kalanlar",
    ...(residues.length > 0 ? residues.map((value) => `- ${value}`) : ["- Bugün belirgin bir hafıza kalıntısı yok."]),
    "",
    "Dış etkiler",
    ...(outside.length > 0 ? outside.map((value) => `- ${value}`) : ["- Dış etki yalnızca ritmi, dikkati ve çağrışımı hafifçe değiştirsin."]),
    "",
    ...(avoid.length > 0 ? [`Bugün doğrudan kullanma: ${avoid.join(", ")}.`, ""] : []),
    "Üslup: Daha içerden, daha insan, daha kusurlu. Cilalı genel şiir tonundan kaçın; ev, yer ve yürüyüşü varsayılan imge yapma.",
    ...retryNote(retryHint),
    "",
    'Tamamını Türkçe yaz. Yalnızca JSON döndür: {"poem":"...","mood_sentence":"Bugünkü hali: ..."}'
  ].join("\n");
}

export function buildCompactDreamPrompt(params: CompactDreamPromptParams, retryHint?: CompactRetryHint): string {
  const input = dreamPacketInput(params);
  const poemLeftovers = poemResidues(params, input);
  const residues = memoryResidues(params.memorySelection, input, 3);
  const outside = sourceEffects(input, 2);
  const avoid = avoidTerms(input, retryHint);
  return [
    "UCU BEDEN rüyada daha kırık ve dolaylı konuşur. İnce, kuru sarkazm bozuk bir yankı gibi kalabilir; yine de şaka, punchline veya açıklama kurma.",
    "Bastırılmış kalıntılar tuhaf biçimde geri dönebilir; şiiri yeniden yazma ve kaynakları özetleme.",
    "",
    "Günün şiirinden kalanlar",
    ...(poemLeftovers.length > 0 ? poemLeftovers.map((value) => `- ${value}`) : ["- Şiirin duygusal yönü kalsın, yüzeyi kalmasın."]),
    "",
    "Hafızadan kalanlar",
    ...(residues.length > 0 ? residues.map((value) => `- ${value}`) : ["- Bugün belirgin bir hafıza kalıntısı yok."]),
    "",
    "Dış etkiler",
    ...(outside.length > 0 ? outside.map((value) => `- ${value}`) : ["- Dış etki yalnızca rüyanın ritmini ve dikkatini hafifçe değiştirsin."]),
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
  const options = distinct([
    first ? `${first} tortusu` : "",
    first ? `${first} kayması` : "",
    first ? `${first} artığı` : "",
    first && second && first !== second ? `${first} sonrası ${second}` : "",
    second && second !== first ? `${second} kırılması` : ""
  ]);
  return seededMany(options.length > 0 ? options : [first, second].filter(Boolean), seed, 1)[0] ?? "adsız tortu";
}

function visualCueValue(value: string): string {
  if (!value || technicalFragment.test(value) || analyzeGeneratedLanguage(value).severe) return "";
  const terms = distinct(
    tokenize(value)
      .filter((term) => term.length >= 4)
      .filter((term) => !visualSurfaceStopTerms.has(term) && !avoidStopTerms.has(term) && !sourceCueStopTerms.has(term))
      .filter((term) => !analyzeGeneratedLanguage(term).severe)
  );
  return terms.slice(0, 6).join(", ");
}

function visualCueList(values: string[], limit: number): string[] {
  return distinct(values.map(visualCueValue).filter(Boolean)).slice(0, limit);
}

export function buildCompactPoemVisualPrompt(poem: DailyPoem, visualBrief?: VisualBrief | null): string {
  const moods = dominantMood(poem.mood, 3).join(", ");
  const memoryEffects = visualCueList(poem.memory_selection?.memory_prompt_fragments ?? poem.memory_fragments, 3);
  const sourceEffectsForImage = visualCueList(
    poem.influences.filter((value) => /estetik|ritim|dikkat|cümle|imge|ton/iu.test(value)),
    3
  );
  const briefLines = visualBrief
    ? [
        "Günlük görsel brief: asıl içerik omurgası budur; aşağıdaki açıklamaları, başlıkları ve kelimeleri görselde yazı olarak üretme.",
        `Görsel subject: ${visualBrief.visual_subject}.`,
        `İçerik dayanağı: ${visualBrief.content_anchor}.`,
        `Kompozisyon mantığı: ${visualBrief.composition_logic}.`,
        `Malzeme mantığı: ${visualBrief.material_logic}.`,
        `Hareket veya gerilim: ${visualBrief.movement_or_tension}.`,
        `Bugüne bağ: ${visualBrief.why_today}.`,
        visualBrief.avoid_repeating.length > 0 ? `Son günlerden tekrar etme: ${visualBrief.avoid_repeating.join(" / ")}.` : ""
      ]
    : [
        "Bugünün şiirinden, mood cümlesinden, hafıza ve kaynak izlerinden tek bir içerik dayanağı çıkar; genel soyut atmosferle yetinme."
      ];
  const contextLines = visualBrief
    ? [
        `Mood yalnızca renk basıncı ve hareket gerilimini ayarlasın: ${moods}.`,
        memoryEffects.length > 0 ? `Brief'i gölgelemeyen küçük yüzey notları: ${memoryEffects.join(" / ")}.` : "",
        sourceEffectsForImage.length > 0 ? `Kaynak etkileri yalnızca doku ve ritim ayrıntısı olarak kalsın: ${sourceEffectsForImage.join(" / ")}.` : ""
      ]
    : [
        `Duygusal iklim: ${moods}; ${truncateWords(poem.mood_sentence, 18)}.`,
        memoryEffects.length > 0 ? `Yüzeye çıkmayan hafıza etkileri: ${memoryEffects.join(" / ")}.` : "",
        sourceEffectsForImage.length > 0 ? `Kaynaklardan kalan estetik, ritim ve dikkat etkisi: ${sourceEffectsForImage.join(" / ")}.` : ""
      ];
  return [
    "4:5 portrait aspect ratio.",
    "Soyut UCU BEDEN şiir görseli; şiiri literal olarak illüstre etme.",
    "Şiirin başlığını veya herhangi bir kelimeyi görsele yazma; yazısız, harfsiz, tipografisiz, logosuz ve filigransız kalmalı.",
    ...briefLines,
    ...contextLines,
    "Oda, koltuk, yatak, masa, pencere, halı, sokak, park, ekran ve apartman gibi ev/yer/yürüyüş izleri bugünkü veriden geliyorsa doğrudan sahne veya tanınır nesne olarak değil; iz, kalıntı, deformasyon, gölge, yüzey, leke, kırık form veya iç doku olarak dönüştür.",
    "Boş düz gradient yapma; çerçeveyi organik soyut formlar, katmanlı renk kütleleri, gölgeli dokular, bulanık siluetler ve lo-fi yüzey gürültüsüyle doldur.",
    "Atmosferik, soyut, yumuşak, lo-fi; okunur duygu, belirgin görsel hareket, az literal detay."
  ].filter(Boolean).join(" ");
}
