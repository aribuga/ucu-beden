import { writeJsonFile, listGeneratedPoems, listYearlyReports, storagePaths } from "./fileStorage";
import { tokenize, topWords } from "./inputPoems";
import type { DailyPoem, ImageMutation, InputPoemsAnalysis, Mood, UcuBedenState } from "./types";

const imageTerms = [
  "koltuk",
  "halı",
  "mavi",
  "figür",
  "bilgisayar",
  "ekran",
  "yatak",
  "oda",
  "park",
  "bank",
  "deniz",
  "rüzgar",
  "nem",
  "ağız",
  "dil",
  "gövde",
  "tost",
  "makarna",
  "yoğurt",
  "köpek",
  "vapur",
  "apartman"
];

function topFromStrings(items: string[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const item of items.filter(Boolean)) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, limit)
    .map(([item]) => item);
}

export function extractImages(text: string): string[] {
  const words = new Set(tokenize(text));
  return imageTerms.filter((term) => words.has(term));
}

function moodLabel(mood: Mood): string {
  const entries = Object.entries(mood).sort((a, b) => b[1] - a[1]);
  return entries
    .slice(0, 3)
    .map(([key]) => key)
    .join(" / ");
}

function mutateImage(image: string, date: string): ImageMutation {
  const map: Record<string, string> = {
    "mavi": "yerde mavi bir canlı",
    "halı": "odanın alttan konuşan zemini",
    "koltuk": "gövdeyi yutan gri çukur",
    "park": "ağaçların içeri bakan ağzı",
    "bank": "oturmayı hatırlayan ıslak tahta",
    "deniz": "uzakta açık bırakılmış ağız",
    "ekran": "ışıklı bir yara bandı",
    "yatak": "dar bir uyku teknesi",
    "nem": "tişörte yapışan görünmez el",
    "dil": "paslı küçük kapı"
  };

  return {
    from: image,
    to: map[image] ?? `${image} gölgesinin yanlış hatırlanmış hali`,
    reason: "Eski imge birebir dönmesin diye hafıza içinde mutasyona uğratıldı.",
    date
  };
}

function pickRecentLines(poems: DailyPoem[]): string[] {
  return poems
    .slice(-7)
    .flatMap((poem) => poem.poem_text.split(/\r?\n/g).map((line) => line.trim()))
    .filter((line) => line.length > 12)
    .slice(-8);
}

export async function selectMemoryFragments(params: {
  date: string;
  state: UcuBedenState;
  inputAnalysis: InputPoemsAnalysis;
}): Promise<string[]> {
  const poems = await listGeneratedPoems();
  const reports = await listYearlyReports();
  const fragments: string[] = [];
  const recentPoems = poems.slice(-7);

  for (const poem of recentPoems.slice(-3)) {
    const images = poem.analysis.new_images.length > 0 ? poem.analysis.new_images : extractImages(poem.poem_text);
    if (images.length > 0) {
      fragments.push(`${poem.date} şiirinden ${images.slice(0, 3).join(", ")} imgeleri eksik hatırlanıyor.`);
    } else {
      fragments.push(`${poem.date} şiirinden ${moodLabel(poem.mood)} ruh hali kalıyor.`);
    }
  }

  const lines = pickRecentLines(recentPoems);
  if (lines.length > 0) {
    const line = lines[lines.length - 1];
    const words = topWords(tokenize(line), 4);
    if (words.length > 0) {
      fragments.push(`Eski bir dizeden yalnızca ${words.join(", ")} kelimeleri kırıntı olarak çağrılıyor.`);
    }
  }

  const lastReport = reports.at(-1);
  if (lastReport) {
    fragments.push(`Son yıl raporu: ${lastReport.summary}`);
  }

  if (params.state.home_memory.object_fixations.length > 0) {
    fragments.push(`Ev hafızası ${params.state.home_memory.object_fixations.slice(0, 3).join(", ")} çevresinde dolaşıyor.`);
  }

  if (params.state.walk_memory.frequent_segments.length > 0) {
    fragments.push(`Yürüyüş hafızası ${params.state.walk_memory.frequent_segments.slice(0, 2).join(" ve ")} arasında gidip geliyor.`);
  }

  const rssLeakWords = topFromStrings(
    recentPoems.flatMap((poem) => poem.sources.rss?.dailyMoodSummary.leakageWords ?? []),
    8
  );
  if (rssLeakWords.length > 0) {
    fragments.push(`Dış kaynak hafızasından ${rssLeakWords.slice(0, 6).join(", ")} kelimeleri hafifçe sızıyor.`);
  }

  if (params.inputAnalysis.global.poem_count > 0) {
    fragments.push(
      `Genetik hafıza: ${params.inputAnalysis.global.style_notes} Baskın kelimeler: ${params.inputAnalysis.global.dominant_words
        .slice(0, 6)
        .join(", ")}.`
    );
  }

  if (fragments.length === 0) {
    fragments.push("İlk hafıza: gri koltuk, mavi figürlü halı ve henüz yazılmamış eski şiir hissi.");
  }

  return fragments.slice(0, 8);
}

export async function rebuildMemoryState(params: {
  previousState: UcuBedenState;
  inputAnalysis: InputPoemsAnalysis;
}): Promise<UcuBedenState> {
  const poems = await listGeneratedPoems();
  const allText = poems.map((poem) => poem.poem_text).join("\n");
  const recentText = poems
    .slice(-7)
    .map((poem) => poem.poem_text)
    .join("\n");
  const allWords = tokenize(allText);
  const recentWords = new Set(tokenize(recentText));
  const dominantWords = topWords(allWords, 20);
  const previousDominant = params.previousState.dominant_words;
  const forgottenWords = previousDominant.filter((word) => !recentWords.has(word)).slice(0, 10);
  const avoidedWords = topFromStrings([...params.previousState.avoided_words, ...forgottenWords], 12);
  const recurringImages = topFromStrings(poems.flatMap((poem) => poem.analysis.new_images.length ? poem.analysis.new_images : extractImages(poem.poem_text)), 14);
  const homeLocations = topFromStrings(poems.map((poem) => poem.daily_life.location), 8);
  const objectFixations = topFromStrings(poems.map((poem) => poem.daily_life.object_focus), 8);
  const bodyStates = poems.slice(-8).map((poem) => poem.daily_life.body_state);
  const walkSegments = topFromStrings(poems.map((poem) => poem.walk_state.current_segment), 8);
  const seenObjects = topFromStrings(poems.flatMap((poem) => poem.walk_state.seen_objects), 12);
  const rssLeakWords = topFromStrings(
    poems.flatMap((poem) => poem.sources.rss?.dailyMoodSummary.leakageWords ?? []),
    20
  );
  const recentRssLeakWords = new Set(
    poems
      .slice(-7)
      .flatMap((poem) => poem.sources.rss?.dailyMoodSummary.leakageWords ?? [])
  );
  const routeMoodAssociations = topFromStrings(
    poems.map((poem) => `${poem.walk_state.current_segment}: ${poem.walk_state.walk_influence}`),
    8
  );
  const memoryDensity = Math.min(100, poems.length * 4 + recurringImages.length * 3 + params.inputAnalysis.global.poem_count * 2);
  const lastPoem = poems.at(-1);

  const recentChanges = [
    dominantWords.length > 0 ? `Dil ${dominantWords.slice(0, 4).join(", ")} çevresinde sıklaşıyor.` : "Dil henüz belirgin bir tekrar kurmadı.",
    recurringImages.length > 0 ? `İmgeler ${recurringImages.slice(0, 4).join(", ")} üzerinde dönüyor.` : "İmgeler daha ilk tortusunu topluyor.",
    poems.some((poem) => poem.walk_state.did_walk) ? "Yürüyüş ritmi şiirin nefesine karıştı." : "Ev içi kapalılığı baskın kaldı."
  ];

  const state: UcuBedenState = {
    ...params.previousState,
    name: "UCU BEDEN",
    generated_days: poems.length,
    age_months: lastPoem?.age_months ?? poems.length,
    last_generated_date: lastPoem?.date ?? null,
    last_mood: lastPoem?.mood ?? params.previousState.last_mood,
    mood_history: poems
      .slice(-30)
      .map((poem) => ({ date: poem.date, mood: poem.mood, sentence: poem.mood_sentence })),
    dominant_words: dominantWords,
    obsessions: topFromStrings([...dominantWords.slice(0, 10), ...recurringImages.slice(0, 8)], 12),
    avoided_words: avoidedWords,
    recurring_images: recurringImages,
    memory_density: memoryDensity,
    home_memory: {
      frequent_locations: homeLocations,
      object_fixations: objectFixations,
      recent_body_states: bodyStates
    },
    walk_memory: {
      frequent_segments: walkSegments,
      seen_objects: seenObjects,
      route_mood_associations: routeMoodAssociations
    },
    poetic_drift: {
      style_notes:
        poems.length === 0
          ? "Henüz kendi şiir hafızasını toplamaya başladı."
          : "Kendi şiirlerinden, input şiirlerin genetik izinden, ev ve yürüyüş tekrarlarından dili yavaşça kayıyor.",
      recent_changes: recentChanges,
      things_it_is_forgetting: forgottenWords,
      things_it_keeps_returning_to: topFromStrings([...dominantWords.slice(0, 8), ...recurringImages.slice(0, 8)], 12)
    }
  };

  await writeJsonFile(storagePaths.state, state);
  await writeJsonFile(storagePaths.vocabularyMemory, {
    updated_at: new Date().toISOString(),
    dominant_words: dominantWords,
    recurring_words: dominantWords.slice(0, 12),
    avoided_words: avoidedWords,
    forgotten_words: forgottenWords,
    new_words: dominantWords.filter((word) => !previousDominant.includes(word)).slice(0, 12),
    rss_leak_words: rssLeakWords,
    recent_rss_leak_words: rssLeakWords.filter((word) => recentRssLeakWords.has(word)).slice(0, 12)
  });

  const mutations = topFromStrings(recurringImages, 12).map((image) => mutateImage(image, lastPoem?.date ?? new Date().toISOString().slice(0, 10)));
  await writeJsonFile(storagePaths.imageMutations, {
    updated_at: new Date().toISOString(),
    mutations
  });

  return state;
}

export async function updateMemoryAfterPoem(params: {
  previousState: UcuBedenState;
  inputAnalysis: InputPoemsAnalysis;
}): Promise<UcuBedenState> {
  return rebuildMemoryState(params);
}

export function buildImageMutations(images: string[], date: string): ImageMutation[] {
  return topFromStrings(images, 6).map((image) => mutateImage(image, date));
}
