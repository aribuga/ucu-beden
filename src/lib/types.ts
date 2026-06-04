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
  notes: string[];
};

export type RssSourceCategory = "science_culture" | "entertainment" | "art" | "news" | "life";

export type RssSource = {
  name: string;
  category: RssSourceCategory;
  url: string;
  enabled: boolean;
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

export type RssDailyMoodSummary = {
  dominantMood: MoodKey;
  secondaryMood: MoodKey;
  moodScores: Mood;
  summary: string;
  fragments: string[];
};

export type RssSourceBundle = {
  items: MoodTaggedSourceItem[];
  dailyMoodSummary: RssDailyMoodSummary;
  sources: Array<{
    name: string;
    category: RssSourceCategory;
    enabled: boolean;
    fetched: boolean;
    item_count: number;
    error?: string;
  }>;
};

export type PoemAnalysis = {
  word_count: number;
  dominant_words: string[];
  recurring_words: string[];
  new_images: string[];
  image_mutations: ImageMutation[];
  mood_sentence: string;
};

export type PoemGenerationMeta = {
  provider: "openai" | "mock";
  model: string | null;
  fallback_reason: string | null;
};

export type ImageMutation = {
  from: string;
  to: string;
  reason: string;
  date?: string;
};

export type DailyPoem = {
  date: string;
  title: string;
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
  daily_life: DailyLife;
  walk_state: WalkState;
  memory_fragments: string[];
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
