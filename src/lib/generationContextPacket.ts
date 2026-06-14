import { tokenize, topWords } from "./inputPoems";
import { sourceInfluencePacketsForBundle } from "./sourceInfluence";
import type {
  DailyLifeRecord,
  DailyPoem,
  MemorySelection,
  Mood,
  RepetitionPressure,
  SourceBundle,
  UcuBedenState,
  WalkState
} from "./types";

export type GenerationContextPacketInput = {
  mode: "poem" | "dream";
  date: string;
  mood: Mood;
  sources: SourceBundle;
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

function moodLevel(value: number): "low" | "medium" | "high" {
  return level(value / 100);
}

function dominantMood(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
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
      const terms = filterGenerationSurfaceTerms(topWords(tokenize(fragment), 18), input).slice(0, 8);
      return terms.length > 0 ? `trace_effect_${index + 1}=${terms.join(",")}` : "";
    })
    .filter(Boolean);
}

export function filterGenerationSurfaceTerms(terms: string[], input: GenerationContextPacketInput): string[] {
  const blocked = surfaceTerms(input);
  return distinct(
    terms
      .flatMap(tokenize)
      .filter((term) => term.length > 2 && !blocked.has(term) && !genericSurfacePrefixes.some((prefix) => term.startsWith(prefix)) && !/^\d+$/.test(term))
  );
}

export function generationFallbackTerms(input: GenerationContextPacketInput, limit = 10): string[] {
  const sourceTerms = sourceInfluencePacketsForBundle(input.sources).flatMap((packet) => [
    ...packet.novelty_terms,
    ...packet.safe_terms
  ]);
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
    `word_count=${input.poem.analysis.word_count}`,
    `mood=${dominantMood(input.poem.mood).join(",")}`,
    `language_residue=${residueTerms.join(",") || "none"}`,
    `memory_links=${input.poem.memory_selection?.selected_trace_ids.length ?? 0}`,
    "reuse_surface_terms_directly=false"
  ].join("; ");
}

export function buildGenerationContextPacket(input: GenerationContextPacketInput): GenerationContextPacket {
  const daily = input.daily_life;
  const walk = input.walk_state;
  const packets = sourceInfluencePacketsForBundle(input.sources);
  const surfaceCount = surfaceTerms(input).size;
  const weatherOpenness = level(
    Math.max(0, Math.min(1, ((input.sources.weather.wind_kmh ?? 10) / 30 + (100 - (input.sources.weather.humidity_percent ?? 60)) / 100) / 2))
  );
  const outsideOpenness = walk.did_walk && daily.energy >= 0.45 ? "available" : daily.energy >= 0.35 ? "limited" : "closed";

  return {
    persona_safe_lived_context: {
      lived_context_effect: [
        `energy=${level(daily.energy)}`,
        `irritation=${level(daily.irritation)}`,
        `tenderness=${level(daily.tenderness)}`,
        `self_awareness=${level(daily.shame_self_awareness)}`,
        `dominant_mood=${dominantMood(input.mood).join(",")}`
      ].join("; "),
      body_attention_effect: [
        `fatigue=${moodLevel(input.mood.fatigue)}`,
        `clarity=${moodLevel(input.mood.clarity)}`,
        `desire=${moodLevel(input.mood.desire)}`,
        `attention_load=${daily.energy < 0.4 ? "inward" : "distributed"}`
      ].join("; "),
      walk_pressure_effect: [
        `walk_occurred=${walk.did_walk}`,
        `movement_pressure=${walk.did_walk ? "present" : "withheld"}`,
        `route_identity_allowed=false`,
        `surface_objects_allowed=false`
      ].join("; "),
      home_pressure_effect: [
        `memory_pressure=${level(daily.memory_pressure)}`,
        `social_distance=${daily.energy < 0.4 ? "high" : "measured"}`,
        `home_identity_allowed=false`
      ].join("; "),
      outside_openness: `outside_openness=${outsideOpenness}; weather_openness=${weatherOpenness}; place_identity_allowed=false`,
      surface_policy_summary: "Translate home, place, walk, and object surfaces into rhythm, pressure, fatigue, avoidance, attention, distance, mood, or association.",
      genetic_style_effect: input.genetic_style_note
        ? "genetic_style_available=true; copy_lines=false; reuse_surface_vocabulary=false; retain_only=tone,syntax,rhythm"
        : "Use accumulated style without copying source lines.",
      poem_residue_summary: poemResidueSummary(input)
    },
    source_influence_packet: packets.length > 0
      ? packets.map((packet) => packet.summary_for_prompt)
      : [
          `influence=attention_shift,mood_pressure; mood=${dominantMood(input.mood).join(",")}; weights=pressure:${level(input.sources.turkey_news.emotional_weight / 100)},aesthetic:${level(input.sources.art_world.curiosity / 100)}`
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
      allowed_surface_use: "Only after transformation, and never as default imagery or identity anchor.",
      translation_targets: ["rhythm", "pressure", "fatigue", "avoidance", "attention", "distance", "mood", "association_field"],
      repeated_surface_term_count: surfaceCount,
      summary: "Do not repeat supplied home/place/walk/object details directly. Convert their effects before writing."
    },
    title_policy_packet: {
      avoid_repeated_home_place_walk_objects: true,
      avoid_first_line_restatement: true,
      preferred_basis: ["emotional_shift", "conceptual_drift", "attention_change", "memory_mutation", "rhythm_change"],
      summary: "Build the title from a change or relation, not from repeated home, place, walk, or object vocabulary."
    }
  };
}

export function formatLivedContextPacket(packet: GenerationContextPacket): string {
  const lived = packet.persona_safe_lived_context;
  return [
    `lived_context_effect: ${lived.lived_context_effect}`,
    `body_attention_effect: ${lived.body_attention_effect}`,
    `walk_pressure_effect: ${lived.walk_pressure_effect}`,
    `home_pressure_effect: ${lived.home_pressure_effect}`,
    `outside_openness: ${lived.outside_openness}`,
    `surface_policy_summary: ${lived.surface_policy_summary}`,
    `genetic_style_effect: ${lived.genetic_style_effect}`,
    ...(lived.poem_residue_summary ? [`poem_residue_summary: ${lived.poem_residue_summary}`] : [])
  ].join("\n");
}

export function formatSurfacePolicyPacket(packet: GenerationContextPacket): string {
  const surface = packet.surface_policy_packet;
  return [
    `home_place_walk_are_identity_tokens: ${surface.home_place_walk_are_identity_tokens}`,
    `direct_surface_default: ${surface.direct_surface_default}`,
    `allowed_surface_use: ${surface.allowed_surface_use}`,
    `translation_targets: ${surface.translation_targets.join(", ")}`,
    `repeated_surface_term_count: ${surface.repeated_surface_term_count}`,
    surface.summary
  ].join("\n");
}

export function formatTitlePolicyPacket(packet: GenerationContextPacket): string {
  const title = packet.title_policy_packet;
  return [
    `avoid_repeated_home_place_walk_objects: ${title.avoid_repeated_home_place_walk_objects}`,
    `avoid_first_line_restatement: ${title.avoid_first_line_restatement}`,
    `preferred_basis: ${title.preferred_basis.join(", ")}`,
    title.summary
  ].join("\n");
}

export function generationContextDebug(input: GenerationContextPacketInput, packet = buildGenerationContextPacket(input)) {
  const livedText = formatLivedContextPacket(packet);
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
      !tokenize(livedText).some((term) => blocked.has(term)),
    source_influence_packet_present: packet.source_influence_packet.length > 0,
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
