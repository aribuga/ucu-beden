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

export type PoemGenerationMeta = {
  provider: "openai" | "mock";
  model: string | null;
  fallback_reason: string | null;
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
  generation: PoemGenerationMeta;
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
  input_analysis: InputPoemsAnalysis;
  mood: Mood;
  mood_sentence: string;
  daily_life: DailyLifeRecord;
  walk_state: WalkState;
  personality_settings: PersonalitySettings;
  memory_fragments: string[];
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
