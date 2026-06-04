import { promises as fs } from "node:fs";
import path from "node:path";

import type { DailyPoem, InputPoemsAnalysis, SourceBundle, UcuBedenState, World, YearlyReport } from "./types";

export const rootDir = process.cwd();

export const storagePaths = {
  poemsInput: "poems_input",
  world: "data/world/ucu_beden_world.json",
  state: "data/state/ucu_beden_state.json",
  generatedPoems: "data/generated_poems",
  yearlyReports: "data/yearly_reports",
  sources: "data/sources",
  inputAnalysis: "data/analysis/input_poems_analysis.json",
  vocabularyMemory: "data/analysis/vocabulary_memory.json",
  imageMutations: "data/analysis/image_mutations.json"
} as const;

const dataDirs = [
  "poems_input",
  "data/world",
  "data/state",
  "data/generated_poems",
  "data/yearly_reports",
  "data/sources",
  "data/analysis"
];

export function resolvePath(relativePath: string): string {
  return path.join(rootDir, relativePath);
}

export async function ensureDataDirs(): Promise<void> {
  await Promise.all(dataDirs.map((dir) => fs.mkdir(resolvePath(dir), { recursive: true })));
}

export async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolvePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(resolvePath(relativePath), "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(relativePath: string, data: unknown): Promise<void> {
  const absolutePath = resolvePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readTextFile(relativePath: string): Promise<string> {
  return fs.readFile(resolvePath(relativePath), "utf8");
}

export async function writeTextFile(relativePath: string, text: string): Promise<void> {
  const absolutePath = resolvePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, text, "utf8");
}

export async function listFiles(relativeDir: string, extension: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(resolvePath(relativeDir), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase("tr").endsWith(extension))
      .map((entry) => path.join(relativeDir, entry.name).replaceAll("\\", "/"))
      .sort();
  } catch {
    return [];
  }
}

export async function listGeneratedPoems(): Promise<DailyPoem[]> {
  const files = await listFiles(storagePaths.generatedPoems, ".json");
  const poems = await Promise.all(files.map((file) => readJsonFile<DailyPoem | null>(file, null)));
  return poems.filter((poem): poem is DailyPoem => poem !== null).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestPoem(): Promise<DailyPoem | null> {
  const poems = await listGeneratedPoems();
  return poems.at(-1) ?? null;
}

export async function readWorld(): Promise<World> {
  return readJsonFile<World>(storagePaths.world, {
    home: {
      city: "İstanbul",
      district: "Kadıköy / Osmanağa",
      building: "Kırımlı Apartmanı",
      apartment_type: "1+1",
      size_m2: 35,
      building_feel: "mütevazı, yeni bir bina",
      rooms: {
        living_room: {
          description: "mutfakla birleşik salon",
          objects: ["tek gri koltuk", "üzerinde mavi bir figür olan halı", "bilgisayar"],
          habits: ["koltukta uzanmayı seviyor"]
        },
        bedroom: {
          description: "oldukça küçük yatak odası",
          objects: ["çift kişilik sayılabilecek küçük bir yatak"],
          habits: ["dar odada daha içe kapanık şiirler yazıyor"]
        }
      }
    },
    walking_routes: []
  });
}

export async function readState(): Promise<UcuBedenState> {
  return readJsonFile<UcuBedenState>(storagePaths.state, {
    name: "UCU BEDEN",
    generated_days: 0,
    age_months: 0,
    last_generated_date: null,
    last_mood: null,
    mood_history: [],
    dominant_words: [],
    obsessions: [],
    avoided_words: [],
    recurring_images: [],
    memory_density: 0,
    home_memory: {
      frequent_locations: [],
      object_fixations: [],
      recent_body_states: []
    },
    walk_memory: {
      frequent_segments: [],
      seen_objects: [],
      route_mood_associations: []
    },
    poetic_drift: {
      style_notes: "Henüz kendi şiir hafızasını toplamaya başladı.",
      recent_changes: [],
      things_it_is_forgetting: [],
      things_it_keeps_returning_to: []
    }
  });
}

export async function readInputAnalysis(): Promise<InputPoemsAnalysis> {
  return readJsonFile<InputPoemsAnalysis>(storagePaths.inputAnalysis, {
    files: [],
    global: {
      poem_count: 0,
      word_count: 0,
      dominant_words: [],
      image_fields: [],
      food_images: [],
      body_images: [],
      animal_images: [],
      city_images: [],
      absurd_fragments: [],
      repeated_phrases: [],
      tone: ["gündelik", "absürt", "bedensel"],
      rhythm_notes: "Kullanıcı şiirleri analiz edilince ritim notları burada oluşur.",
      style_notes: "Gündelik olanla absürt olan iç içe geçebilir.",
      taboo_copying_rules: "Do not reproduce full lines from input poems."
    }
  });
}

export async function listYearlyReports(): Promise<YearlyReport[]> {
  const files = await listFiles(storagePaths.yearlyReports, ".json");
  const reports = await Promise.all(files.map((file) => readJsonFile<YearlyReport | null>(file, null)));
  return reports.filter((report): report is YearlyReport => report !== null).sort((a, b) => a.year - b.year);
}

export async function listSources(): Promise<SourceBundle[]> {
  const files = await listFiles(storagePaths.sources, ".json");
  const sources = await Promise.all(files.map((file) => readJsonFile<SourceBundle | null>(file, null)));
  return sources.filter((source): source is SourceBundle => source !== null).sort((a, b) => a.date.localeCompare(b.date));
}
