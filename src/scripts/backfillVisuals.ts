import {
  ensureDataDirs,
  listDreams,
  listGeneratedPoems,
  pathExists,
  readJsonFile,
  storagePaths,
  writeJsonFile
} from "../lib/fileStorage";
import { generateVisualImage } from "../lib/openaiImageProvider";
import type { DreamRecord, VisualMetadata } from "../lib/types";
import { createDreamVisual, createPoemVisual } from "../lib/visualEngine";

type BackfillStats = {
  total: number;
  metadata_created: number;
  images_generated: number;
  fallback_kept: number;
  skipped: number;
};

function optionValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
}

function numberOption(args: string[], name: string, fallback: number): number {
  const parsed = Number(optionValue(args, name));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function wait(ms: number): Promise<void> {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function main(): Promise<void> {
  await ensureDataDirs();

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const imagesOnly = args.includes("--images-only");
  const from = optionValue(args, "--from");
  const limit = numberOption(args, "--limit", Number.POSITIVE_INFINITY);
  const delayMs = numberOption(args, "--delay-ms", Number(process.env.OPENAI_IMAGE_DELAY_MS) || 1_200);
  const shouldDelay = Boolean(process.env.OPENAI_API_KEY?.trim());
  const [allPoems, allDreams] = await Promise.all([listGeneratedPoems(), listDreams()]);
  const poems = allPoems.filter((poem) => !from || poem.date >= from);
  const dreams = allDreams.filter((dream) => !from || dream.date >= from);
  const poemStats: BackfillStats = { total: poems.length, metadata_created: 0, images_generated: 0, fallback_kept: 0, skipped: 0 };
  const dreamStats: BackfillStats = { total: dreams.length, metadata_created: 0, images_generated: 0, fallback_kept: 0, skipped: 0 };
  let attempted = 0;

  for (const poem of poems) {
    if (attempted >= limit) break;
    const visualPath = `${storagePaths.visuals}/${poem.date}-poem.json`;
    const exists = await pathExists(visualPath);
    if (imagesOnly && !exists) {
      poemStats.skipped += 1;
      continue;
    }
    const stored = exists ? await readJsonFile<VisualMetadata | null>(visualPath, null) : null;
    const visual = stored ?? createPoemVisual(poem);
    if (!stored) poemStats.metadata_created += 1;
    if (!force && visual.provider === "openai" && visual.image_path && (await pathExists(`public/${visual.image_path.replace(/^\/+/, "")}`))) {
      poemStats.skipped += 1;
      continue;
    }
    const generated = await generateVisualImage(visual, { force });
    await writeJsonFile(visualPath, generated);
    generated.provider === "openai" ? (poemStats.images_generated += 1) : (poemStats.fallback_kept += 1);
    attempted += 1;
    if (shouldDelay) await wait(delayMs);
  }

  for (const dream of dreams) {
    if (attempted >= limit) break;
    const visualPath = `${storagePaths.visuals}/${dream.date}-dream.json`;
    const exists = await pathExists(visualPath);
    if (imagesOnly && !exists) {
      dreamStats.skipped += 1;
      continue;
    }
    const stored = exists ? await readJsonFile<VisualMetadata | null>(visualPath, null) : null;
    const visual = stored ?? createDreamVisual(dream);
    if (!stored) dreamStats.metadata_created += 1;
    if (!force && visual.provider === "openai" && visual.image_path && (await pathExists(`public/${visual.image_path.replace(/^\/+/, "")}`))) {
      dreamStats.skipped += 1;
      continue;
    }
    const generated = await generateVisualImage(visual, { force });
    const updatedDream: DreamRecord = { ...dream, image_path: generated.image_path };
    await Promise.all([
      writeJsonFile(visualPath, generated),
      writeJsonFile(`${storagePaths.dreams}/${dream.date}.json`, updatedDream)
    ]);
    generated.provider === "openai" ? (dreamStats.images_generated += 1) : (dreamStats.fallback_kept += 1);
    attempted += 1;
    if (shouldDelay) await wait(delayMs);
  }

  console.log(
    JSON.stringify(
      {
        status: "completed",
        force,
        images_only: imagesOnly,
        from: from ?? null,
        limit: Number.isFinite(limit) ? limit : null,
        delay_ms: delayMs,
        attempted,
        poems: poemStats,
        dreams: dreamStats
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      stage: "visual_backfill",
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exit(1);
});
