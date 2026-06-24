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
import { ensureSourceDigest } from "../lib/sourceDigestService";
import { createWalkState } from "../lib/walkEngine";
import { createDailyLife } from "../lib/worldEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { createPoemVisual } from "../lib/visualEngine";
import { reconcileVisualImagePath, visualImageStatus } from "../lib/visualFileStatus";
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
    const digestResult = await ensureSourceDigest({ source: sources, force: args.force });
    console.log(JSON.stringify({ stage: "source_digest", status: digestResult.status, date, provider: digestResult.digest.provider, safety_valid: digestResult.digest.safety.valid }));
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
      const refreshedVisual = createPoemVisual(existingPoem);
      const storedVisual = await readJsonFile<typeof refreshedVisual | null>(visualPath, null);
      const preparedVisual = await reconcileVisualImagePath(
        storedVisual
          ? {
              ...refreshedVisual,
              ...storedVisual,
              visual_prompt: refreshedVisual.visual_prompt,
              negative_prompt: refreshedVisual.negative_prompt,
              style_tags: refreshedVisual.style_tags
            }
          : refreshedVisual
      );
      const visual = preparedVisual.hadUsableImage
        ? preparedVisual.visual
        : await generateVisualImage(preparedVisual.visual);
      await writeJsonFile(visualPath, visual);
      console.log(
        JSON.stringify({
          stage: "poem_visual",
          status: visualImageStatus(visual) === "ready" ? "ready" : "failed",
          date,
          provider: visual.provider,
          image_status: visualImageStatus(visual),
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
  const digestResult = await ensureSourceDigest({ source: sources, force: args.force });
  const sourceDigest = digestResult.digest;
  console.log(JSON.stringify({ stage: "source_digest", status: digestResult.status, date, provider: sourceDigest.provider, safety_valid: sourceDigest.safety.valid }));

  const ageMonths = existingPoem?.age_months ?? nextAgeMonths(previousState.age_months);
  const ageDisplay = formatAge(ageMonths);
  const { mood, sentence, metadata: moodMetadata } = calculateMood({ date, state: previousState, sources, inputAnalysis });
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
    source_digest: sourceDigest,
    input_analysis: inputAnalysis,
    mood,
    mood_sentence: sentence,
    mood_metadata: moodMetadata,
    daily_life: dailyLife,
    walk_state: walkState,
    personality_settings: personalitySettings,
    memory_fragments: memoryFragments,
    memory_selection: effectiveMemorySelection,
    repetition_pressure: repetitionPressure
  };

  const poem = await generatePoemWithLLM(context);
  await writeJsonFile(poemPath, poem);
  console.log(
    JSON.stringify({
      stage: "poem",
      status: "generated",
      date,
      provider: poem.generation.provider,
      surface_validation_passed: poem.generation.surface_validation_passed,
      surface_validation_status: poem.generation.surface_validation_status,
      retry_count: poem.generation.retry_count,
      language_validation_passed: poem.generation.language_validation_passed,
      english_ratio: poem.generation.english_ratio,
      language_retry_count: poem.generation.language_retry_count
    })
  );
  const preparedVisual = await reconcileVisualImagePath(createPoemVisual(poem));
  const visual = preparedVisual.hadUsableImage && !args.force
    ? preparedVisual.visual
    : await generateVisualImage(preparedVisual.visual, { force: args.force });
  await writeJsonFile(`${storagePaths.visuals}/${date}-poem.json`, visual);
  console.log(JSON.stringify({ stage: "poem_visual", status: visualImageStatus(visual) === "ready" ? "generated" : "failed", date, provider: visual.provider, image_status: visualImageStatus(visual), error: visual.error ?? null }));
  const updatedState = await updateMemoryAfterPoem({ previousState, inputAnalysis });
  const memoryArchive = await buildMemoryArchive();
  await writeMemoryArchive(memoryArchive);
  const yearlyReport = await maybeCreateYearlyReport(poem);

  console.log(JSON.stringify({ status: "generated", date, age: poem.age_display, poem_file: poemPath, poem_provider: poem.generation.provider, openai_fallback_reason: poem.generation.fallback_reason, title_generation: poem.title_generation, mood_sentence: poem.mood_sentence, generated_days: updatedState.generated_days, memory_density: updatedState.memory_density, selected_trace_ids: poem.memory_selection?.selected_trace_ids ?? [], surface_validation_passed: poem.generation.surface_validation_passed, surface_validation_status: poem.generation.surface_validation_status, retry_count: poem.generation.retry_count, language_validation_passed: poem.generation.language_validation_passed, english_ratio: poem.generation.english_ratio, language_retry_count: poem.generation.language_retry_count, memory_trace_count: memoryArchive.index.trace_count, yearly_report: yearlyReport ? `year_${String(yearlyReport.year).padStart(2, "0")}.json` : null }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "morning_generation", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
