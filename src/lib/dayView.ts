import { createDailyLifeRecord } from "./dayStateEngine";
import { listDreams, readDailyLife, readVisual } from "./fileStorage";
import { todayInIstanbul } from "./scheduler";
import type { DailyPoem, PersonalitySettings, UcuBedenState } from "./types";
import { createDreamVisual, createPoemVisual } from "./visualEngine";

export async function resolvePoemDayView(
  poem: DailyPoem,
  state: UcuBedenState,
  personality: PersonalitySettings,
  options: { preferLatestDream?: boolean } = {}
) {
  const [storedDailyLife, dreams, storedPoemVisual] = await Promise.all([
    readDailyLife(poem.date),
    listDreams(),
    readVisual(poem.date, "poem")
  ]);
  const dream = options.preferLatestDream
    ? dreams.at(-1) ?? null
    : dreams.find((item) => item.source_date === poem.date || item.date === poem.date) ?? null;
  const storedDreamVisual = dream ? await readVisual(dream.date, "dream") : null;
  const dailyLife =
    storedDailyLife ??
    createDailyLifeRecord({
      date: poem.date,
      base: poem.daily_life,
      mood: poem.mood,
      sources: poem.sources,
      state,
      personality
    });

  return {
    dailyLife,
    dream,
    poemVisual: storedPoemVisual ?? createPoemVisual(poem),
    dreamVisual: dream ? storedDreamVisual ?? createDreamVisual(dream) : null,
    isHistorical: poem.date !== todayInIstanbul()
  };
}
