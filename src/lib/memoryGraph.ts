import { filterPublicSafeMemoryTraces } from "./memoryTraceEngine";
import type {
  DailyPoem,
  DreamRecord,
  MemoryGraphData,
  MemoryGraphEdge,
  MemoryGraphEdgeKind,
  MemoryIndex,
  MemoryReport,
  MemoryTrace,
  SourceBundle
} from "./types";

function distinct<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function safeSourceRef(sourceRef: string): string | null {
  const normalized = sourceRef.replaceAll("\\", "/");
  return /^data\/[a-z0-9_/-]+\.json(?:#[a-z0-9_:-]+)?$/i.test(normalized) ? normalized : null;
}

export function isCodexExternalIntakeTrace(trace: Pick<MemoryTrace, "source" | "kind" | "source_ref">): boolean {
  return (
    trace.source === "contact_residue" &&
    trace.kind === "external_pressure" &&
    trace.source_ref.replaceAll("\\", "/").startsWith("data/external_intake/codex/json/")
  );
}

function contactResidueKind(trace: MemoryTrace): "external_intake" | "legacy" | "other" | null {
  if (trace.source !== "contact_residue") return null;
  if (isCodexExternalIntakeTrace(trace)) return "external_intake";
  if (trace.kind === "legacy_inferred" || trace.origin === "legacy_inferred") return "legacy";
  return "other";
}

function memoryLayer(trace: MemoryTrace): "core" | "daily" | "external" | "dream" | "visual" {
  if (isCodexExternalIntakeTrace(trace) || trace.source === "source") return "external";
  if (trace.source === "daily_life" || trace.source === "walk") return "daily";
  if (trace.source === "dream" || trace.kind === "dream_return") return "dream";
  if (trace.source === "visual") return "visual";
  return "core";
}

function recallModes(poems: DailyPoem[], dreams: DreamRecord[]): Map<string, Array<"poem" | "dream">> {
  const modes = new Map<string, Array<"poem" | "dream">>();
  const add = (ids: string[], mode: "poem" | "dream") => {
    for (const id of ids) modes.set(id, distinct([...(modes.get(id) ?? []), mode]));
  };
  for (const poem of poems) add(poem.memory_selection?.selected_trace_ids ?? [], "poem");
  for (const dream of dreams) add(dream.memory_selection?.selected_trace_ids ?? [], "dream");
  return modes;
}

function edgeKind(source: MemoryTrace, target: MemoryTrace, indirectIds: Set<string>): MemoryGraphEdgeKind {
  if (source.kind === "dream_return" || target.kind === "dream_return" || source.times_returned_in_dream > 0 || target.times_returned_in_dream > 0) return "dream_return";
  if (source.status === "overexposed" || target.status === "overexposed" || indirectIds.has(source.id) || indirectIds.has(target.id)) return "indirect";
  return "linked";
}

export async function buildMemoryGraphData(params: {
  traces: MemoryTrace[];
  report: MemoryReport;
  index: MemoryIndex;
  poems: DailyPoem[];
  dreams: DreamRecord[];
  sources: SourceBundle[];
}): Promise<MemoryGraphData> {
  const safeTraces = await filterPublicSafeMemoryTraces(params.traces, params.sources);
  const safeIds = new Set(safeTraces.map((trace) => trace.id));
  const byId = new Map(safeTraces.map((trace) => [trace.id, trace]));
  const modes = recallModes(params.poems, params.dreams);
  const indirectIds = new Set(params.report.indirect_only);
  const edgeKeys = new Set<string>();
  const edges: MemoryGraphEdge[] = [];
  const externalDailyEdgeCounts = new Map<string, number>();

  for (const trace of safeTraces) {
    for (const linkedId of trace.linked_traces) {
      if (!safeIds.has(linkedId)) continue;
      const target = byId.get(linkedId);
      if (!target) continue;
      if (isCodexExternalIntakeTrace(trace) && target.source === "daily_life") {
        const current = externalDailyEdgeCounts.get(trace.id) ?? 0;
        if (current >= 2) continue;
        externalDailyEdgeCounts.set(trace.id, current + 1);
      }
      const pair = [trace.id, linkedId].sort();
      const key = pair.join("|");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ id: key, source: trace.id, target: linkedId, kind: edgeKind(trace, target, indirectIds) });
    }
  }

  const byDate = new Map<string, MemoryTrace[]>();
  for (const trace of safeTraces) byDate.set(trace.date, [...(byDate.get(trace.date) ?? []), trace]);
  for (const trace of safeTraces.filter(isCodexExternalIntakeTrace)) {
    const sameDaySourceTrace = (byDate.get(trace.date) ?? []).find((candidate) => candidate.source === "source");
    if (!sameDaySourceTrace) continue;
    const pair = [trace.id, sameDaySourceTrace.id].sort();
    const key = pair.join("|");
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ id: key, source: trace.id, target: sameDaySourceTrace.id, kind: "linked" });
  }

  const graphLinksById = new Map<string, string[]>();
  for (const edge of edges) {
    graphLinksById.set(edge.source, [...(graphLinksById.get(edge.source) ?? []), edge.target]);
    graphLinksById.set(edge.target, [...(graphLinksById.get(edge.target) ?? []), edge.source]);
  }

  return {
    built_through: params.index.built_through,
    trace_count: params.index.trace_count,
    linked_trace_count: safeTraces.filter((trace) => trace.linked_traces.some((id) => safeIds.has(id))).length,
    linked_edge_count: edges.length,
    nodes: safeTraces.map((trace) => ({
      id: trace.id,
      date: trace.date,
      source: trace.source,
      kind: trace.kind,
      status: trace.status,
      transformed_text: trace.transformed_text,
      source_ref: safeSourceRef(trace.source_ref),
      recallability: trace.recallability,
      emotional_weight: trace.emotional_weight,
      decay: trace.decay,
      repression: trace.repression,
      times_recalled: trace.times_recalled,
      last_recalled_at: trace.last_recalled_at,
      times_returned_in_dream: trace.times_returned_in_dream,
      last_dream_return_at: trace.last_dream_return_at,
      linked_traces: distinct(graphLinksById.get(trace.id) ?? trace.linked_traces.filter((id) => safeIds.has(id))).filter((id) => id !== trace.id).sort(),
      recall_modes: modes.get(trace.id) ?? [],
      external_intake: isCodexExternalIntakeTrace(trace),
      contact_residue_kind: contactResidueKind(trace),
      memory_layer: memoryLayer(trace)
    })),
    edges
  };
}
