import { ensureDataDirs, getLatestPoem, listDreams, listGeneratedPoems, listSourceDigests, listSources, readWorld } from "../lib/fileStorage";
import { validateMemoryCycleIntegrity } from "../lib/memoryCycle";
import { buildMemoryGraphData } from "../lib/memoryGraph";
import {
  buildMemoryArchive,
  memoryArchiveStateSignature,
  selectMemoryForGeneration,
  validateMemoryArchive,
  validateMemoryPromptFragments,
  writeMemoryArchive
} from "../lib/memoryTraceEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { analyzeSourceDigest, validateSourceInfluence } from "../lib/sourceInfluence";
import { validateSourceDigests } from "../lib/sourceDigestion";
import { validateStoredSurfaceRecords } from "../lib/surfaceValidator";
import { validateStoredLanguageRecords } from "../lib/languageValidator";
import type { MemorySelection, MemoryTrace } from "../lib/types";

function nextDate(date: string | null): string {
  const value = new Date(`${date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function selectionSample(selection: MemorySelection, traces: MemoryTrace[]) {
  const byId = new Map(traces.map((trace) => [trace.id, trace]));
  return selection.selected_trace_ids.slice(0, 5).map((id) => {
    const trace = byId.get(id);
    return trace ? { id, source: trace.source, status: trace.status, transformed_text: trace.transformed_text } : { id };
  });
}

async function main(): Promise<void> {
  await ensureDataDirs();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const shouldValidate = args.includes("--validate");
  const archive = await buildMemoryArchive();
  const repeatedArchive = shouldValidate ? await buildMemoryArchive() : null;
  if (!dryRun) await writeMemoryArchive(archive);
  const validation = shouldValidate ? await validateMemoryArchive(archive) : null;
  const [latestPoem, sources, sourceDigests, poems, dreams, repetition, world] = await Promise.all([
    getLatestPoem(),
    listSources(),
    listSourceDigests(),
    listGeneratedPoems(),
    listDreams(),
    analyzeRepetitionPressure(),
    readWorld()
  ]);
  const previewDate = nextDate(archive.index.built_through);
  const previewMood = latestPoem?.mood ?? { melancholy: 0, anger: 0, tenderness: 0, fatigue: 0, absurdity: 0, clarity: 0, desire: 0, hope: 0 };
  const [poemSelection, dreamSelection] = await Promise.all([
    selectMemoryForGeneration({ date: previewDate, mood: previewMood, mode: "poem", repetition, traces: archive.traces, sources }),
    selectMemoryForGeneration({ date: previewDate, mood: previewMood, mode: "dream", repetition, traces: archive.traces, sources })
  ]);
  const promptValidation = await validateMemoryPromptFragments([...poemSelection.memory_prompt_fragments, ...dreamSelection.memory_prompt_fragments], sources);
  const graph = await buildMemoryGraphData({ traces: archive.traces, report: archive.report, index: archive.index, poems, dreams, sources });
  const cycleValidation = shouldValidate
    ? await validateMemoryCycleIntegrity({
        archive,
        poems,
        dreams,
        sources,
        poem_preview: poemSelection,
        dream_preview: dreamSelection
      })
    : null;
  const deterministicRebuild = !repeatedArchive || memoryArchiveStateSignature(archive) === memoryArchiveStateSignature(repeatedArchive);
  const sourceDigest = analyzeSourceDigest(sources);
  const sourceInfluenceValidation = validateSourceInfluence(sources);
  const sourceDigestionValidation = validateSourceDigests(sourceDigests, sources);
  const surfaceValidation = shouldValidate
    ? await validateStoredSurfaceRecords({ poems, dreams, traces: archive.traces, sources, world, repetition })
    : null;
  const languageValidation = shouldValidate ? validateStoredLanguageRecords(poems, dreams) : null;
  const valid =
    (validation?.valid ?? true) &&
    (cycleValidation?.valid ?? true) &&
    promptValidation.valid &&
    sourceInfluenceValidation.valid &&
    sourceDigestionValidation.valid &&
    (surfaceValidation?.valid ?? true) &&
    (languageValidation?.valid ?? true) &&
    deterministicRebuild;
  console.log(
    JSON.stringify(
      {
        status: dryRun ? "dry_run" : "rebuilt",
        built_through: archive.index.built_through,
        trace_count: archive.index.trace_count,
        trace_files: archive.trace_files.length,
        linked_trace_count: graph.linked_trace_count,
        linked_edge_count: graph.linked_edge_count,
        graph_public_node_count: graph.nodes.length,
        suppressed_count: archive.index.by_status.suppressed.length,
        overexposed_count: archive.index.by_status.overexposed.length,
        dream_return_count: archive.traces.filter((trace) => trace.kind === "dream_return" || trace.times_returned_in_dream > 0).length,
        sources: Object.fromEntries(Object.entries(archive.index.by_source).map(([source, ids]) => [source, ids.length])),
        statuses: Object.fromEntries(Object.entries(archive.index.by_status).map(([status, ids]) => [status, ids.length])),
        unsafe_public_text: validation?.unsafe_public_text ?? [],
        unsafe_prompt_fragments: cycleValidation?.unsafe_prompt_fragments ?? promptValidation.unsafe_fragments.map((item) => ({ matches: item.matches })),
        unresolved_selected_trace_ids: cycleValidation?.unresolved_selected_trace_ids ?? [],
        invalid_dream_return_links: cycleValidation?.invalid_dream_return_links ?? [],
        overexposed_direct_prompt: cycleValidation?.overexposed_direct_prompt ?? [],
        historical_overexposed_direct_prompt_warnings: cycleValidation?.historical_overexposed_direct_prompt_warnings ?? [],
        graph_public_node_count_matches_public_safe_trace_count: cycleValidation?.graph_public_node_count_matches_public_safe_trace_count ?? null,
        dream_suppressed_preference: cycleValidation?.dream_suppressed_preference ?? null,
        source_digest: sourceDigest,
        source_influence_validation: sourceInfluenceValidation,
        source_digestion_validation: sourceDigestionValidation,
        surface_validation: surfaceValidation,
        language_validation: languageValidation,
        metadata_records: cycleValidation?.metadata_records ?? null,
        deterministic_rebuild: {
          valid: deterministicRebuild,
          memory_state_signature: memoryArchiveStateSignature(archive)
        },
        sample_selected_traces: {
          poem: selectionSample(poemSelection, archive.traces),
          dream: selectionSample(dreamSelection, archive.traces)
        },
        preview_selection_counts: {
          poem_suppressed: poemSelection.suppressed_trace_ids.length,
          dream_suppressed: dreamSelection.suppressed_trace_ids.length,
          poem_indirect: poemSelection.indirect_trace_ids.length,
          dream_indirect: dreamSelection.indirect_trace_ids.length
        },
        memory_climate_summary: Object.fromEntries(Object.entries(archive.report.climate).map(([key, dimension]) => [key, dimension.summary])),
        validation: validation
          ? {
              ...validation,
              valid,
              cycle: cycleValidation
            }
          : null
      },
      null,
      2
    )
  );
  if (shouldValidate && !valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
