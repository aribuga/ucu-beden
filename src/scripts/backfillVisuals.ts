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
import type { DreamRecord, VisualKind, VisualMetadata } from "../lib/types";
import { createDreamVisual, createPoemVisual } from "../lib/visualEngine";

type BackfillStats = {
  total: number;
  metadata_created: number;
  images_generated: number;
  fallback_kept: number;
  skipped: number;
  errors: number;
  completed_dates: string[];
  skipped_dates: string[];
  failed: Array<{ date: string; error: string }>;
};

function optionValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
}

function numberOption(args: string[], name: string, fallback: number): number {
  const parsed = Number(optionValue(args, name));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function inRange(date: string, from?: string, to?: string): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

function newStats(total: number): BackfillStats {
  return {
    total,
    metadata_created: 0,
    images_generated: 0,
    fallback_kept: 0,
    skipped: 0,
    errors: 0,
    completed_dates: [],
    skipped_dates: [],
    failed: []
  };
}

async function imageExists(visual: VisualMetadata): Promise<boolean> {
  return Boolean(
    visual.provider === "openai" &&
    visual.image_path &&
    (await pathExists(`public/${visual.image_path.replace(/^\/+/, "")}`))
  );
}

function recordFailure(stats: BackfillStats, date: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  stats.errors += 1;
  stats.failed.push({ date, error: message.replace(/\s+/g, " ").slice(0, 240) });
}

async function wait(ms: number): Promise<void> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await ensureDataDirs();

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const imagesOnly = args.includes("--images-only");
  const from = optionValue(args, "--from");
  const to = optionValue(args, "--to");
  const limit = numberOption(args, "--limit", Number.POSITIVE_INFINITY);
  const delayMs = numberOption(args, "--delay-ms", Number(process.env.OPENAI_IMAGE_DELAY_MS) || 1_200);
  const shouldDelay = Boolean(process.env.OPENAI_API_KEY?.trim());
  const [allPoems, allDreams] = await Promise.all([listGeneratedPoems(), listDreams()]);
  const poems = allPoems.filter((poem) => inRange(poem.date, from, to));
  const dreams = allDreams.filter((dream) => inRange(dream.date, from, to));
  const poemStats = newStats(poems.length);
  const dreamStats = newStats(dreams.length);
  let attempted = 0;

  const processVisual = async ({
    date,
    kind,
    visualPath,
    createVisual,
    stats,
    updateDream
  }: {
    date: string;
    kind: VisualKind;
    visualPath: string;
    createVisual: () => VisualMetadata;
    stats: BackfillStats;
    updateDream?: (visual: VisualMetadata) => Promise<void>;
  }) => {
    try {
      const exists = await pathExists(visualPath);
      if (imagesOnly && !exists) {
        stats.skipped += 1;
        stats.skipped_dates.push(date);
        return;
      }
      const stored = exists ? await readJsonFile<VisualMetadata | null>(visualPath, null) : null;
      const visual = stored ?? createVisual();
      if (!stored) stats.metadata_created += 1;
      if (!force && (await imageExists(visual))) {
        stats.skipped += 1;
        stats.skipped_dates.push(date);
        return;
      }

      const generated = await generateVisualImage(visual, { force });
      await writeJsonFile(visualPath, generated);
      await updateDream?.(generated);
      attempted += 1;
      if (generated.provider === "openai") {
        stats.images_generated += 1;
        stats.completed_dates.push(date);
        console.log(JSON.stringify({ stage: "visual_backfill_item", status: "generated", type: kind, date, image_path: generated.image_path }));
      } else {
        stats.fallback_kept += 1;
        recordFailure(stats, date, generated.error ?? "Image generation failed; fallback kept.");
        console.log(JSON.stringify({ stage: "visual_backfill_item", status: "failed", type: kind, date, error: generated.error }));
      }
      if (shouldDelay) await wait(delayMs);
    } catch (error) {
      attempted += 1;
      recordFailure(stats, date, error);
      console.log(JSON.stringify({ stage: "visual_backfill_item", status: "failed", type: kind, date, error: String(error) }));
    }
  };

  for (const poem of poems) {
    if (attempted >= limit) break;
    await processVisual({
      date: poem.date,
      kind: "poem",
      visualPath: `${storagePaths.visuals}/${poem.date}-poem.json`,
      createVisual: () => createPoemVisual(poem),
      stats: poemStats
    });
  }

  for (const dream of dreams) {
    if (attempted >= limit) break;
    await processVisual({
      date: dream.date,
      kind: "dream",
      visualPath: `${storagePaths.visuals}/${dream.date}-dream.json`,
      createVisual: () => createDreamVisual(dream),
      stats: dreamStats,
      updateDream: async (visual) => {
        const updatedDream: DreamRecord = { ...dream, image_path: visual.image_path };
        await writeJsonFile(`${storagePaths.dreams}/${dream.date}.json`, updatedDream);
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        status: poemStats.errors + dreamStats.errors ? "completed_with_failures" : "completed",
        force,
        images_only: imagesOnly,
        from: from ?? null,
        to: to ?? null,
        limit: Number.isFinite(limit) ? limit : null,
        delay_ms: delayMs,
        attempted,
        poems: poemStats,
        dreams: dreamStats,
        failed_dates: [
          ...poemStats.failed.map((item) => `poem:${item.date}`),
          ...dreamStats.failed.map((item) => `dream:${item.date}`)
        ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "visual_backfill", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
