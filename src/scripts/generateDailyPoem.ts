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
import { updateMemoryAfterPoem, selectMemoryFragments } from "../lib/memoryEngine";
import { calculateMood } from "../lib/moodEngine";
import { generatePoemWithLLM } from "../lib/poemGenerator";
import { parseGenerationArgs, todayInIstanbul } from "../lib/scheduler";
import { collectSources } from "../lib/sourceCollectors";
import { createWalkState } from "../lib/walkEngine";
import { createDailyLife } from "../lib/worldEngine";
import { maybeCreateYearlyReport } from "../lib/yearlyReport";
import type { DailyPoem, GenerationContext } from "../lib/types";

async function main(): Promise<void> {
  await ensureDataDirs();

  const args = parseGenerationArgs(process.argv.slice(2));
  const date = args.date ?? todayInIstanbul();
  const poemPath = `${storagePaths.generatedPoems}/${date}.json`;

  if (!args.force && (await pathExists(poemPath))) {
    console.log(JSON.stringify({ status: "skipped", reason: "today already exists", date }, null, 2));
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
  const dailyLife = createDailyLife({ date, world, mood, sources });
  const walkState = createWalkState({ date, world, mood, sources, dailyLife });
  const memoryFragments = await selectMemoryFragments({
    date,
    state: previousState,
    inputAnalysis
  });

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
    memory_fragments: memoryFragments
  };

  const poem = await generatePoemWithLLM(context);
  await writeJsonFile(poemPath, poem);
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
  console.error(error);
  process.exit(1);
});
