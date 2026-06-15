import { validateMemoryPromptFragments } from "./memoryTraceEngine";
import type {
  DailyPoem,
  DreamRecord,
  MemoryGraphData,
  SourceBundle,
  VisualMemoryMapData,
  VisualMemoryMapEdge,
  VisualMemoryMapEdgeKind,
  VisualMemoryMapNode,
  VisualMemoryMapRecallType
} from "./types";

const maxTraceNodes = 34;

function distinct<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function shortText(value: string, limit = 190): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  const clipped = compact.slice(0, limit);
  const boundary = clipped.lastIndexOf(" ");
  return `${boundary > limit * 0.65 ? clipped.slice(0, boundary) : clipped}...`;
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function traceRecallType(params: {
  id: string;
  direct: Set<string>;
  indirect: Set<string>;
  dreamSelected: Set<string>;
  dreamSuppressed: Set<string>;
  dreamReturn: boolean;
}): VisualMemoryMapRecallType {
  if (params.dreamReturn || (params.dreamSelected.has(params.id) && params.dreamSuppressed.has(params.id))) return "dream_return";
  if (params.indirect.has(params.id)) return "indirect";
  if (params.direct.has(params.id)) return "direct";
  return "none";
}

function edgeWeight(kind: VisualMemoryMapEdgeKind): number {
  if (kind === "dream_return" || kind === "recall") return 1;
  if (kind === "mutation") return 0.86;
  if (kind === "source_effect") return 0.68;
  if (kind === "indirect") return 0.52;
  return 0.42;
}

function addEdge(edges: VisualMemoryMapEdge[], seen: Set<string>, source: string, target: string, kind: VisualMemoryMapEdgeKind) {
  const key = `${source}|${target}|${kind}`;
  if (seen.has(key) || source === target) return;
  seen.add(key);
  edges.push({ id: key, source, target, kind, weight: edgeWeight(kind) });
}

function traceScore(node: MemoryGraphData["nodes"][number], selected: Set<string>, windowStart: string): number {
  return (
    (selected.has(node.id) ? 80 : 0) +
    (node.date >= windowStart ? 22 : 0) +
    node.times_recalled * 5 +
    node.times_returned_in_dream * 9 +
    node.linked_traces.length * 2 +
    (node.kind === "dream_return" ? 18 : 0) +
    (["suppressed", "overexposed", "unstable"].includes(node.status) ? 12 : 0) +
    node.emotional_weight * 8
  );
}

export async function buildVisualMemoryMapData(params: {
  graph: MemoryGraphData;
  latestPoem: DailyPoem | null;
  latestDream: DreamRecord | null;
  sources: SourceBundle[];
}): Promise<VisualMemoryMapData> {
  const anchorDate = params.latestPoem?.date ?? params.latestDream?.date ?? params.graph.built_through;
  if (!anchorDate) return { built_through: params.graph.built_through, window_start: null, nodes: [], edges: [] };

  const windowStart = subtractDays(anchorDate, 6);
  const poemId = params.latestPoem ? `poem:${params.latestPoem.date}` : null;
  const dreamId = params.latestDream ? `dream:${params.latestDream.date}` : null;
  const poemSelection = params.latestPoem?.memory_selection;
  const dreamSelection = params.latestDream?.memory_selection;
  const direct = new Set([...(poemSelection?.direct_trace_ids ?? []), ...(dreamSelection?.direct_trace_ids ?? [])]);
  const indirect = new Set([...(poemSelection?.indirect_trace_ids ?? []), ...(dreamSelection?.indirect_trace_ids ?? [])]);
  const dreamSelected = new Set(dreamSelection?.selected_trace_ids ?? []);
  const dreamSuppressed = new Set(dreamSelection?.suppressed_trace_ids ?? []);
  const selected = new Set([...(poemSelection?.selected_trace_ids ?? []), ...(dreamSelection?.selected_trace_ids ?? [])]);
  const graphById = new Map(params.graph.nodes.map((node) => [node.id, node]));
  const linkedToSelected = distinct(Array.from(selected).flatMap((id) => graphById.get(id)?.linked_traces ?? []));
  const candidateIds = new Set([...selected, ...linkedToSelected]);

  for (const node of params.graph.nodes) {
    const significantRecent =
      node.date >= windowStart &&
      (node.times_recalled > 0 ||
        node.times_returned_in_dream > 0 ||
        node.kind === "dream_return" ||
        ["suppressed", "overexposed", "unstable"].includes(node.status));
    if (significantRecent) candidateIds.add(node.id);
  }

  const traceNodes = Array.from(candidateIds)
    .map((id) => graphById.get(id))
    .filter((node): node is MemoryGraphData["nodes"][number] => node !== undefined)
    .sort((a, b) => traceScore(b, selected, windowStart) - traceScore(a, selected, windowStart) || b.date.localeCompare(a.date))
    .slice(0, maxTraceNodes);
  const includedTraceIds = new Set(traceNodes.map((node) => node.id));
  const nodes: VisualMemoryMapNode[] = [];

  if (params.latestPoem && poemId) {
    nodes.push({
      id: poemId,
      type: "poem",
      date: params.latestPoem.date,
      label: params.latestPoem.title,
      summary: shortText(params.latestPoem.mood_sentence || params.latestPoem.poem_text),
      source: "poem",
      status: null,
      recall_type: "none",
      times_recalled: 0,
      suppressed: false,
      dream_return: false,
      overexposed: false,
      related_poem_href: `/poem/${params.latestPoem.date}`,
      related_dream_href: null
    });
  }

  if (params.latestDream && dreamId) {
    nodes.push({
      id: dreamId,
      type: "dream",
      date: params.latestDream.date,
      label: params.latestDream.title,
      summary: shortText(params.latestDream.mood_after || params.latestDream.dream_text),
      source: "dream",
      status: null,
      recall_type: "dream_return",
      times_recalled: 0,
      suppressed: false,
      dream_return: true,
      overexposed: false,
      related_poem_href: params.latestDream.source_date ? `/poem/${params.latestDream.source_date}` : null,
      related_dream_href: `/dreams/${params.latestDream.date}`
    });
  }

  for (const trace of traceNodes) {
    const dreamReturn = trace.kind === "dream_return" || trace.times_returned_in_dream > 0;
    nodes.push({
      id: trace.id,
      type: trace.source === "source" ? "source_effect" : "memory_trace",
      date: trace.date,
      label: trace.source === "source" ? "dış etki" : trace.kind.replaceAll("_", " "),
      summary: shortText(trace.transformed_text),
      source: trace.source,
      status: trace.status,
      recall_type: traceRecallType({ id: trace.id, direct, indirect, dreamSelected, dreamSuppressed, dreamReturn }),
      times_recalled: trace.times_recalled,
      suppressed: trace.status === "suppressed",
      dream_return: dreamReturn,
      overexposed: trace.status === "overexposed",
      related_poem_href: `/poem/${trace.date}`,
      related_dream_href: trace.source === "dream" || dreamReturn ? `/dreams/${trace.date}` : null
    });
  }

  const rawMutations = [
    ...(params.latestPoem?.analysis.image_mutations ?? []).map((mutation) => ({
      date: params.latestPoem?.date ?? anchorDate,
      summary: [mutation.from, mutation.to, mutation.reason].filter(Boolean).join(" → "),
      anchor: poemId
    })),
    ...(params.latestDream?.memory_mutations ?? []).map((summary) => ({
      date: params.latestDream?.date ?? anchorDate,
      summary,
      anchor: dreamId
    }))
  ].filter((item) => item.anchor && item.summary.trim());
  const mutationValidation = await validateMemoryPromptFragments(rawMutations.map((item) => item.summary), params.sources);
  const safeMutationSet = new Set(mutationValidation.safe_fragments);
  const mutationAnchors = new Map<string, string>();

  rawMutations.filter((item) => safeMutationSet.has(item.summary)).slice(0, 6).forEach((mutation, index) => {
    const id = `mutation:${mutation.date}:${index}`;
    if (mutation.anchor) mutationAnchors.set(id, mutation.anchor);
    nodes.push({
      id,
      type: "mutation",
      date: mutation.date,
      label: "mutasyon",
      summary: shortText(mutation.summary),
      source: null,
      status: "unstable",
      recall_type: "none",
      times_recalled: 0,
      suppressed: false,
      dream_return: false,
      overexposed: false,
      related_poem_href: poemId ? `/poem/${params.latestPoem?.date}` : null,
      related_dream_href: dreamId ? `/dreams/${params.latestDream?.date}` : null
    });
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: VisualMemoryMapEdge[] = [];
  const edgeKeys = new Set<string>();

  if (poemId && dreamId && nodeIds.has(poemId) && nodeIds.has(dreamId)) addEdge(edges, edgeKeys, poemId, dreamId, "dream_return");
  for (const id of poemSelection?.direct_trace_ids ?? []) if (poemId && includedTraceIds.has(id)) addEdge(edges, edgeKeys, poemId, id, "recall");
  for (const id of poemSelection?.indirect_trace_ids ?? []) if (poemId && includedTraceIds.has(id)) addEdge(edges, edgeKeys, poemId, id, "indirect");
  for (const id of dreamSelection?.selected_trace_ids ?? []) {
    if (!dreamId || !includedTraceIds.has(id)) continue;
    addEdge(edges, edgeKeys, dreamId, id, dreamSuppressed.has(id) ? "dream_return" : indirect.has(id) ? "indirect" : "recall");
  }

  for (const edge of params.graph.edges) {
    if (!includedTraceIds.has(edge.source) || !includedTraceIds.has(edge.target)) continue;
    addEdge(edges, edgeKeys, edge.source, edge.target, edge.kind === "dream_return" ? "dream_return" : edge.kind === "indirect" ? "indirect" : "linked");
  }

  for (const node of nodes) {
    if (node.type === "source_effect") {
      const target = poemId ?? dreamId;
      if (target) addEdge(edges, edgeKeys, node.id, target, "source_effect");
    }
    if (node.type === "mutation") {
      const target = mutationAnchors.get(node.id) ?? poemId ?? dreamId;
      if (target) addEdge(edges, edgeKeys, target, node.id, "mutation");
    }
  }

  return { built_through: params.graph.built_through, window_start: windowStart, nodes, edges };
}
