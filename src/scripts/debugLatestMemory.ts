import { getLatestDream, getLatestPoem, listDreams, listGeneratedPoems, listSources, readWorld } from "../lib/fileStorage";
import { buildMemoryGraphData } from "../lib/memoryGraph";
import { memoryClimateDetail, memoryClimateHeadline } from "../lib/memoryPresentation";
import { buildMemoryArchive, validateMemoryArchive, validateMemoryPromptFragments } from "../lib/memoryTraceEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { analyzeGeneratedDreamSurface, analyzeGeneratedPoemSurface } from "../lib/surfaceValidator";
import { analyzeGeneratedDreamLanguage, analyzeGeneratedPoemLanguage } from "../lib/languageValidator";
import type { DailyPoem, DreamRecord, MemorySelection, MemoryTrace, SourceBundle } from "../lib/types";

function selectionFields(selection: MemorySelection): Record<string, boolean> {
  return Object.fromEntries(
    ["selected_trace_ids", "direct_trace_ids", "indirect_trace_ids", "suppressed_trace_ids", "memory_prompt_fragments"].map((field) => [
      field,
      Array.isArray(selection[field as keyof MemorySelection])
    ])
  );
}

async function inspectSelection(params: {
  origin: "poem" | "dream";
  record: DailyPoem | DreamRecord | null;
  selection: MemorySelection | undefined;
  traces: MemoryTrace[];
  sources: SourceBundle[];
}) {
  if (!params.record) return { status: "missing", date: null };
  if (!params.selection) {
    return {
      status: "legacy_without_memory_selection",
      date: params.record.date,
      generated_at: params.record.generated_at,
      metadata_complete: false
    };
  }
  const byId = new Map(params.traces.map((trace) => [trace.id, trace]));
  const selected = params.selection.selected_trace_ids.map((id) => byId.get(id)).filter((trace): trace is MemoryTrace => trace !== undefined);
  const unresolved = params.selection.selected_trace_ids.filter((id) => !byId.has(id));
  const guard = await validateMemoryPromptFragments(params.selection.memory_prompt_fragments, params.sources);
  const recallReflected = unresolved.length === 0 && selected.every((trace) => trace.times_recalled > 0 && trace.last_recalled_at !== null);
  return {
    status: "memory_selection_present",
    date: params.record.date,
    generated_at: params.record.generated_at,
    metadata_complete: Object.values(selectionFields(params.selection)).every(Boolean),
    metadata_fields: selectionFields(params.selection),
    selected_trace_ids: params.selection.selected_trace_ids,
    direct_trace_ids: params.selection.direct_trace_ids,
    indirect_trace_ids: params.selection.indirect_trace_ids,
    suppressed_trace_ids: params.selection.suppressed_trace_ids,
    memory_prompt_fragments: params.selection.memory_prompt_fragments,
    unresolved_selected_trace_ids: unresolved,
    prompt_guard: {
      valid: guard.valid,
      safe_fragment_count: guard.safe_fragments.length,
      unsafe_fragments: guard.unsafe_fragments.map((item) => ({ matches: item.matches }))
    },
    recall_rebuild_reflected: recallReflected,
    recall_state: selected.map((trace) => ({
      id: trace.id,
      status: trace.status,
      times_recalled: trace.times_recalled,
      last_recalled_at: trace.last_recalled_at,
      times_returned_in_dream: trace.times_returned_in_dream,
      last_dream_return_at: trace.last_dream_return_at
    }))
  };
}

function dreamReturnState(dream: DreamRecord | null, traces: MemoryTrace[]) {
  if (!dream) return { status: "missing" };
  if (!dream.memory_selection) return { status: "legacy_without_memory_selection", date: dream.date };
  const byId = new Map(traces.map((trace) => [trace.id, trace]));
  const dreamTrace = traces.find((trace) => trace.source === "dream" && trace.date === dream.date);
  const candidates = dream.memory_selection.suppressed_trace_ids;
  const reflected = candidates.filter((id) => {
    const trace = byId.get(id);
    return Boolean(
      trace &&
      trace.times_returned_in_dream > 0 &&
      dreamTrace?.linked_traces.includes(id) &&
      trace.linked_traces.includes(dreamTrace.id)
    );
  });
  return {
    status: "checked",
    date: dream.date,
    dream_trace_id: dreamTrace?.id ?? null,
    candidate_trace_ids: candidates,
    reflected_trace_ids: reflected,
    all_candidates_reflected: candidates.length === reflected.length
  };
}

function surfaceDebug(record: DailyPoem | DreamRecord | null, computed: Awaited<ReturnType<typeof analyzeGeneratedPoemSurface>> | null) {
  return {
    stored_metadata_present: record?.generation.surface_validation_passed !== undefined,
    retry_count: record?.generation.retry_count ?? null,
    title_violation: computed?.title_violation ?? null,
    repeated_surfaces: computed?.repeated_surfaces ?? [],
    home_place_leak_score: computed?.home_place_leak_score ?? null,
    repeated_phrase_score: computed?.repeated_phrase_score ?? null,
    final_status: record?.generation.surface_validation_status ?? computed?.final_status ?? null,
    signature_ignored_from_analysis: computed?.signature_ignored_from_analysis ?? null,
    computed,
    stored: record?.generation ?? null
  };
}

function languageDebug(record: DailyPoem | DreamRecord | null, computed: ReturnType<typeof analyzeGeneratedPoemLanguage> | null) {
  return {
    stored_metadata_present: record?.generation.language_validation_passed !== undefined,
    language_validation_passed: record?.generation.language_validation_passed ?? computed?.language_validation_passed ?? null,
    english_ratio: record?.generation.english_ratio ?? computed?.english_ratio ?? null,
    language_retry_count: record?.generation.language_retry_count ?? null,
    language_violations: record?.generation.language_violations ?? computed?.language_violations ?? [],
    computed,
    stored: record?.generation ?? null
  };
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes("--write")) throw new Error("debug:latest-memory is read-only and does not support --write.");
  const archive = await buildMemoryArchive();
  const [latestPoem, latestDream, poems, dreams, sources, archiveValidation, world, repetition] = await Promise.all([
    getLatestPoem(),
    getLatestDream(),
    listGeneratedPoems(),
    listDreams(),
    listSources(),
    validateMemoryArchive(archive),
    readWorld(),
    analyzeRepetitionPressure()
  ]);
  const graph = await buildMemoryGraphData({
    traces: archive.traces,
    report: archive.report,
    index: archive.index,
    poems,
    dreams,
    sources
  });
  const latestDates = new Set([latestPoem?.date, latestDream?.date].filter((date): date is string => Boolean(date)));
  const contributionIds = new Set(graph.nodes.filter((node) => latestDates.has(node.date)).map((node) => node.id));
  const contributionEdges = graph.edges.filter((edge) => contributionIds.has(edge.source) || contributionIds.has(edge.target));
  const poem = await inspectSelection({
    origin: "poem",
    record: latestPoem,
    selection: latestPoem?.memory_selection,
    traces: archive.traces,
    sources
  });
  const dream = await inspectSelection({
    origin: "dream",
    record: latestDream,
    selection: latestDream?.memory_selection,
    traces: archive.traces,
    sources
  });
  const latestPoemSurface = latestPoem
    ? await analyzeGeneratedPoemSurface(
        { title: latestPoem.title, poem_text: latestPoem.poem_text },
        {
          mode: "poem",
          world,
          repetition,
          recentPoems: poems.filter((poem) => poem.date < latestPoem.date),
          traces: archive.traces,
          sources
        }
      )
    : null;
  const latestDreamSurface = latestDream
    ? await analyzeGeneratedDreamSurface(
        { title: latestDream.title, dream_text: latestDream.dream_text },
        {
          mode: "dream",
          world,
          repetition,
          recentPoems: poems.filter((poem) => poem.date < latestDream.date),
          traces: archive.traces,
          sources,
          sourcePoem: poems.find((poem) => poem.date === latestDream.source_date)
        }
      )
    : null;
  const result = {
    status: "read_only",
    writes_performed: false,
    latest_poem: poem,
    latest_dream: dream,
    surface_validation: {
      latest_poem: surfaceDebug(latestPoem, latestPoemSurface),
      latest_dream: surfaceDebug(latestDream, latestDreamSurface)
    },
    language_validation: {
      latest_poem: languageDebug(latestPoem, latestPoem ? analyzeGeneratedPoemLanguage(latestPoem) : null),
      latest_dream: languageDebug(latestDream, latestDream ? analyzeGeneratedDreamLanguage(latestDream) : null)
    },
    dream_return: dreamReturnState(latestDream, archive.traces),
    graph_latest_cycle_contribution: {
      dates: Array.from(latestDates).sort(),
      current_public_nodes: graph.nodes.length,
      current_edges: graph.edges.length,
      contributed_public_nodes: contributionIds.size,
      contributed_incident_edges: contributionEdges.length,
      public_nodes_without_latest_dates: graph.nodes.length - contributionIds.size,
      edges_without_latest_dates: graph.edges.length - contributionEdges.length
    },
    report_summary: {
      built_through: archive.report.built_through,
      headline: memoryClimateHeadline(archive.report),
      detail: memoryClimateDetail(archive.report),
      easily_recalled: archive.report.easily_recalled.length,
      suppressed: archive.report.suppressed.length,
      dream_returns: archive.report.dream_returns.length,
      indirect_only: archive.report.indirect_only.length,
      external_leakage: archive.report.external_leakage.length
    },
    archive_validation: {
      valid: archiveValidation.valid,
      unsafe_public_text: archiveValidation.unsafe_public_text,
      invalid_source_refs: archiveValidation.invalid_source_refs
    }
  };
  console.log(JSON.stringify(result, null, 2));
  const checks = [poem, dream].filter((item) => item.status === "memory_selection_present") as Array<{
    metadata_complete: boolean;
    unresolved_selected_trace_ids: string[];
    prompt_guard: { valid: boolean };
    recall_rebuild_reflected: boolean;
  }>;
  if (
    !archiveValidation.valid ||
    checks.some((item) => !item.metadata_complete || item.unresolved_selected_trace_ids.length > 0 || !item.prompt_guard.valid || !item.recall_rebuild_reflected)
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
