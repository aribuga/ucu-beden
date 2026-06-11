import { formatAge, nextAgeMonths } from "../lib/age";
import {
  ensureDataDirs,
  pathExists,
  readJsonFile,
  readPersonalitySettings,
  readState,
  readWorld,
  storagePaths,
  writeJsonFile
} from "../lib/fileStorage";
import { analyzeAndSaveInputPoems } from "../lib/inputPoems";
import { createDailyLifeRecord } from "../lib/dayStateEngine";
import { updateMemoryAfterPoem, selectMemoryFragments } from "../lib/memoryEngine";
import { calculateMood } from "../lib/moodEngine";
import { generatePoemWithLLM } from "../lib/poemGenerator";
import { parseGenerationArgs, todayInIstanbul } from "../lib/scheduler";
import { collectSources } from "../lib/sourceCollectors";
import { createWalkState } from "../lib/walkEngine";
import { createDailyLife } from "../lib/worldEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { createPoemVisual } from "../lib/visualEngine";
import { maybeCreateYearlyReport } from "../lib/yearlyReport";
import type { DailyPoem, GenerationContext } from "../lib/types";

async function main(): Promise<void> {
  await ensureDataDirs();

  const args = parseGenerationArgs(process.argv.slice(2));
  const date = args.date ?? todayInIstanbul();
  const poemPath = `${storagePaths.generatedPoems}/${date}.json`;

  if (!args.force && (await pathExists(poemPath))) {
    const sources = await collectSources(date);
    await writeJsonFile(`${storagePaths.sources}/${date}.json`, sources);
    const existingPoem = await readJsonFile<DailyPoem | null>(poemPath, null);
    if (existingPoem) {
      if (!(await pathExists(`${storagePaths.dailyLife}/${date}.json`))) {
        const [state, personality] = await Promise.all([readState(), readPersonalitySettings()]);
        const dailyLife = createDailyLifeRecord({
          date,
          base: existingPoem.daily_life,
          mood: existingPoem.mood,
          sources,
          state,
          personality
        });
        await writeJsonFile(`${storagePaths.dailyLife}/${date}.json`, dailyLife);
        console.log(JSON.stringify({ stage: "daily_life", status: "backfilled", date }));
      } else {
        console.log(JSON.stringify({ stage: "daily_life", status: "skipped", reason: "already exists", date }));
      }
      if (!(await pathExists(`${storagePaths.visuals}/${date}-poem.json`))) {
        await writeJsonFile(`${storagePaths.visuals}/${date}-poem.json`, createPoemVisual(existingPoem));
        console.log(JSON.stringify({ stage: "poem_visual_prompt", status: "backfilled", date }));
      } else {
        console.log(JSON.stringify({ stage: "poem_visual_prompt", status: "skipped", reason: "already exists", date }));
      }
    }
    console.log(JSON.stringify({ stage: "poem", status: "skipped", reason: "today already exists", date, sources_refreshed: true }, null, 2));
    return;
  }

  const existingPoem = args.force ? await readJsonFile<DailyPoem | null>(poemPath, null) : null;

  const [world, previousState, inputAnalysis, sources, personalitySettings] = await Promise.all([
    readWorld(),
    readState(),
    analyzeAndSaveInputPoems(),
    collectSources(date),
    readPersonalitySettings()
  ]);
  await writeJsonFile(`${storagePaths.sources}/${date}.json`, sources);

  const ageMonths = existingPoem?.age_months ?? nextAgeMonths(previousState.age_months);
  const ageDisplay = formatAge(ageMonths);
  const { mood, sentence } = calculateMood({
    date,
    state: previousState,
    sources,
    inputAnalysis
  });
  const baseDailyLife = createDailyLife({ date, world, mood, sources });
  const dailyLife = createDailyLifeRecord({
    date,
    base: baseDailyLife,
    mood,
    sources,
    state: previousState,
    personality: personalitySettings
  });
  await writeJsonFile(`${storagePaths.dailyLife}/${date}.json`, dailyLife);
  console.log(JSON.stringify({ stage: "daily_life", status: "generated", date }));
  const walkState = createWalkState({ date, world, mood, sources, dailyLife });
  const [memoryFragments, repetitionPressure] = await Promise.all([
    selectMemoryFragments({
      date,
      state: previousState,
      inputAnalysis
    }),
    analyzeRepetitionPressure()
  ]);

  const context: GenerationContext = {
    date,
    age_months: ageMonths,
    age_display: ageDisplay,
    state: previousState,
    world,
    sources,
    input_analysis: inputAnalysis,
    mood,
    mood_sentence: sentence,
    daily_life: dailyLife,
    walk_state: walkState,
    personality_settings: personalitySettings,
    memory_fragments: memoryFragments,
    repetition_pressure: repetitionPressure
  };

  const poem = await generatePoemWithLLM(context);
  await writeJsonFile(poemPath, poem);
  console.log(JSON.stringify({ stage: "poem", status: "generated", date, provider: poem.generation.provider }));
  await writeJsonFile(`${storagePaths.visuals}/${date}-poem.json`, createPoemVisual(poem));
  console.log(JSON.stringify({ stage: "poem_visual_prompt", status: "generated", date, provider: "metadata-fallback" }));
  const updatedState = await updateMemoryAfterPoem({ previousState, inputAnalysis });
  const yearlyReport = await maybeCreateYearlyReport(poem);

  console.log(
    JSON.stringify(
      {
        status: "generated",
        date,
        age: poem.age_display,
        poem_file: poemPath,
        poem_provider: poem.generation.provider,
        openai_fallback_reason: poem.generation.fallback_reason,
        title_generation: poem.title_generation,
        mood_sentence: poem.mood_sentence,
        generated_days: updatedState.generated_days,
        memory_density: updatedState.memory_density,
        yearly_report: yearlyReport ? `year_${String(yearlyReport.year).padStart(2, "0")}.json` : null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "morning_generation", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
