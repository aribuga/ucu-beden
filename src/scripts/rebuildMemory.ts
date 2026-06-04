import { ensureDataDirs, readState, storagePaths, writeJsonFile } from "../lib/fileStorage";
import { analyzeAndSaveInputPoems } from "../lib/inputPoems";
import { rebuildMemoryState } from "../lib/memoryEngine";

async function main(): Promise<void> {
  await ensureDataDirs();
  const previousState = await readState();
  const inputAnalysis = await analyzeAndSaveInputPoems();
  const state = await rebuildMemoryState({ previousState, inputAnalysis });
  await writeJsonFile(storagePaths.state, state);
  console.log(
    JSON.stringify(
      {
        status: "rebuilt",
        generated_days: state.generated_days,
        age_months: state.age_months,
        dominant_words: state.dominant_words.slice(0, 10)
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
