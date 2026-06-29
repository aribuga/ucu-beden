import { listFiles, readJsonFile, storagePaths } from "./fileStorage";
import { tokenize, topWords } from "./inputPoems";
import { seededMany } from "./random";
import { sourceInfluencePacketsForBundle } from "./sourceInfluence";
import type {
  DailyLife,
  DailyLifeRecord,
  MemorySelection,
  Mood,
  SourceBundle,
  VisualBrief,
  VisualBriefGenerationMeta,
  VisualMetadata
} from "./types";

type VisualDailyLife = DailyLife & Partial<DailyLifeRecord>;

export type RecentVisualBrief = VisualBrief & {
  date: string;
  title: string;
};

export type GenerateVisualBriefWithLLMInput = {
  date: string;
  poemText: string;
  title: string;
  mood: Mood;
  mood_sentence: string;
  daily_life: VisualDailyLife;
  memory_fragments: string[];
  memory_selection?: MemorySelection;
  source_influences: string[];
  sources?: SourceBundle;
  recent_visual_briefs: RecentVisualBrief[];
};

export type VisualBriefGenerationResult = {
  brief: VisualBrief;
  generation: VisualBriefGenerationMeta;
};

type StructuredVisualBriefResponse = Partial<Record<keyof VisualBrief, unknown>>;

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

const briefFields: Array<keyof VisualBrief> = [
  "visual_subject",
  "content_anchor",
  "composition_logic",
  "material_logic",
  "movement_or_tension",
  "why_today"
];

const fallbackStopTerms = new Set(
  tokenize(
    [
      "bugün bugünkü hali olan kalan içinde dışarı içeri biraz küçük eski yeni değil göre gibi direkt doğrudan",
      "şiiri literal sahne nesne kategori soyut atmosfer genel benzer aynı",
      "melankoli öfke şefkat yorgunluk absürtlük açıklık arzu umut absürt duygusal duygu tereddüt hafıza dikkat",
      "izin izni kapanmasına açılmasına olması olmak kalan kalmış çıkmış",
      "şiir başlık görsel subject content anchor kompozisyon material movement tension"
    ].join(" ")
  )
);

const transformedMotifs = [
  "ayak izi",
  "kalıntı",
  "deformasyon",
  "yamuk gölge",
  "yüzey",
  "leke",
  "kırık form",
  "iç doku",
  "ışık tortusu",
  "beden haritası"
];

const transformationActions = [
  "çoğalan",
  "sızan",
  "yamulan",
  "biriken",
  "silinen",
  "katlanan",
  "çatlayan"
];

const abstractSubjectRoots = [
  "şefkat",
  "tereddüt",
  "hafıza",
  "dikkat",
  "yorgun",
  "melankoli",
  "öfke",
  "absürt",
  "açıklık",
  "arzu",
  "umut",
  "duygu",
  "duygusal",
  "ruh",
  "mood",
  "basınç",
  "iklim",
  "çağrış",
  "ritim",
  "şiir"
];

const physicalSubjectRoots = [
  "ev",
  "oda",
  "salon",
  "mutfak",
  "koltuk",
  "yatak",
  "halı",
  "masa",
  "pencere",
  "kapı",
  "çekmece",
  "ekran",
  "telefon",
  "bardak",
  "tabak",
  "ayakkabı",
  "sandalye",
  "sokak",
  "park",
  "apartman",
  "kaldırım",
  "market",
  "beden",
  "gövde",
  "bacak",
  "ayak",
  "el",
  "baş",
  "yüz",
  "boğaz",
  "mide",
  "ışık",
  "kenar",
  "aralık",
  "aral",
  "yüzey",
  "leke",
  "iz",
  "tortu",
  "kalınt",
  "deform",
  "doku",
  "kırık",
  "harita",
  "çizgi",
  "katman",
  "renk",
  "kumaş",
  "gölge"
];

function cleanSingleLine(value: unknown, maxWords = 18): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/gu, "")
    .split(" ")
    .slice(0, maxWords)
    .join(" ")
    .replace(/[,:;|/-]+$/u, "")
    .trim();
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanSingleLine(item, 10)).filter(Boolean))).slice(0, 8);
}

function dominantMood(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => moodLabels[key]);
}

function truncateWords(value: string, limit: number): string {
  return value.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean).slice(0, limit).join(" ");
}

function matchesRoot(term: string, roots: string[]): boolean {
  return roots.some((root) => term.startsWith(root));
}

function canonicalSimilarityTerm(term: string): string {
  if (term.startsWith("aral")) return "aralık";
  if (term.startsWith("ışığ")) return "ışık";
  if (term.startsWith("ayağ")) return "ayak";
  if (term.startsWith("bacağ")) return "bacak";
  return [...abstractSubjectRoots, ...physicalSubjectRoots].find((root) => term.startsWith(root)) ?? term;
}

function dailyMemorySentence(dailyLife: VisualDailyLife): string {
  return dailyLife.memory_sentence ?? dailyLife.memory_state ?? dailyLife.body_state;
}

function dailyCurrentFocus(dailyLife: VisualDailyLife): string {
  return dailyLife.current_focus ?? dailyLife.activity;
}

function dailyOutsidePressure(dailyLife: VisualDailyLife): string {
  return dailyLife.outside_pressure ?? dailyLife.attention;
}

function dailyLifeVisualFields(dailyLife: VisualDailyLife): string[] {
  return [
    dailyLife.location,
    dailyLife.posture,
    dailyLife.body_state,
    dailyLife.object_focus,
    dailyLife.movement,
    dailyMemorySentence(dailyLife),
    dailyLife.activity,
    dailyLife.attention
  ].filter((value): value is string => Boolean(value?.trim()));
}

function dailyPhysicalTerms(dailyLife: VisualDailyLife): Set<string> {
  return new Set(
    dailyLifeVisualFields(dailyLife)
      .flatMap(tokenize)
      .filter((term) => term.length >= 3)
      .filter((term) => !fallbackStopTerms.has(term) && !matchesRoot(term, abstractSubjectRoots))
      .map(canonicalSimilarityTerm)
  );
}

function visualPhrase(value: string | undefined, blockedTerms: Set<string>, limit = 3, requirePhysical = false): string {
  if (!value) return "";
  const terms = Array.from(
    new Set(
      topWords(tokenize(value), limit + 6)
        .filter((term) => term.length >= 3)
        .filter((term) => !fallbackStopTerms.has(term) && !matchesRoot(term, abstractSubjectRoots))
        .map(canonicalSimilarityTerm)
        .filter((term) => !requirePhysical || matchesRoot(term, physicalSubjectRoots))
        .filter((term) => !blockedTerms.has(term))
    )
  )
    .slice(0, limit);
  return terms.join(" ");
}

function parseStructuredVisualBriefResponse(text: string): StructuredVisualBriefResponse | null {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  try {
    const parsed = JSON.parse(start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as StructuredVisualBriefResponse : null;
  } catch {
    return null;
  }
}

function normalizeBrief(payload: StructuredVisualBriefResponse | null): VisualBrief | null {
  if (!payload) return null;
  const brief = {
    visual_subject: cleanSingleLine(payload.visual_subject),
    content_anchor: cleanSingleLine(payload.content_anchor),
    composition_logic: cleanSingleLine(payload.composition_logic, 22),
    material_logic: cleanSingleLine(payload.material_logic, 22),
    movement_or_tension: cleanSingleLine(payload.movement_or_tension, 22),
    why_today: cleanSingleLine(payload.why_today, 24),
    avoid_repeating: cleanList(payload.avoid_repeating)
  };
  return briefFields.every((field) => brief[field].length >= 4) ? brief : null;
}

function visualSubjectIssue(brief: VisualBrief, input: GenerateVisualBriefWithLLMInput): string | null {
  const rawWords = brief.visual_subject.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  const tokens = tokenize(brief.visual_subject).map(canonicalSimilarityTerm);
  const dailyTerms = dailyPhysicalTerms(input.daily_life);
  const abstractCount = tokens.filter((term) => matchesRoot(term, abstractSubjectRoots)).length;
  const physicalCount = tokens.filter((term) => matchesRoot(term, physicalSubjectRoots) || dailyTerms.has(term)).length;
  const titleCaseWords = rawWords.filter((word) => /^[A-ZÇĞİÖŞÜ]/u.test(word)).length;
  const titleLike = rawWords.length > 1 && rawWords.length <= 5 && titleCaseWords >= Math.max(2, rawWords.length - 1);
  const onlyGenericTransform = physicalCount > 0 && tokens.every((term) => matchesRoot(term, ["iz", "kalınt", "deform", "gölge", "yüzey", "leke", "kırık", "doku"]));

  if (tokens.length < 5) return "visual_subject is too short to be a physical visual spine";
  if (titleLike && abstractCount > 0 && physicalCount < 2) return "visual_subject reads like a poetic title";
  if (abstractCount >= 2 && physicalCount < 2) return "visual_subject leans on abstract emotion words";
  if (abstractCount >= 1 && physicalCount === 0) return "visual_subject has no physical daily-life anchor";
  if (onlyGenericTransform) return "visual_subject uses only generic residue/shadow/surface words";
  return null;
}

function textForSimilarity(brief: Pick<VisualBrief, keyof VisualBrief>): string {
  return [
    brief.visual_subject,
    brief.content_anchor,
    brief.composition_logic,
    brief.material_logic,
    brief.movement_or_tension,
    brief.why_today
  ].join(" ");
}

function similarityTerms(value: string): string[] {
  return Array.from(
    new Set(
      tokenize(value)
        .filter((term) => term.length >= 3 || matchesRoot(term, physicalSubjectRoots) || matchesRoot(term, abstractSubjectRoots))
        .map(canonicalSimilarityTerm)
    )
  );
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = new Set(a);
  const right = new Set(b);
  const intersection = Array.from(left).filter((term) => right.has(term)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function overlapCount(a: string[], b: string[]): number {
  const right = new Set(b);
  return Array.from(new Set(a)).filter((term) => right.has(term)).length;
}

function visualBriefTooSimilar(candidate: VisualBrief, recent: RecentVisualBrief[]): boolean {
  const subject = candidate.visual_subject.toLocaleLowerCase("tr");
  const candidateTerms = similarityTerms(textForSimilarity(candidate));
  const candidateSubjectTerms = similarityTerms(candidate.visual_subject);
  const repeatedWeakRoots = candidateSubjectTerms.filter((term) =>
    matchesRoot(term, [...abstractSubjectRoots, "gölge", "leke", "yüzey", "doku", "kalınt", "iz"])
  );
  return recent.some((brief) => {
    const previousSubject = brief.visual_subject.toLocaleLowerCase("tr");
    if (subject.length >= 10 && previousSubject.length >= 10 && (subject.includes(previousSubject) || previousSubject.includes(subject))) {
      return true;
    }
    const previousSubjectTerms = similarityTerms(brief.visual_subject);
    const weakRootOverlap = overlapCount(repeatedWeakRoots, previousSubjectTerms);
    const subjectOverlap = jaccard(candidateSubjectTerms, previousSubjectTerms);
    const fullOverlap = jaccard(candidateTerms, similarityTerms(textForSimilarity(brief)));
    return weakRootOverlap >= 2 || subjectOverlap >= 0.5 || fullOverlap >= 0.34;
  });
}

function recentBriefTerms(recent: RecentVisualBrief[]): Set<string> {
  return new Set(
    recent
      .flatMap((brief) => [brief.visual_subject, brief.content_anchor, brief.composition_logic, brief.material_logic])
      .flatMap(similarityTerms)
  );
}

function visualBriefFromPrompt(visual: VisualMetadata): VisualBrief | null {
  const prompt = visual.visual_prompt;
  const subject = prompt.match(/(?:Ana görsel subject|Görsel subject|visual_subject)\s*[:=]\s*([^.;\n]+)/iu)?.[1];
  const anchor = prompt.match(/(?:Content anchor|content_anchor|İçerik dayanağı)\s*[:=]\s*([^.;\n]+)/iu)?.[1];
  const composition = prompt.match(/(?:Kompozisyon mantığı|composition_logic)\s*[:=]\s*([^.;\n]+)/iu)?.[1];
  const material = prompt.match(/(?:Malzeme mantığı|material_logic)\s*[:=]\s*([^.;\n]+)/iu)?.[1];
  const tension = prompt.match(/(?:Hareket veya gerilim|movement_or_tension)\s*[:=]\s*([^.;\n]+)/iu)?.[1];
  const fallbackSubject = cleanSingleLine(subject ?? visual.title);
  if (!fallbackSubject) return null;
  return {
    visual_subject: fallbackSubject,
    content_anchor: cleanSingleLine(anchor ?? prompt, 14) || fallbackSubject,
    composition_logic: cleanSingleLine(composition ?? prompt, 14) || "önceki prompttan çıkarılan kompozisyon",
    material_logic: cleanSingleLine(material ?? prompt, 14) || "önceki prompttan çıkarılan yüzey",
    movement_or_tension: cleanSingleLine(tension ?? prompt, 14) || "önceki prompttan çıkarılan gerilim",
    why_today: "önceki görsel metadata izinden çıkarıldı",
    avoid_repeating: []
  };
}

export async function recentPoemVisualBriefs(currentDate: string, limit = 10): Promise<RecentVisualBrief[]> {
  const files = await listFiles(storagePaths.visuals, ".json");
  const visuals = await Promise.all(
    files
      .filter((file) => file.endsWith("-poem.json"))
      .map((file) => readJsonFile<VisualMetadata | null>(file, null))
  );
  return visuals
    .filter((visual): visual is VisualMetadata => Boolean(visual?.date && visual.date < currentDate))
    .map((visual) => {
      const brief = visual.visual_brief ?? visualBriefFromPrompt(visual);
      return brief ? { ...brief, date: visual.date, title: visual.title } : null;
    })
    .filter((brief): brief is RecentVisualBrief => brief !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

function sourceInfluenceFallback(input: GenerateVisualBriefWithLLMInput): string[] {
  if (input.source_influences.length > 0) return input.source_influences;
  if (!input.sources) return [];
  return sourceInfluencePacketsForBundle(input.sources)
    .flatMap((packet) => [...packet.safe_terms, ...packet.novelty_terms])
    .filter(Boolean)
    .slice(0, 8);
}

function localFallbackBrief(input: GenerateVisualBriefWithLLMInput, reason: string): VisualBriefGenerationResult {
  const sourceHints = sourceInfluenceFallback(input);
  const recentTerms = recentBriefTerms(input.recent_visual_briefs);
  const dailyTerms = dailyPhysicalTerms(input.daily_life);
  const placeAnchor = visualPhrase(input.daily_life.location, recentTerms, 2, true) || visualPhrase(input.daily_life.posture, recentTerms, 2, true);
  const bodyAnchor = visualPhrase(input.daily_life.body_state, recentTerms, 2, true) || visualPhrase(input.daily_life.posture, recentTerms, 2, true);
  const objectAnchor = visualPhrase(input.daily_life.object_focus, recentTerms, 2, true) || visualPhrase(dailyCurrentFocus(input.daily_life), recentTerms, 2, true);
  const movementAnchor = visualPhrase(input.daily_life.movement, recentTerms, 2, true);
  const memoryAnchor = visualPhrase(dailyMemorySentence(input.daily_life), recentTerms, 2, true);
  const physicalAnchors = Array.from(new Set([objectAnchor, bodyAnchor, placeAnchor, movementAnchor, memoryAnchor].filter(Boolean)));
  const terms = topWords(
    tokenize(
      [
        input.daily_life.body_state,
        input.daily_life.attention,
        input.daily_life.object_focus,
        input.daily_life.activity,
        input.daily_life.movement,
        dailyMemorySentence(input.daily_life),
        dailyCurrentFocus(input.daily_life),
        dailyOutsidePressure(input.daily_life),
        ...input.memory_fragments,
        ...(input.memory_selection?.memory_prompt_fragments ?? []),
        ...sourceHints,
        input.mood_sentence,
        input.poemText
      ].join(" ")
    ),
    18
  )
    .map(canonicalSimilarityTerm)
    .filter((term) => term.length >= 4 && !fallbackStopTerms.has(term) && !recentTerms.has(term))
    .filter((term) => matchesRoot(term, physicalSubjectRoots) || dailyTerms.has(term));
  const selected = seededMany(terms.length > 0 ? terms : Array.from(dailyTerms), `${input.date}:visual-brief-fallback`, 7);
  const motif = seededMany(transformedMotifs, `${input.date}:visual-brief-motif`, 1)[0] ?? "kalıntı";
  const action = seededMany(transformationActions, `${input.date}:visual-brief-action`, 1)[0] ?? "biriken";
  const [primaryAnchor, secondaryAnchor, tertiaryAnchor] = seededMany(
    physicalAnchors.length > 0 ? physicalAnchors : selected,
    `${input.date}:visual-brief-physical-anchors`,
    3
  );
  const anchor = Array.from(new Set([primaryAnchor, secondaryAnchor, tertiaryAnchor, ...selected.slice(0, 3)].filter(Boolean))).slice(0, 4).join(", ");
  const subject = [
    secondaryAnchor ? `${secondaryAnchor} kenarında` : "",
    primaryAnchor ? `${primaryAnchor} izinden` : "",
    `${action} ${motif}`
  ].filter(Boolean).join(" ") || `günlük beden verisinden ${action} ${motif}`;
  return {
    brief: {
      visual_subject: subject,
      content_anchor: anchor || dailyMemorySentence(input.daily_life),
      composition_logic: "günlük fiziksel omurgayı merkeze alıp kenarlara doğru bozulan kırık bir düzen",
      material_logic: "seçilen nesne veya beden izini lekeli yüzey, yıpranmış dijital doku ve iç katman gibi dönüştür",
      movement_or_tension: "tanınır sahneye dönüşmeden fiziksel izin belirmesi, yamulması veya dağılması",
      why_today: truncateWords(`${input.mood_sentence} ${dailyMemorySentence(input.daily_life)}`, 18),
      avoid_repeating: input.recent_visual_briefs.flatMap((brief) => [brief.visual_subject, brief.content_anchor]).slice(0, 6)
    },
    generation: {
      provider: "fallback",
      model: process.env.OPENAI_VISUAL_BRIEF_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      fallback_reason: reason,
      retry_count: 0,
      similar_to_recent: visualBriefTooSimilar({
        visual_subject: subject,
        content_anchor: anchor,
        composition_logic: "",
        material_logic: "",
        movement_or_tension: "",
        why_today: "",
        avoid_repeating: []
      }, input.recent_visual_briefs),
      generated_at: new Date().toISOString()
    }
  };
}

function briefSummary(brief: RecentVisualBrief): string {
  return [
    `${brief.date} / ${brief.title}`,
    `subject: ${brief.visual_subject}`,
    `anchor: ${brief.content_anchor}`,
    `composition: ${brief.composition_logic}`,
    `material: ${brief.material_logic}`,
    `tension: ${brief.movement_or_tension}`
  ].join(" | ");
}

function buildVisualBriefPrompt(input: GenerateVisualBriefWithLLMInput, rejectedBriefs: VisualBrief[]): string {
  const memories = [
    ...input.memory_fragments,
    ...(input.memory_selection?.memory_prompt_fragments ?? [])
  ].map((fragment) => `- ${truncateWords(fragment, 16)}`).slice(0, 8);
  const sourceInfluences = sourceInfluenceFallback(input).map((influence) => `- ${truncateWords(influence, 18)}`).slice(0, 8);
  return [
    "UCU BEDEN için yalnızca görsel içerik brief'i üret.",
    "Stil seçme, estetik preset verme, kalite/model/aspect ratio önerme; stil katmanı başka yerde sabit.",
    "Sabit kategori listesinden seçim yapma. Bugünün visual_subject'i şiirden, ruh halinden, günlük hayattan, hafızadan ve kaynak etkilerinden organik türesin.",
    "visual_subject şiir başlığı, kategori adı, genel soyut atmosfer veya tekrar eden görev cümlesi olmasın.",
    "visual_subject 8-16 kelimelik fiziksel bir görsel omurga olsun: günlük hayattan gelen bir nesne/yüzey/yer izi + dönüşmüş yüzey/kalıntı/deformasyon + küçük bir hareket.",
    "visual_subject şefkat, tereddüt, hafıza, dikkat, yorgunluk, gölge gibi soyut kelimelere yaslanmasın. Bu kelimeler gerekiyorsa content_anchor veya why_today içinde kalsın; subject fiziksel kalmalı.",
    "Geçersiz subject örnekleri: Şefkatin Tereddütlü Gölgesi; Hafızanın İnce Kırılması; Dikkatin Yorgun Lekesi.",
    "Geçerli subject örnekleri: mavi figürlü halının kenarında çoğalan yarı saydam ayak izleri; dar yatağın kenarından sızan sıcak kumaş lekesi; çekmece aralığında biriken eski ses tortusu; ekran ışığında yamulan küçük yüzey haritası.",
    "Subject şiirin doğrudan illüstrasyonu olmasın; şiirin içinden sonra bulunmuş görsel bir gerekçe gibi dursun.",
    "Oda, koltuk, yatak, sokak, ekran, park, masa, pencere gibi şeyleri tamamen yasaklama. Bugünkü veriden geliyorlarsa bunları doğrudan sahne/nesne olarak değil; iz, kalıntı, deformasyon, gölge, yüzey, leke, kırık form veya iç doku olarak dönüştür.",
    "Do not use human figure, person, face, body silhouette, standing figure, portrait-like shadow unless the poem explicitly requires it.",
    "Günlük veride 'gövde' geçiyorsa bunu insan bedeni gibi değil; yüzey ağırlığı, kütle baskısı, nesne hacmi veya deforme olmuş ev içi yüzey olarak yorumla.",
    "Görselde kelime, harf, başlık, etiket, logo, tabela veya okunur işaret önermemelisin.",
    "Önceki günlerin subject'lerini, kompozisyon mantığını, malzeme metaforlarını ve görsel bahanesini tekrar etme.",
    "",
    "Son 10 görsel brief",
    ...(input.recent_visual_briefs.length > 0 ? input.recent_visual_briefs.map((brief) => `- ${briefSummary(brief)}`) : ["- yok"]),
    "",
    ...(rejectedBriefs.length > 0
      ? [
          "Reddedilen brief'ler son 10 güne fazla benzedi. Aynı visual_subject, aynı kompozisyon refleksi veya aynı soyut metafor çevresinde dönme; daha farklı bir görsel yorum getir.",
          ...rejectedBriefs.map((brief) => `- ${brief.visual_subject} / ${brief.composition_logic}`),
          ""
        ]
      : []),
    `Tarih: ${input.date}`,
    `Başlık: ${input.title}`,
    `Ruh hali: ${dominantMood(input.mood).join(", ")}`,
    `Ruh hali cümlesi: ${input.mood_sentence}`,
    "",
    "Günlük hayat",
    `- konum: ${input.daily_life.location}`,
    `- duruş: ${input.daily_life.posture}`,
    `- beden: ${input.daily_life.body_state}`,
    `- nesne odağı: ${input.daily_life.object_focus}`,
    `- dikkat: ${input.daily_life.attention}`,
    `- hareket: ${input.daily_life.movement}`,
    `- güncel odak: ${dailyCurrentFocus(input.daily_life)}`,
    `- hafıza hali: ${dailyMemorySentence(input.daily_life)}`,
    `- dış basınç: ${dailyOutsidePressure(input.daily_life)}`,
    "",
    "Hafıza izleri",
    ...(memories.length > 0 ? memories : ["- belirgin iz yok"]),
    "",
    "Kaynak etkileri",
    ...(sourceInfluences.length > 0 ? sourceInfluences : ["- kaynak etkisi yalnızca dikkat ve ritim düzeyinde kalsın"]),
    "",
    "Şiir",
    truncateWords(input.poemText, 220),
    "",
    "Yalnızca JSON döndür:",
    '{"visual_subject":"...","content_anchor":"...","composition_logic":"...","material_logic":"...","movement_or_tension":"...","why_today":"...","avoid_repeating":["..."]}'
  ].join("\n");
}

export async function generateVisualBriefWithLLM(input: GenerateVisualBriefWithLLMInput): Promise<VisualBriefGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISUAL_BRIEF_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) return localFallbackBrief(input, "OPENAI_API_KEY is not set");

  let lastError = "OpenAI visual brief request failed";
  const rejectedBriefs: VisualBrief[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          input: buildVisualBriefPrompt(input, rejectedBriefs),
          temperature: 0.9,
          max_output_tokens: 520,
          text: {
            format: {
              type: "json_schema",
              name: "ucu_beden_visual_brief",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  visual_subject: { type: "string" },
                  content_anchor: { type: "string" },
                  composition_logic: { type: "string" },
                  material_logic: { type: "string" },
                  movement_or_tension: { type: "string" },
                  why_today: { type: "string" },
                  avoid_repeating: { type: "array", items: { type: "string" } }
                },
                required: [
                  "visual_subject",
                  "content_anchor",
                  "composition_logic",
                  "material_logic",
                  "movement_or_tension",
                  "why_today",
                  "avoid_repeating"
                ],
                additionalProperties: false
              }
            }
          }
        })
      });
      if (!response.ok) {
        lastError = `OpenAI visual brief returned ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }

      const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? null;
      const brief = normalizeBrief(text ? parseStructuredVisualBriefResponse(text) : null);
      if (!brief) {
        lastError = "OpenAI response had no valid visual brief payload";
        continue;
      }
      const subjectIssue = visualSubjectIssue(brief, input);
      if (subjectIssue) {
        rejectedBriefs.push(brief);
        lastError = `OpenAI visual brief subject was too abstract: ${subjectIssue}`;
        continue;
      }
      if (visualBriefTooSimilar(brief, input.recent_visual_briefs)) {
        rejectedBriefs.push(brief);
        lastError = "OpenAI visual brief was too similar to recent visuals";
        continue;
      }
      return {
        brief,
        generation: {
          provider: "openai",
          model,
          fallback_reason: null,
          retry_count: attempt - 1,
          similar_to_recent: false,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenAI visual brief request failed";
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  const fallback = localFallbackBrief(input, lastError);
  return {
    brief: fallback.brief,
    generation: {
      ...fallback.generation,
      retry_count: rejectedBriefs.length,
      similar_to_recent: rejectedBriefs.length > 0
    }
  };
}
