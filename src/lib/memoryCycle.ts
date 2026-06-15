import { buildMemoryGraphData } from "./memoryGraph";
import { filterPublicSafeMemoryTraces, validateMemoryPromptFragments, type MemoryArchive } from "./memoryTraceEngine";
import type { DailyPoem, DreamRecord, MemorySelection, MemoryTrace, SourceBundle } from "./types";

type SelectionRecord = {
  origin: string;
  mode: "poem" | "dream";
  date: string | null;
  generated_at: string | null;
  preview: boolean;
  selection: MemorySelection;
};

function distinct(items: string[]): string[] {
  return Array.from(new Set(items));
}

function selectionRecords(poems: DailyPoem[], dreams: DreamRecord[]): SelectionRecord[] {
  return [
    ...poems
      .filter((poem) => poem.memory_selection)
      .map((poem) => ({
        origin: `poem:${poem.date}`,
        mode: "poem" as const,
        date: poem.date,
        generated_at: poem.generated_at,
        preview: false,
        selection: poem.memory_selection as MemorySelection
      })),
    ...dreams
      .filter((dream) => dream.memory_selection)
      .map((dream) => ({
        origin: `dream:${dream.date}`,
        mode: "dream" as const,
        date: dream.date,
        generated_at: dream.generated_at,
        preview: false,
        selection: dream.memory_selection as MemorySelection
      }))
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

function normalizedTraceText(trace: MemoryTrace): string {
  return trace.transformed_text.toLocaleLowerCase("tr").replace(/\s+/gu, " ").trim();
}

function traceExistedAtSelection(trace: MemoryTrace, record: SelectionRecord): boolean {
  if (!record.date) return true;
  if (trace.date < record.date) return true;
  return record.mode === "dream" && trace.date === record.date && trace.source !== "dream";
}

function recordPrecedesSelection(candidate: SelectionRecord, target: SelectionRecord): boolean {
  if (candidate.preview || target.preview || candidate.origin === target.origin) return false;
  if (candidate.generated_at && target.generated_at) return candidate.generated_at < target.generated_at;
  if (!candidate.date || !target.date) return false;
  if (candidate.date !== target.date) return candidate.date < target.date;
  return candidate.mode === "poem" && target.mode === "dream";
}

function overexposedAtSelection(trace: MemoryTrace, record: SelectionRecord, traces: MemoryTrace[], records: SelectionRecord[]): boolean {
  if (record.preview) return trace.status === "overexposed";
  const recalledBefore = records.filter(
    (candidate) => recordPrecedesSelection(candidate, record) && candidate.selection.selected_trace_ids.includes(trace.id)
  ).length;
  const traceText = normalizedTraceText(trace);
  const repeatedAtSelection = traces.filter(
    (candidate) => traceExistedAtSelection(candidate, record) && normalizedTraceText(candidate) === traceText
  ).length;
  if (recalledBefore >= 4) return true;
  if (trace.repression >= 0.72) return false;
  return repeatedAtSelection >= 3;
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
    { origin: "preview:poem", mode: "poem", date: null, generated_at: null, preview: true, selection: params.poem_preview },
    { origin: "preview:dream", mode: "dream", date: null, generated_at: null, preview: true, selection: params.dream_preview }
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
  const currentOverexposedDirectSelections = allSelections.flatMap((record) =>
    (Array.isArray(record.selection.direct_trace_ids) ? record.selection.direct_trace_ids : [])
      .map((id) => ({ record, trace: byId.get(id) }))
      .filter((item): item is { record: SelectionRecord; trace: MemoryTrace } => item.trace?.status === "overexposed")
  );
  const overexposedDirectPrompt = currentOverexposedDirectSelections
    .filter(({ record, trace }) => overexposedAtSelection(trace, record, params.archive.traces, records))
    .map(({ record, trace }) => ({ origin: record.origin, mode: record.mode, id: trace.id }));
  const historicalOverexposedDirectPromptWarnings = currentOverexposedDirectSelections
    .filter(({ record, trace }) => !record.preview && !overexposedAtSelection(trace, record, params.archive.traces, records))
    .map(({ record, trace }) => ({
      origin: record.origin,
      mode: record.mode,
      id: trace.id,
      warning: "trace_became_overexposed_after_selection"
    }));
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
    historical_overexposed_direct_prompt_warnings: historicalOverexposedDirectPromptWarnings,
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
