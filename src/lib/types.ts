export type Mood = {
  melancholy: number;
  anger: number;
  tenderness: number;
  fatigue: number;
  absurdity: number;
  clarity: number;
  desire: number;
  hope: number;
};

export type MoodKey = keyof Mood;

export type SiteTheme = "minimal" | "sims2000" | "fresh90s";

export type SiteSettings = {
  theme: SiteTheme;
  showMoodDots: boolean;
  showFooterDedication: boolean;
};

export type PersonalitySettings = {
  hidden_voice_traits: {
    dry_sarcasm: number;
    absurd_domestic_humor: number;
    gentle_passive_aggression: number;
    panic_comedy: number;
    sentimental_leak: number;
  };
  tone_balance: {
    absurd_domestic: number;
    dry_sarcasm: number;
    sentimental_leak: number;
  };
  publicly_visible: boolean;
  private_prompt_note: string;
  hidden_voice_rules: string[];
};

export type DailyLife = {
  location: string;
  posture: string;
  activity: string;
  attention: string;
  body_state: string;
  room_light: string;
  object_focus: string;
  movement: string;
};

export type DailyLifeScheduleEntry = {
  time: string;
  activity: string;
  inner_note: string;
  mood_shift: string;
};

export type DailyLifeRecord = DailyLife & {
  date: string;
  generated_at: string;
  wake_time: string;
  mood: string;
  energy: number;
  irritation: number;
  tenderness: number;
  sarcasm_level: number;
  shame_self_awareness: number;
  obsession: string;
  avoidance: string;
  current_focus: string;
  private_joke: string;
  social_distance: string;
  weather_reaction: string;
  outside_pressure: string;
  memory_pressure: number;
  memory_state: string;
  memory_sentence: string;
  inner_note: string;
  schedule: DailyLifeScheduleEntry[];
};

export type WalkState = {
  did_walk: boolean;
  route_name: string | null;
  current_segment: string;
  pace: string;
  weather_on_body: string;
  seen_objects: string[];
  line_written_while_walking: string;
  walk_influence: string;
};

export type WeatherSource = {
  provider: string;
  summary: string;
  temperature_c: number | null;
  humidity_percent: number | null;
  wind_kmh: number | null;
  body_effect: string;
};

export type NewsSource = {
  provider: string;
  summary: string;
  emotional_weight: number;
  fragments: string[];
};

export type ArtSource = {
  provider: string;
  summary: string;
  curiosity: number;
  fragments: string[];
};

export type SourceBundle = {
  date: string;
  collected_at: string;
  fallback_used: boolean;
  weather: WeatherSource;
  turkey_news: NewsSource;
  art_world: ArtSource;
  rss?: RssSourceBundle;
  rssHealth?: RssHealthDailyEntry[];
  notes: string[];
};

export type RssSourceCategory = "science_culture" | "entertainment" | "art" | "news" | "life";

export type SourceInfluenceKind =
  | "pressure"
  | "aesthetic_learning"
  | "vocabulary_learning"
  | "rhythm_shift"
  | "conceptual_drift"
  | "image_expansion"
  | "attention_shift"
  | "memory_association"
  | "mood_pressure";

export type SourceInfluencePacket = {
  category: RssSourceCategory;
  item_count: number;
  influence_kind: SourceInfluenceKind[];
  safe_terms: string[];
  novelty_terms: string[];
  repeated_terms: string[];
  rejected_terms: string[];
  mood_bias: MoodKey[];
  aesthetic_weight: number;
  conceptual_weight: number;
  rhythm_weight: number;
  pressure_weight: number;
  summary_for_prompt: string;
};

export type SourcePrivateFactualDigest = {
  items: Array<{
    source_title: string;
    url: string | null;
    source_name: string;
    category: RssSourceCategory;
    factual_summary: string;
    detected_entities: string[];
    topics: string[];
  }>;
  source_health: RssSourceHealth[];
};

export type SourcePublicPoeticDigest = {
  safe_vocabulary_candidates: string[];
  conceptual_drifts: string[];
  aesthetic_cues: string[];
  rhythm_cues: string[];
  attention_shifts: string[];
  image_expansion_candidates: string[];
  sentence_moves: string[];
  internalized_effect: string[];
  rejected_unsafe_terms: string[];
  do_not_surface_terms: string[];
  repeated_abstract_terms: string[];
};

export type SourceDigestRecord = {
  date: string;
  generated_at: string;
  provider: "openai" | "deterministic";
  model: string | null;
  fallback_reason: string | null;
  private_factual_digest: SourcePrivateFactualDigest;
  public_poetic_digest: SourcePublicPoeticDigest;
  source_influence_packet: SourceInfluencePacket[];
  safety: {
    valid: boolean;
    private_public_separation: boolean;
    unsafe_public_matches: string[];
    raw_sentence_overlap: string[];
  };
  similarity: {
    compared_digest_count: number;
    recent_digest_similarity: number;
    repeated_abstract_terms: string[];
  };
};

export type SourceDigestValidation = {
  valid: boolean;
  digest_count: number;
  source_digest_available: boolean;
  invalid_digest_dates: string[];
  missing_source_dates: string[];
  unsafe_public_digest: Array<{ date: string; matches: string[] }>;
  private_public_separation_failures: string[];
  missing_digest_influence_packet: string[];
  repeated_abstract_terms_available: boolean;
  non_turkish_public_digest: Array<{ date: string; matches: string[] }>;
};

export type SourceDigestAnalysis = {
  window_days: number;
  rss_summary_similarity: {
    compared_days: number;
    average: number;
    maximum: number;
    warning: boolean;
  };
  source_category_distribution: Partial<Record<RssSourceCategory, number>>;
  item_count_by_category: Partial<Record<RssSourceCategory, number>>;
  selected_non_news_influences: Array<{
    date: string;
    category: Exclude<RssSourceCategory, "news">;
    influence_kind: SourceInfluenceKind[];
    safe_terms: string[];
  }>;
  novelty_terms: string[];
  repeated_source_phrases: string[];
  repeated_mood_words: MoodKey[];
  rejected_unsafe_terms: string[];
  source_health_summary: {
    total: number;
    ok: number;
    empty: number;
    blocked: number;
    failed: number;
    empty_or_blocked: number;
  };
};

export type SourceInfluenceValidation = {
  valid: boolean;
  source_influence_packet_produced: boolean;
  packet_count: number;
  categories_with_items: RssSourceCategory[];
  categories_with_packets: RssSourceCategory[];
  category_diversity_preserved: boolean;
  non_news_available: RssSourceCategory[];
  non_news_represented: RssSourceCategory[];
  non_news_ignored: RssSourceCategory[];
  unsafe_packet_text: Array<{ date: string; category: RssSourceCategory; matches: string[] }>;
  vocabulary_candidates_safe: boolean;
  rss_summary_similarity_warning: boolean;
};

export type RssSource = {
  name: string;
  category: RssSourceCategory;
  url: string;
  alternateUrls?: string[];
  enabled: boolean;
  fetchStrategy?: "default" | "browser_headers";
  moodBias?: Partial<Mood>;
};

export type MoodTaggedSourceItem = {
  title: string;
  source: string;
  category: RssSourceCategory;
  url?: string;
  publishedAt?: string;
  moodTags: MoodKey[];
  moodScores: Mood;
  keywords: string[];
  shortAtmosphere: string;
};

export type ExternalKnowledgeFragment = {
  source: string;
  category: RssSourceCategory;
  title: string;
  moodTags: MoodKey[];
  usableWords: string[];
  transformedImage: string;
  humanMisreading: string;
};

export type RssDailyMoodSummary = {
  dominantMood: MoodKey;
  secondaryMood: MoodKey;
  moodScores: Mood;
  summary: string;
  fragments: string[];
  leakageWords?: string[];
  learningFragments?: string[];
  externalKnowledgeFragments?: ExternalKnowledgeFragment[];
};

export type RssSourceBundle = {
  items: MoodTaggedSourceItem[];
  dailyMoodSummary: RssDailyMoodSummary;
  sources: RssSourceHealth[];
  source_influence_packet?: SourceInfluencePacket[];
};

export type RssHealthStatus = "ok" | "empty" | "disabled" | "blocked_403" | "rate_limited_429" | "not_found_404" | "timeout" | "parse_error" | "failed";

export type RssSourceHealth = {
    name: string;
    category: RssSourceCategory;
    url?: string;
    usedUrl?: string;
    enabled: boolean;
    fetched: boolean;
    status: RssHealthStatus;
    item_count: number;
    itemCount: number;
    lastCheckedAt: string;
    retriedWithBrowserHeaders?: boolean;
    attemptedUrls?: string[];
    error?: string;
};

export type RssHealthEntry = RssSourceHealth;

export type RssHealthDailyEntry = {
  name: string;
  status: RssHealthStatus;
  itemCount: number;
  usedUrl?: string;
  error?: string;
};

export type PoemAnalysis = {
  word_count: number;
  dominant_words: string[];
  recurring_words: string[];
  new_images: string[];
  image_mutations: ImageMutation[];
  mood_sentence: string;
};

export type RepetitionPressure = {
  analyzed_poem_count: number;
  window_days: number;
  repeated_title_shapes: string[];
  repeated_locations: string[];
  repeated_images: string[];
  repeated_words: string[];
  repeated_pairs: string[];
  repeated_gestures: string[];
  soft_avoid: string[];
  prompt_note: string;
};

export type SurfaceViolationKind =
  | "title_overexposed_surface"
  | "title_object_list"
  | "repeated_surface"
  | "repeated_phrase"
  | "canonical_home_surface"
  | "canonical_walk_place_surface"
  | "raw_source_unsafe"
  | "self_explanation"
  | "poem_surface_reuse";

export type SurfaceViolation = {
  kind: SurfaceViolationKind;
  severity: "warning" | "severe";
  matches: string[];
};

export type SurfaceValidationReport = {
  surface_validation_passed: boolean;
  severe: boolean;
  surface_violations: SurfaceViolation[];
  blocked_surface_terms_count: number;
  title_violation: boolean;
  home_place_leak_score: number;
  repeated_phrase_score: number;
  signature_ignored_from_analysis: boolean;
  repeated_surfaces: string[];
  final_status: "accepted" | "accepted_with_warning" | "rejected_for_retry";
};

export type LanguageViolationField = "text" | "title" | "poem_text" | "mood_sentence" | "dream_text" | "mood_after";

export type LanguageViolation = {
  field: LanguageViolationField;
  kind: "english_ratio" | "non_turkish_lines" | "english_title";
  severity: "warning" | "severe";
  matches: string[];
};

export type LanguageValidationReport = {
  language_validation_passed: boolean;
  severe: boolean;
  english_ratio: number;
  non_turkish_line_ratio: number;
  detected_language: "turkish" | "mixed" | "english" | "undetermined";
  english_matches: string[];
  language_violations: LanguageViolation[];
};

export type PoemGenerationMeta = {
  provider: "openai" | "mock";
  model: string | null;
  fallback_reason: string | null;
  surface_validation_passed?: boolean;
  surface_violations?: SurfaceViolation[];
  retry_count?: number;
  blocked_surface_terms_count?: number;
  title_violation?: boolean;
  home_place_leak_score?: number;
  repeated_phrase_score?: number;
  signature_ignored_from_analysis?: boolean;
  surface_validation_status?: SurfaceValidationReport["final_status"];
  language_validation_passed?: boolean;
  language_violations?: LanguageViolation[];
  english_ratio?: number;
  language_retry_count?: number;
};

export type TitleGenerationSource = "llm" | "fallback_dominant_words";

export type ImageMutation = {
  from: string;
  to: string;
  reason: string;
  date?: string;
};

export type DailyPoem = {
  date: string;
  title: string;
  title_generation?: TitleGenerationSource;
  generated_at: string;
  age_months: number;
  age_display: string;
  poem_text: string;
  mood: Mood;
  mood_sentence: string;
  daily_life: DailyLife;
  walk_state: WalkState;
  sources: SourceBundle;
  memory_fragments: string[];
  memory_selection?: MemorySelection;
  influences: string[];
  generation: PoemGenerationMeta;
  analysis: PoemAnalysis;
  repetition_pressure?: RepetitionPressure;
};

export type VisualKind = "poem" | "dream";

export type VisualMetadata = {
  date: string;
  type: VisualKind;
  aspect_ratio: "4:5";
  source_id: string;
  title: string;
  generated_at: string;
  visual_prompt: string;
  negative_prompt: string;
  alt_text: string;
  image_path: string | null;
  provider: "metadata-fallback" | "openai";
  model?: string | null;
  size?: string;
  api_size?: string;
  quality?: "low" | "medium" | "high";
  output_format?: "png" | "webp" | "jpeg";
  prompt_hash?: string;
  fallback?: boolean;
  error?: string | null;
  style_tags: string[];
  fallback_palette: [string, string, string];
  fallback_seed: number;
};

export type DreamRecord = {
  date: string;
  source_date: string;
  generated_at: string;
  title: string;
  dream_text: string;
  symbols: string[];
  mood_after: string;
  visual_prompt: string;
  image_path: string | null;
  memory_mutations: string[];
  memory_selection?: MemorySelection;
  generation: PoemGenerationMeta;
};

export type MemoryTraceSource = "poem" | "dream" | "daily_life" | "source" | "walk" | "visual" | "contact_residue";

export type MemoryTraceKind =
  | "episodic"
  | "body"
  | "attention"
  | "avoidance"
  | "route"
  | "external_pressure"
  | "dream_return"
  | "legacy_inferred";

export type MemoryTraceStatus = "active" | "dim" | "suppressed" | "fossilized" | "overexposed" | "unstable";

export type MemoryTrace = {
  id: string;
  date: string;
  source: MemoryTraceSource;
  source_ref: string;
  kind: MemoryTraceKind;
  text: string;
  transformed_text: string;
  emotional_weight: number;
  recallability: number;
  decay: number;
  repression: number;
  mutation_rate: number;
  status: MemoryTraceStatus;
  linked_traces: string[];
  mood_tags: MoodKey[];
  origin: "observed" | "legacy_inferred";
  last_recalled_at: string | null;
  times_recalled: number;
  last_dream_return_at: string | null;
  times_returned_in_dream: number;
};

export type MemoryTraceFile = {
  version: 1;
  date: string;
  traces: MemoryTrace[];
};

export type MemoryIndex = {
  version: 1;
  built_through: string | null;
  trace_count: number;
  trace_ids: string[];
  by_date: Record<string, string[]>;
  by_source: Record<MemoryTraceSource, string[]>;
  by_status: Record<MemoryTraceStatus, string[]>;
};

export type MemoryClimateDimension = {
  value: number;
  trace_ids: string[];
  summary: string;
};

export type MemoryReport = {
  version: 1;
  built_through: string | null;
  trace_count: number;
  climate: {
    pressure: MemoryClimateDimension;
    clarity: MemoryClimateDimension;
    leakage: MemoryClimateDimension;
    decay: MemoryClimateDimension;
    repression: MemoryClimateDimension;
    recallability: MemoryClimateDimension;
  };
  easily_recalled: string[];
  suppressed: string[];
  external_leakage: string[];
  dream_returns: string[];
  indirect_only: string[];
};

export type MemorySelection = {
  mode: "poem" | "dream";
  selected_trace_ids: string[];
  direct_trace_ids: string[];
  indirect_trace_ids: string[];
  suppressed_trace_ids: string[];
  prompt_fragments: string[];
  memory_prompt_fragments: string[];
};

export type MemoryGraphEdgeKind = "linked" | "dream_return" | "indirect";

export type MemoryGraphNode = {
  id: string;
  date: string;
  source: MemoryTraceSource;
  kind: MemoryTraceKind;
  status: MemoryTraceStatus;
  transformed_text: string;
  source_ref: string | null;
  recallability: number;
  emotional_weight: number;
  decay: number;
  repression: number;
  times_recalled: number;
  last_recalled_at: string | null;
  times_returned_in_dream: number;
  last_dream_return_at: string | null;
  linked_traces: string[];
  recall_modes: Array<"poem" | "dream">;
};

export type MemoryGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: MemoryGraphEdgeKind;
};

export type MemoryGraphData = {
  built_through: string | null;
  trace_count: number;
  linked_trace_count: number;
  linked_edge_count: number;
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
};

export type VisualMemoryMapNodeType = "poem" | "dream" | "memory_trace" | "source_effect" | "mutation";

export type VisualMemoryMapRecallType = "direct" | "indirect" | "dream_return" | "none";

export type VisualMemoryMapNode = {
  id: string;
  type: VisualMemoryMapNodeType;
  date: string;
  label: string;
  summary: string;
  source: MemoryTraceSource | null;
  status: MemoryTraceStatus | null;
  recall_type: VisualMemoryMapRecallType;
  times_recalled: number;
  suppressed: boolean;
  dream_return: boolean;
  overexposed: boolean;
  affinity_terms?: string[];
  related_poem_href: string | null;
  related_dream_href: string | null;
};

export type VisualMemoryMapEdgeKind = "recall" | "indirect" | "dream_return" | "linked" | "mutation" | "source_effect";

export type VisualMemoryMapEdge = {
  id: string;
  source: string;
  target: string;
  kind: VisualMemoryMapEdgeKind;
  weight: number;
};

export type VisualMemoryMapData = {
  built_through: string | null;
  window_start: string | null;
  nodes: VisualMemoryMapNode[];
  edges: VisualMemoryMapEdge[];
};

export type MemoryLayers = {
  short_term: string[];
  mid_term: string[];
  long_term: string[];
  dim_suppressed: string[];
};

export type HomeMemory = {
  frequent_locations: string[];
  object_fixations: string[];
  recent_body_states: string[];
};

export type WalkMemory = {
  frequent_segments: string[];
  seen_objects: string[];
  route_mood_associations: string[];
};

export type ExternalMemory = {
  recurring_source_words: string[];
  recent_learning_fragments: string[];
  source_mood_history: string[];
};

export type PoeticDrift = {
  style_notes: string;
  recent_changes: string[];
  things_it_is_forgetting: string[];
  things_it_keeps_returning_to: string[];
};

export type UcuBedenState = {
  name: "UCU BEDEN";
  generated_days: number;
  age_months: number;
  last_generated_date: string | null;
  last_mood: Mood | null;
  mood_history: Array<{
    date: string;
    mood: Mood;
    sentence: string;
  }>;
  dominant_words: string[];
  obsessions: string[];
  avoided_words: string[];
  recurring_images: string[];
  memory_density: number;
  home_memory: HomeMemory;
  walk_memory: WalkMemory;
  external_memory: ExternalMemory;
  memory_layers?: MemoryLayers;
  poetic_drift: PoeticDrift;
};

export type World = {
  home: {
    city: string;
    district: string;
    building: string;
    apartment_type: string;
    size_m2: number;
    building_feel: string;
    rooms: {
      living_room: {
        description: string;
        objects: string[];
        habits: string[];
      };
      bedroom: {
        description: string;
        objects: string[];
        habits: string[];
      };
    };
  };
  walking_routes: Array<{
    name: string;
    start: string;
    segments: string[];
    mood_effects: Record<string, string[]>;
    habits: string[];
  }>;
};

export type ParsedInputPoem = {
  id: string;
  file: string;
  index: number;
  text: string;
};

export type InputFileAnalysis = {
  file: string;
  poem_count: number;
  word_count: number;
  dominant_words: string[];
  image_fields: string[];
  food_images: string[];
  body_images: string[];
  animal_images: string[];
  city_images: string[];
  absurd_fragments: string[];
  repeated_phrases: string[];
  tone: string[];
  syntax_notes: string;
  style_notes: string;
};

export type InputPoemsAnalysis = {
  files: InputFileAnalysis[];
  global: {
    poem_count: number;
    word_count: number;
    dominant_words: string[];
    image_fields: string[];
    food_images: string[];
    body_images: string[];
    animal_images: string[];
    city_images: string[];
    absurd_fragments: string[];
    repeated_phrases: string[];
    tone: string[];
    rhythm_notes: string;
    style_notes: string;
    taboo_copying_rules: string;
  };
};

export type GenerationContext = {
  date: string;
  age_months: number;
  age_display: string;
  state: UcuBedenState;
  world: World;
  sources: SourceBundle;
  source_digest?: SourceDigestRecord | null;
  input_analysis: InputPoemsAnalysis;
  mood: Mood;
  mood_sentence: string;
  daily_life: DailyLifeRecord;
  walk_state: WalkState;
  personality_settings: PersonalitySettings;
  memory_fragments: string[];
  memory_selection: MemorySelection;
  repetition_pressure: RepetitionPressure;
};

export type YearlyReport = {
  year: number;
  age_months: number;
  completed_at: string;
  poem_count: number;
  dominant_words: string[];
  recurring_images: string[];
  average_word_count: number;
  comparison_to_previous_year: string;
  home_observations: string[];
  walk_observations: string[];
  memory_observations: string[];
  summary: string;
};
