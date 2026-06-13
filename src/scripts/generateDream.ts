import { createDailyLifeRecord } from "../lib/dayStateEngine";
import { generateDream } from "../lib/dreamEngine";
import {
  ensureDataDirs,
  pathExists,
  readDailyLife,
  readJsonFile,
  readPersonalitySettings,
  readState,
  storagePaths,
  writeJsonFile
} from "../lib/fileStorage";
import { generateVisualImage } from "../lib/openaiImageProvider";
import { buildMemoryArchive, selectMemoryForGeneration, validateMemoryPromptFragments, writeMemoryArchive } from "../lib/memoryTraceEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { parseGenerationArgs, previousCalendarDate, todayInIstanbul } from "../lib/scheduler";
import type { DailyPoem, DreamRecord } from "../lib/types";
import { createDreamVisual } from "../lib/visualEngine";

async function main(): Promise<void> {
  await ensureDataDirs();
  const args = parseGenerationArgs(process.argv.slice(2));
  const sourceDate = args.date ?? previousCalendarDate(todayInIstanbul());
  const dreamPath = `${storagePaths.dreams}/${sourceDate}.json`;
  const visualPath = `${storagePaths.visuals}/${sourceDate}-dream.json`;

  if (!args.force && (await pathExists(dreamPath))) {
    const existingDream = await readJsonFile<DreamRecord | null>(dreamPath, null);
    if (existingDream) {
      const storedVisual = await readJsonFile(visualPath, createDreamVisual(existingDream));
      const visual = await generateVisualImage(storedVisual);
      await writeJsonFile(visualPath, visual);
      console.log(
        JSON.stringify({
          stage: "dream_visual",
          status: visual.provider === "openai" ? "ready" : "fallback kept",
          date: sourceDate,
          provider: visual.provider,
          error: visual.error ?? null
        })
      );
    }
    console.log(JSON.stringify({ stage: "dream", status: "skipped", reason: "already exists", date: sourceDate }));
    return;
  }

  const poem = await readJsonFile<DailyPoem | null>(`${storagePaths.generatedPoems}/${sourceDate}.json`, null);
  if (!poem) {
    throw new Error(`Dream generation needs a completed poem for ${sourceDate}.`);
  }

  const [state, personality, repetition] = await Promise.all([
    readState(),
    readPersonalitySettings(),
    analyzeRepetitionPressure()
  ]);
  const existingDailyLife = await readDailyLife(sourceDate);
  const dailyLife =
    existingDailyLife ??
    createDailyLifeRecord({
      date: sourceDate,
      base: poem.daily_life,
      mood: poem.mood,
      sources: poem.sources,
      state,
      personality
    });
  if (!existingDailyLife) {
    await writeJsonFile(`${storagePaths.dailyLife}/${sourceDate}.json`, dailyLife);
    console.log(JSON.stringify({ stage: "daily_life", status: "backfilled", date: sourceDate }));
  }

  const memorySelection = await selectMemoryForGeneration({ date: sourceDate, mood: poem.mood, mode: "dream", repetition });
  const promptValidation = await validateMemoryPromptFragments(memorySelection.memory_prompt_fragments);
  const safeMemorySelection = {
    ...memorySelection,
    prompt_fragments: promptValidation.safe_fragments,
    memory_prompt_fragments: promptValidation.safe_fragments
  };
  const dream = await generateDream({ date: sourceDate, poem, dailyLife, state, repetition, memorySelection: safeMemorySelection });
  const visual = await generateVisualImage(createDreamVisual(dream), { force: args.force });
  dream.visual_prompt = visual.visual_prompt;
  dream.image_path = visual.image_path;
  await writeJsonFile(dreamPath, dream);
  console.log(JSON.stringify({ stage: "dream", status: "generated", date: sourceDate, provider: dream.generation.provider }));
  await writeJsonFile(visualPath, visual);
  console.log(
    JSON.stringify({
      stage: "dream_visual",
      status: visual.provider === "openai" ? "generated" : "fallback kept",
      date: sourceDate,
      provider: visual.provider,
      error: visual.error ?? null
    })
  );
  const memoryArchive = await buildMemoryArchive();
  await writeMemoryArchive(memoryArchive);
  console.log(JSON.stringify({ stage: "memory_traces", status: "rebuilt", date: sourceDate, trace_count: memoryArchive.index.trace_count, selected_trace_ids: dream.memory_selection?.selected_trace_ids ?? [] }));

  const previousLayers = state.memory_layers ?? { short_term: [], mid_term: [], long_term: [], dim_suppressed: [] };
  await writeJsonFile(storagePaths.state, {
    ...state,
    memory_layers: {
      ...previousLayers,
      dim_suppressed: [...dream.memory_mutations, ...previousLayers.dim_suppressed].slice(0, 18)
    }
  });
  console.log(JSON.stringify({ stage: "memory", status: "updated_from_dream", date: sourceDate }));
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "dream_generation", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
