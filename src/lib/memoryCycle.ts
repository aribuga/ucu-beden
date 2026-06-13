import { buildMemoryGraphData } from "./memoryGraph";
import { filterPublicSafeMemoryTraces, validateMemoryPromptFragments, type MemoryArchive } from "./memoryTraceEngine";
import type { DailyPoem, DreamRecord, MemorySelection, SourceBundle } from "./types";

type SelectionRecord = {
  origin: string;
  mode: "poem" | "dream";
  selection: MemorySelection;
};

function distinct(items: string[]): string[] {
  return Array.from(new Set(items));
}

function selectionRecords(poems: DailyPoem[], dreams: DreamRecord[]): SelectionRecord[] {
  return [
    ...poems
      .filter((poem) => poem.memory_selection)
      .map((poem) => ({ origin: `poem:${poem.date}`, mode: "poem" as const, selection: poem.memory_selection as MemorySelection })),
    ...dreams
      .filter((dream) => dream.memory_selection)
      .map((dream) => ({ origin: `dream:${dream.date}`, mode: "dream" as const, selection: dream.memory_selection as MemorySelection }))
  ];
}

function selectionArrays(selection: MemorySelection): Array<[string, string[] | undefined]> {
  return [
    ["selected_trace_ids", selection.selected_trace_ids],
    ["direct_trace_ids", selection.direct_trace_ids],
    ["indirect_trace_ids", selection.indirect_trace_ids],
    ["suppressed_trace_ids", selection.suppressed_trace_ids],
    ["memory_prompt_fragments", selection.memory_prompt_fragments]
  ];
}

export async function validateMemoryCycleIntegrity(params: {
  archive: MemoryArchive;
  poems: DailyPoem[];
  dreams: DreamRecord[];
  sources: SourceBundle[];
  poem_preview: MemorySelection;
  dream_preview: MemorySelection;
}) {
  const byId = new Map(params.archive.traces.map((trace) => [trace.id, trace]));
  const records = selectionRecords(params.poems, params.dreams);
  const previews: SelectionRecord[] = [
    { origin: "preview:poem", mode: "poem", selection: params.poem_preview },
    { origin: "preview:dream", mode: "dream", selection: params.dream_preview }
  ];
  const allSelections = [...records, ...previews];
  const incompleteSelectionMetadata = records
    .filter(({ selection }) => selectionArrays(selection).some(([, value]) => !Array.isArray(value)))
    .map(({ origin }) => origin);
  const unresolvedSelectedTraceIds = allSelections.flatMap(({ origin, selection }) =>
    (Array.isArray(selection.selected_trace_ids) ? selection.selected_trace_ids : [])
      .filter((id) => !byId.has(id))
      .map((id) => ({ origin, id }))
  );
  const invalidSelectionTraceIds = allSelections.flatMap(({ origin, selection }) =>
    selectionArrays(selection)
      .filter(([key]) => key !== "memory_prompt_fragments")
      .flatMap(([field, ids]) => (Array.isArray(ids) ? ids : []).filter((id) => !byId.has(id)).map((id) => ({ origin, field, id })))
  );
  const promptChecks = await Promise.all(
    allSelections.map(async ({ origin, mode, selection }) => ({
      origin,
      mode,
      result: await validateMemoryPromptFragments(Array.isArray(selection.memory_prompt_fragments) ? selection.memory_prompt_fragments : [], params.sources)
    }))
  );
  const unsafePromptFragments = promptChecks.flatMap(({ origin, mode, result }) =>
    result.unsafe_fragments.map(({ matches }) => ({ origin, mode, matches }))
  );
  const invalidLinkedTraceIds = params.archive.traces.flatMap((trace) =>
    trace.linked_traces.filter((id) => !byId.has(id)).map((id) => ({ trace_id: trace.id, linked_id: id }))
  );
  const invalidDreamReturnLinks = params.archive.traces
    .filter((trace) => trace.kind === "dream_return" || trace.times_returned_in_dream > 0)
    .flatMap((trace) => trace.linked_traces.filter((id) => !byId.has(id)).map((id) => ({ trace_id: trace.id, linked_id: id })));
  const overexposedDirectPrompt = allSelections.flatMap(({ origin, mode, selection }) =>
    (Array.isArray(selection.direct_trace_ids) ? selection.direct_trace_ids : [])
      .filter((id) => byId.get(id)?.status === "overexposed")
      .map((id) => ({ origin, mode, id }))
  );
  const publicSafeTraces = await filterPublicSafeMemoryTraces(params.archive.traces, params.sources);
  const graph = await buildMemoryGraphData({
    traces: params.archive.traces,
    report: params.archive.report,
    index: params.archive.index,
    poems: params.poems,
    dreams: params.dreams,
    sources: params.sources
  });
  const graphPublicNodeCountMatches = graph.nodes.length === publicSafeTraces.length;
  const suppressedAvailable = params.archive.index.by_status.suppressed.length;
  const poemSuppressed = params.poem_preview.suppressed_trace_ids.length;
  const dreamSuppressed = params.dream_preview.suppressed_trace_ids.length;
  const dreamSuppressedPreference = suppressedAvailable === 0 || dreamSuppressed > poemSuppressed;
  const previewMetadataComplete = previews.every(({ selection }) => selectionArrays(selection).every(([, value]) => Array.isArray(value)));

  return {
    valid:
      incompleteSelectionMetadata.length === 0 &&
      unresolvedSelectedTraceIds.length === 0 &&
      invalidSelectionTraceIds.length === 0 &&
      unsafePromptFragments.length === 0 &&
      invalidLinkedTraceIds.length === 0 &&
      invalidDreamReturnLinks.length === 0 &&
      overexposedDirectPrompt.length === 0 &&
      graphPublicNodeCountMatches &&
      dreamSuppressedPreference &&
      previewMetadataComplete,
    metadata_records: {
      poem_with_selection: params.poems.filter((poem) => poem.memory_selection).length,
      dream_with_selection: params.dreams.filter((dream) => dream.memory_selection).length,
      legacy_without_selection: params.poems.filter((poem) => !poem.memory_selection).length + params.dreams.filter((dream) => !dream.memory_selection).length
    },
    incomplete_selection_metadata: incompleteSelectionMetadata,
    unresolved_selected_trace_ids: unresolvedSelectedTraceIds,
    invalid_selection_trace_ids: invalidSelectionTraceIds,
    unsafe_prompt_fragments: unsafePromptFragments,
    invalid_linked_trace_ids: invalidLinkedTraceIds,
    invalid_dream_return_links: invalidDreamReturnLinks,
    overexposed_direct_prompt: overexposedDirectPrompt,
    public_safe_trace_count: publicSafeTraces.length,
    graph_public_node_count: graph.nodes.length,
    graph_public_node_count_matches_public_safe_trace_count: graphPublicNodeCountMatches,
    preview_metadata_complete: previewMetadataComplete,
    dream_suppressed_preference: {
      valid: dreamSuppressedPreference,
      suppressed_available: suppressedAvailable,
      poem_selected: poemSuppressed,
      dream_selected: dreamSuppressed
    },
    selected_trace_ids_checked: distinct(allSelections.flatMap(({ selection }) => selection.selected_trace_ids ?? [])).length
  };
}
