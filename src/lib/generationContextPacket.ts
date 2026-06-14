import { tokenize, topWords } from "./inputPoems";
import { analyzeGeneratedLanguage } from "./languageValidator";
import { publicPoeticDigestPromptFragments } from "./sourceDigestion";
import { sourceInfluencePacketsForBundle } from "./sourceInfluence";
import type {
  DailyLifeRecord,
  DailyPoem,
  MemorySelection,
  Mood,
  RepetitionPressure,
  SourceBundle,
  SourceDigestRecord,
  UcuBedenState,
  WalkState
} from "./types";

export type GenerationContextPacketInput = {
  mode: "poem" | "dream";
  date: string;
  mood: Mood;
  sources: SourceBundle;
  source_digest?: SourceDigestRecord | null;
  daily_life: DailyLifeRecord;
  walk_state: WalkState;
  memory_selection: MemorySelection;
  repetition_pressure: RepetitionPressure;
  state?: UcuBedenState;
  poem?: DailyPoem;
  genetic_style_note?: string;
};

export type GenerationContextPacket = {
  persona_safe_lived_context: {
    lived_context_effect: string;
    body_attention_effect: string;
    walk_pressure_effect: string;
    home_pressure_effect: string;
    outside_openness: string;
    surface_policy_summary: string;
    genetic_style_effect: string;
    poem_residue_summary?: string;
  };
  source_influence_packet: string[];
  memory_trace_packet: {
    selected_trace_ids: string[];
    direct_trace_count: number;
    indirect_trace_count: number;
    suppressed_trace_count: number;
    fragments: string[];
  };
  surface_policy_packet: {
    home_place_walk_are_identity_tokens: false;
    direct_surface_default: "blocked";
    allowed_surface_use: string;
    translation_targets: string[];
    repeated_surface_term_count: number;
    summary: string;
  };
  title_policy_packet: {
    avoid_repeated_home_place_walk_objects: true;
    avoid_first_line_restatement: true;
    preferred_basis: string[];
    summary: string;
  };
};

const genericSurfaceTerms = new Set(
  [
    "ev",
    "oda",
    "salon",
    "mutfak",
    "yatak",
    "kapı",
    "pencere",
    "koltuk",
    "masa",
    "halı",
    "ekran",
    "sokak",
    "mahalle",
    "apartman",
    "rota",
    "yürüyüş",
    "adım",
    "ayakkabı"
  ].flatMap(tokenize)
);

const genericSurfacePrefixes = [
  "ev",
  "oda",
  "salon",
  "mutfak",
  "yatak",
  "kapı",
  "pencere",
  "koltuk",
  "masa",
  "halı",
  "ekran",
  "sokak",
  "mahalle",
  "apartman",
  "rota",
  "yürü",
  "adım",
  "ayakkabı",
  "çekmece",
  "eşya",
  "market",
  "park"
];

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function level(value: number): "low" | "medium" | "high" {
  if (value >= 0.67) return "high";
  if (value >= 0.34) return "medium";
  return "low";
}

function levelTurkish(value: number): "düşük" | "orta" | "yüksek" {
  return value >= 0.67 ? "yüksek" : value >= 0.34 ? "orta" : "düşük";
}

function moodLevel(value: number): "low" | "medium" | "high" {
  return level(value / 100);
}

function moodLevelTurkish(value: number): "düşük" | "orta" | "yüksek" {
  return levelTurkish(value / 100);
}

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

function dominantMood(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function dominantMoodTurkish(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => moodLabels[key]);
}

const influenceLabels: Record<string, string> = {
  pressure: "basınç",
  aesthetic_learning: "estetik öğrenme",
  vocabulary_learning: "kelime öğrenme",
  rhythm_shift: "ritim kayması",
  conceptual_drift: "kavramsal kayma",
  image_expansion: "imge genişlemesi",
  attention_shift: "dikkat kayması",
  memory_association: "hafıza çağrışımı",
  mood_pressure: "ruh hali etkisi"
};

function sourcePacketPrompt(packet: ReturnType<typeof sourceInfluencePacketsForBundle>[number]): string {
  const influences = packet.influence_kind.map((kind) => influenceLabels[kind] ?? kind).join(", ");
  const terms = packet.safe_terms.filter((term) => analyzeGeneratedLanguage(term).english_matches.length === 0).slice(0, 8).join(" | ");
  return `Öğrenme yönü: ${influences || "dikkat kayması"}; güvenli dil malzemesi: ${terms || "yok"}.`;
}

function identitySurfaceTerms(input: GenerationContextPacketInput): Set<string> {
  const daily = input.daily_life;
  const walk = input.walk_state;
  const state = input.state;
  const values = [
    daily.location,
    daily.room_light,
    daily.object_focus,
    daily.activity,
    walk.route_name ?? "",
    walk.current_segment,
    walk.line_written_while_walking,
    ...walk.seen_objects,
    ...(state?.home_memory.frequent_locations ?? []),
    ...(state?.home_memory.object_fixations ?? []),
    ...(state?.walk_memory.frequent_segments ?? []),
    ...(state?.walk_memory.seen_objects ?? [])
  ];
  return new Set(values.flatMap(tokenize));
}

function surfaceTerms(input: GenerationContextPacketInput): Set<string> {
  const values = [
    ...genericSurfaceTerms,
    ...identitySurfaceTerms(input),
    ...input.repetition_pressure.repeated_locations,
    ...input.repetition_pressure.repeated_images,
    ...input.repetition_pressure.soft_avoid
  ];
  return new Set(values.flatMap(tokenize));
}

function digestedMemoryFragments(input: GenerationContextPacketInput): string[] {
  return input.memory_selection.memory_prompt_fragments
    .map((fragment, index) => {
      if (analyzeGeneratedLanguage(fragment).severe) return "";
      const terms = filterGenerationSurfaceTerms(topWords(tokenize(fragment), 18), input).slice(0, 8);
      return terms.length > 0 ? `hafıza_izi_etkisi_${index + 1}: ${terms.join(",")}` : "";
    })
    .filter(Boolean);
}

export function filterGenerationSurfaceTerms(terms: string[], input: GenerationContextPacketInput): string[] {
  const blocked = surfaceTerms(input);
  return distinct(
    terms
      .flatMap(tokenize)
      .filter(
        (term) =>
          term.length > 2 &&
          !blocked.has(term) &&
          !genericSurfacePrefixes.some((prefix) => term.startsWith(prefix)) &&
          !/^\d+$/.test(term) &&
          analyzeGeneratedLanguage(term).english_matches.length === 0
      )
  );
}

export function generationFallbackTerms(input: GenerationContextPacketInput, limit = 10): string[] {
  const sourceTerms = input.source_digest?.safety.valid
    ? input.source_digest.public_poetic_digest.safe_vocabulary_candidates
    : sourceInfluencePacketsForBundle(input.sources).flatMap((packet) => [...packet.novelty_terms, ...packet.safe_terms]);
  const memoryTerms = topWords(tokenize(input.memory_selection.memory_prompt_fragments.join(" ")), 24);
  const poemTerms = input.poem ? [...input.poem.analysis.recurring_words, ...input.poem.analysis.dominant_words] : [];
  return filterGenerationSurfaceTerms([...sourceTerms, ...memoryTerms, ...poemTerms], input).slice(0, limit);
}

function poemResidueSummary(input: GenerationContextPacketInput): string | undefined {
  if (!input.poem) return undefined;
  const residueTerms = filterGenerationSurfaceTerms(
    [...input.poem.analysis.recurring_words, ...input.poem.analysis.dominant_words],
    input
  ).slice(0, 6);
  return [
    `Sözcük sayısı: ${input.poem.analysis.word_count}`,
    `Ruh hali: ${dominantMoodTurkish(input.poem.mood).join(",")}`,
    `Dil kalıntısı: ${residueTerms.join(",") || "yok"}`,
    `Hafıza bağlantısı: ${input.poem.memory_selection?.selected_trace_ids.length ?? 0}`,
    "Yüzey terimlerini doğrudan yeniden kullanma."
  ].join("; ");
}

export function buildGenerationContextPacket(input: GenerationContextPacketInput): GenerationContextPacket {
  const daily = input.daily_life;
  const walk = input.walk_state;
  const packets = sourceInfluencePacketsForBundle(input.sources, [], input.source_digest);
  const digestPrompt = publicPoeticDigestPromptFragments(input.source_digest);
  const surfaceCount = surfaceTerms(input).size;
  const weatherOpenness = level(
    Math.max(0, Math.min(1, ((input.sources.weather.wind_kmh ?? 10) / 30 + (100 - (input.sources.weather.humidity_percent ?? 60)) / 100) / 2))
  );
  const outsideOpenness = walk.did_walk && daily.energy >= 0.45 ? "açık" : daily.energy >= 0.35 ? "sınırlı" : "kapalı";

  return {
    persona_safe_lived_context: {
      lived_context_effect: [
        `enerji: ${levelTurkish(daily.energy)}`,
        `huzursuzluk: ${levelTurkish(daily.irritation)}`,
        `şefkat: ${levelTurkish(daily.tenderness)}`,
        `öz farkındalık: ${levelTurkish(daily.shame_self_awareness)}`,
        `baskın ruh hali: ${dominantMoodTurkish(input.mood).join(",")}`
      ].join("; "),
      body_attention_effect: [
        `yorgunluk: ${moodLevelTurkish(input.mood.fatigue)}`,
        `açıklık: ${moodLevelTurkish(input.mood.clarity)}`,
        `arzu: ${moodLevelTurkish(input.mood.desire)}`,
        `dikkat yükü: ${daily.energy < 0.4 ? "içe dönük" : "dağılmış"}`
      ].join("; "),
      walk_pressure_effect: [
        `yürüyüş oldu: ${walk.did_walk ? "evet" : "hayır"}`,
        `hareket etkisi: ${walk.did_walk ? "mevcut" : "tutulmuş"}`,
        "rota kimlik işareti olmasın",
        "yüzey nesnelerini doğrudan kullanma"
      ].join("; "),
      home_pressure_effect: [
        `hafıza etkisi: ${levelTurkish(daily.memory_pressure)}`,
        `toplumsal mesafe: ${daily.energy < 0.4 ? "yüksek" : "ölçülü"}`,
        "ev kimlik işareti olmasın"
      ].join("; "),
      outside_openness: `dışarıya açıklık: ${outsideOpenness}; hava açıklığı: ${weatherOpenness === "high" ? "yüksek" : weatherOpenness === "medium" ? "orta" : "düşük"}; yer kimlik işareti olmasın`,
      surface_policy_summary: "Ev, yer, yürüyüş ve nesne yüzeylerini ritme, yorgunluğa, kaçınmaya, dikkate, mesafeye, ruh haline veya çağrışıma dönüştür.",
      genetic_style_effect: input.genetic_style_note
        ? "Birikmiş üslup kullanılabilir; satırları veya yüzey kelimelerini kopyalama; yalnızca ton, sözdizimi ve ritmi koru."
        : "Kaynak satırlarını kopyalamadan birikmiş üslubu kullan.",
      poem_residue_summary: poemResidueSummary(input)
    },
    source_influence_packet: digestPrompt.length > 0
      ? digestPrompt
      : packets.length > 0
      ? packets.map(sourcePacketPrompt)
      : [
          `Dış etki dikkat ve ruh hali üzerinden çalışsın; baskın ruh hali: ${dominantMoodTurkish(input.mood).join(",")}.`
        ],
    memory_trace_packet: {
      selected_trace_ids: input.memory_selection.selected_trace_ids,
      direct_trace_count: input.memory_selection.direct_trace_ids.length,
      indirect_trace_count: input.memory_selection.indirect_trace_ids.length,
      suppressed_trace_count: input.memory_selection.suppressed_trace_ids.length,
      fragments: digestedMemoryFragments(input)
    },
    surface_policy_packet: {
      home_place_walk_are_identity_tokens: false,
      direct_surface_default: "blocked",
      allowed_surface_use: "Yalnızca dönüştürüldükten sonra kullan; varsayılan imge veya kimlik dayanağı yapma.",
      translation_targets: ["ritim", "yorgunluk", "kaçınma", "dikkat", "mesafe", "ruh hali", "çağrışım alanı"],
      repeated_surface_term_count: surfaceCount,
      summary: "Verilen ev, yer, yürüyüş ve nesne ayrıntılarını doğrudan tekrarlama; yazmadan önce etkilerine dönüştür."
    },
    title_policy_packet: {
      avoid_repeated_home_place_walk_objects: true,
      avoid_first_line_restatement: true,
      preferred_basis: ["duygusal değişim", "kavramsal kayma", "dikkat değişimi", "hafıza mutasyonu", "ritim değişimi"],
      summary: "Başlığı tekrar eden ev, yer, yürüyüş veya nesne sözlüğünden değil, bir değişim veya ilişkiden kur."
    }
  };
}

export function formatLivedContextPacket(packet: GenerationContextPacket): string {
  const lived = packet.persona_safe_lived_context;
  return [
    `Yaşanmış bağlam etkisi: ${lived.lived_context_effect}`,
    `Beden ve dikkat etkisi: ${lived.body_attention_effect}`,
    `Yürüyüş etkisi: ${lived.walk_pressure_effect}`,
    `Ev etkisi: ${lived.home_pressure_effect}`,
    `Dışarı açıklığı: ${lived.outside_openness}`,
    `Yüzey politikası özeti: ${lived.surface_policy_summary}`,
    `Birikmiş üslup etkisi: ${lived.genetic_style_effect}`,
    ...(lived.poem_residue_summary ? [`Şiir kalıntısı özeti: ${lived.poem_residue_summary}`] : [])
  ].join("\n");
}

export function formatSurfacePolicyPacket(packet: GenerationContextPacket): string {
  const surface = packet.surface_policy_packet;
  return [
    "Ev, yer ve yürüyüş kimlik işareti değildir.",
    "Doğrudan yüzey kullanımı varsayılan olarak engellidir.",
    `İzin verilen yüzey kullanımı: ${surface.allowed_surface_use}`,
    `Dönüşüm hedefleri: ${surface.translation_targets.join(", ")}`,
    `Tekrar eden yüzey terimi sayısı: ${surface.repeated_surface_term_count}`,
    surface.summary
  ].join("\n");
}

export function formatTitlePolicyPacket(packet: GenerationContextPacket): string {
  const title = packet.title_policy_packet;
  return [
    "Tekrar eden ev, yer ve yürüyüş nesnelerinden kaçın.",
    "İlk satırı başlıkta yeniden söyleme.",
    `Tercih edilen başlık temeli: ${title.preferred_basis.join(", ")}`,
    title.summary
  ].join("\n");
}

export function generationContextDebug(input: GenerationContextPacketInput, packet = buildGenerationContextPacket(input)) {
  const livedText = formatLivedContextPacket(packet);
  const deanchoredLivedText = [
    packet.persona_safe_lived_context.lived_context_effect,
    packet.persona_safe_lived_context.body_attention_effect
  ].join("\n");
  const surfaceText = formatSurfacePolicyPacket(packet);
  const packetText = [
    livedText,
    surfaceText,
    formatTitlePolicyPacket(packet),
    ...packet.memory_trace_packet.fragments,
    ...packet.source_influence_packet
  ].join("\n");
  const fallbackTerms = generationFallbackTerms(input);
  const blocked = identitySurfaceTerms(input);
  return {
    raw_json_context_removed: !packetText.includes(JSON.stringify(input.daily_life)) && !packetText.includes(JSON.stringify(input.walk_state)),
    home_place_deanchored:
      packet.surface_policy_packet.home_place_walk_are_identity_tokens === false &&
      !tokenize(deanchoredLivedText).some((term) => blocked.has(term)),
    source_influence_packet_present: packet.source_influence_packet.length > 0,
    source_digest_available: Boolean(input.source_digest?.safety.valid),
    source_digest_provider: input.source_digest?.provider ?? null,
    surface_policy_packet: surfaceText,
    title_policy_packet: formatTitlePolicyPacket(packet),
    fallback_surface_safe: fallbackTerms.every((term) => !blocked.has(term) && !genericSurfacePrefixes.some((prefix) => term.startsWith(prefix))),
    fallback_terms: fallbackTerms,
    prompt_sections: {
      lived_context: livedText,
      allowed_memory_traces: packet.memory_trace_packet.fragments,
      source_influence: packet.source_influence_packet
    }
  };
}
