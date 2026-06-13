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
import { buildMemoryArchive, selectMemoryForGeneration, validateMemoryPromptFragments, writeMemoryArchive } from "../lib/memoryTraceEngine";
import { calculateMood } from "../lib/moodEngine";
import { generateVisualImage } from "../lib/openaiImageProvider";
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
      const visualPath = `${storagePaths.visuals}/${date}-poem.json`;
      const storedVisual = await readJsonFile(visualPath, createPoemVisual(existingPoem));
      const visual = await generateVisualImage(storedVisual);
      await writeJsonFile(visualPath, visual);
      console.log(
        JSON.stringify({
          stage: "poem_visual",
          status: visual.provider === "openai" ? "ready" : "fallback kept",
          date,
          provider: visual.provider,
          error: visual.error ?? null
        })
      );
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
  const { mood, sentence } = calculateMood({ date, state: previousState, sources, inputAnalysis });
  const baseDailyLife = createDailyLife({ date, world, mood, sources });
  const dailyLife = createDailyLifeRecord({ date, base: baseDailyLife, mood, sources, state: previousState, personality: personalitySettings });
  await writeJsonFile(`${storagePaths.dailyLife}/${date}.json`, dailyLife);
  console.log(JSON.stringify({ stage: "daily_life", status: "generated", date }));
  const walkState = createWalkState({ date, world, mood, sources, dailyLife });
  const repetitionPressure = await analyzeRepetitionPressure();
  const memorySelection = await selectMemoryForGeneration({ date, mood, mode: "poem", repetition: repetitionPressure });
  const legacyMemoryFragments =
    memorySelection.prompt_fragments.length === 0 ? await selectMemoryFragments({ date, state: previousState, inputAnalysis }) : [];
  const promptValidation = await validateMemoryPromptFragments(memorySelection.prompt_fragments.length > 0 ? memorySelection.prompt_fragments : legacyMemoryFragments);
  const memoryFragments = promptValidation.safe_fragments;
  const effectiveMemorySelection = { ...memorySelection, prompt_fragments: memoryFragments, memory_prompt_fragments: memoryFragments };

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
    memory_selection: effectiveMemorySelection,
    repetition_pressure: repetitionPressure
  };

  const poem = await generatePoemWithLLM(context);
  await writeJsonFile(poemPath, poem);
  console.log(JSON.stringify({ stage: "poem", status: "generated", date, provider: poem.generation.provider }));
  const visual = await generateVisualImage(createPoemVisual(poem), { force: args.force });
  await writeJsonFile(`${storagePaths.visuals}/${date}-poem.json`, visual);
  console.log(JSON.stringify({ stage: "poem_visual", status: visual.provider === "openai" ? "generated" : "fallback kept", date, provider: visual.provider, error: visual.error ?? null }));
  const updatedState = await updateMemoryAfterPoem({ previousState, inputAnalysis });
  const memoryArchive = await buildMemoryArchive();
  await writeMemoryArchive(memoryArchive);
  const yearlyReport = await maybeCreateYearlyReport(poem);

  console.log(JSON.stringify({ status: "generated", date, age: poem.age_display, poem_file: poemPath, poem_provider: poem.generation.provider, openai_fallback_reason: poem.generation.fallback_reason, title_generation: poem.title_generation, mood_sentence: poem.mood_sentence, generated_days: updatedState.generated_days, memory_density: updatedState.memory_density, selected_trace_ids: poem.memory_selection?.selected_trace_ids ?? [], memory_trace_count: memoryArchive.index.trace_count, yearly_report: yearlyReport ? `year_${String(yearlyReport.year).padStart(2, "0")}.json` : null }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "morning_generation", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
