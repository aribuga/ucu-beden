import {
  ensureDataDirs,
  listDreams,
  listGeneratedPoems,
  pathExists,
  storagePaths,
  writeJsonFile
} from "../lib/fileStorage";
import { createDreamVisual, createPoemVisual } from "../lib/visualEngine";

async function main(): Promise<void> {
  await ensureDataDirs();
  const force = process.argv.slice(2).includes("--force");
  const [poems, dreams] = await Promise.all([listGeneratedPoems(), listDreams()]);
  let poemCreated = 0, poemSkipped = 0, dreamCreated = 0, dreamSkipped = 0;
  for (const poem of poems) {
    const visualPath = `${storagePaths.visuals}/${poem.date}-poem.json`;
    if (!force && (await pathExists(visualPath))) { poemSkipped += 1; continue; }
    await writeJsonFile(visualPath, createPoemVisual(poem));
    poemCreated += 1;
  }
  for (const dream of dreams) {
    const visualPath = `${storagePaths.visuals}/${dream.date}-dream.json`;
    if (!force && (await pathExists(visualPath))) { dreamSkipped += 1; continue; }
    await writeJsonFile(visualPath, createDreamVisual(dream));
    dreamCreated += 1;
  }
  console.log(JSON.stringify({ status: "completed", force, poems: { total: poems.length, created: poemCreated, skipped: poemSkipped }, dreams: { total: dreams.length, created: dreamCreated, skipped: dreamSkipped } }, null, 2));
}
main().catch((error) => { console.error(JSON.stringify({ stage: "visual_backfill", status: "failed", error: error instanceof Error ? error.message : String(error) })); process.exit(1); });
