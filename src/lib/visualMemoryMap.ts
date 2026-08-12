import { validateMemoryPromptFragments } from "./memoryTraceEngine";
import type {
  DailyPoem,
  DreamRecord,
  MemoryGraphData,
  Mood,
  SourceBundle,
  VisualMemoryMapData,
  VisualMemoryMapEdge,
  VisualMemoryMapEdgeKind,
  VisualMemoryMapNode,
  VisualMemoryMapNodeType,
  VisualMemoryMapRecallType
} from "./types";

const maxTraceNodes = 34;
const moodLabels: Record<keyof Mood, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

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

function traceNodeType(trace: MemoryGraphData["nodes"][number]): VisualMemoryMapNodeType {
  if (trace.external_intake) return "external_intake";
  if (trace.source === "source") return "source_effect";
  return "memory_trace";
}

function traceNodeLabel(trace: MemoryGraphData["nodes"][number]): string {
  if (trace.external_intake) return "dış temas hafızası";
  if (trace.source === "source") return "dış etki";
  return trace.kind.replaceAll("_", " ");
}

function traceAffinity(trace: MemoryGraphData["nodes"][number]): string[] {
  return distinct(trace.transformed_text.split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 4)).slice(0, 18);
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function moodAffinity(mood: Mood): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => moodLabels[key]);
}

function poemAffinity(poem: DailyPoem): string[] {
  return distinct([
    ...poem.analysis.dominant_words,
    ...poem.analysis.recurring_words,
    ...poem.analysis.new_images,
    ...moodAffinity(poem.mood)
  ]).slice(0, 24);
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
  if (kind === "external_intake") return 0.74;
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
    (node.external_intake ? 16 : 0) +
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
        node.external_intake ||
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
      affinity_terms: poemAffinity(params.latestPoem),
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
      affinity_terms: params.latestDream.symbols,
      related_poem_href: params.latestDream.source_date ? `/poem/${params.latestDream.source_date}` : null,
      related_dream_href: `/dreams/${params.latestDream.date}`
    });
  }

  for (const trace of traceNodes) {
    const dreamReturn = trace.kind === "dream_return" || trace.times_returned_in_dream > 0;
    nodes.push({
      id: trace.id,
      type: traceNodeType(trace),
      date: trace.date,
      label: traceNodeLabel(trace),
      summary: shortText(trace.transformed_text),
      source: trace.source,
      status: trace.status,
      recall_type: traceRecallType({ id: trace.id, direct, indirect, dreamSelected, dreamSuppressed, dreamReturn }),
      times_recalled: trace.times_recalled,
      suppressed: trace.status === "suppressed",
      dream_return: dreamReturn,
      overexposed: trace.status === "overexposed",
      external_intake: trace.external_intake,
      contact_residue_kind: trace.contact_residue_kind,
      memory_layer: trace.memory_layer,
      source_ref: trace.source_ref,
      recallability: trace.recallability,
      emotional_weight: trace.emotional_weight,
      affinity_terms: traceAffinity(trace),
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
    if (node.type === "external_intake") {
      const sameDatePoem = node.date === params.latestPoem?.date ? poemId : null;
      const sameDateDream = node.date === params.latestDream?.date ? dreamId : null;
      const target = sameDatePoem ?? sameDateDream;
      if (target) addEdge(edges, edgeKeys, node.id, target, "external_intake");
    }
    if (node.type === "mutation") {
      const target = mutationAnchors.get(node.id) ?? poemId ?? dreamId;
      if (target) addEdge(edges, edgeKeys, target, node.id, "mutation");
    }
  }

  return { built_through: params.graph.built_through, window_start: windowStart, nodes, edges };
}

export async function buildFullVisualMemoryMapData(params: {
  graph: MemoryGraphData;
  poems: DailyPoem[];
  dreams: DreamRecord[];
  sources: SourceBundle[];
}): Promise<VisualMemoryMapData> {
  const direct = new Set(params.poems.flatMap((poem) => poem.memory_selection?.direct_trace_ids ?? []));
  const indirect = new Set(params.poems.flatMap((poem) => poem.memory_selection?.indirect_trace_ids ?? []));
  const dreamSelected = new Set(params.dreams.flatMap((dream) => dream.memory_selection?.selected_trace_ids ?? []));
  const dreamSuppressed = new Set(params.dreams.flatMap((dream) => dream.memory_selection?.suppressed_trace_ids ?? []));
  for (const dream of params.dreams) {
    for (const id of dream.memory_selection?.direct_trace_ids ?? []) direct.add(id);
    for (const id of dream.memory_selection?.indirect_trace_ids ?? []) indirect.add(id);
  }

  const nodes: VisualMemoryMapNode[] = [
    ...params.poems.map((poem) => ({
      id: `poem:${poem.date}`,
      type: "poem" as const,
      date: poem.date,
      label: poem.title,
      summary: shortText(poem.mood_sentence || poem.poem_text),
      source: "poem" as const,
      status: null,
      recall_type: "none" as const,
      times_recalled: 0,
      suppressed: false,
      dream_return: false,
      overexposed: false,
      affinity_terms: poemAffinity(poem),
      related_poem_href: `/poem/${poem.date}`,
      related_dream_href: null
    })),
    ...params.dreams.map((dream) => ({
      id: `dream:${dream.date}`,
      type: "dream" as const,
      date: dream.date,
      label: dream.title,
      summary: shortText(dream.mood_after || dream.dream_text),
      source: "dream" as const,
      status: null,
      recall_type: "dream_return" as const,
      times_recalled: 0,
      suppressed: false,
      dream_return: true,
      overexposed: false,
      affinity_terms: dream.symbols,
      related_poem_href: dream.source_date ? `/poem/${dream.source_date}` : null,
      related_dream_href: `/dreams/${dream.date}`
    })),
    ...params.graph.nodes.map((trace) => {
      const dreamReturn = trace.kind === "dream_return" || trace.times_returned_in_dream > 0;
      return {
        id: trace.id,
        type: traceNodeType(trace),
        date: trace.date,
        label: traceNodeLabel(trace),
        summary: shortText(trace.transformed_text),
        source: trace.source,
        status: trace.status,
        recall_type: traceRecallType({ id: trace.id, direct, indirect, dreamSelected, dreamSuppressed, dreamReturn }),
        times_recalled: trace.times_recalled,
        suppressed: trace.status === "suppressed",
        dream_return: dreamReturn,
        overexposed: trace.status === "overexposed",
        external_intake: trace.external_intake,
        contact_residue_kind: trace.contact_residue_kind,
        memory_layer: trace.memory_layer,
        source_ref: trace.source_ref,
        recallability: trace.recallability,
        emotional_weight: trace.emotional_weight,
        affinity_terms: traceAffinity(trace),
        related_poem_href: `/poem/${trace.date}`,
        related_dream_href: trace.source === "dream" || dreamReturn ? `/dreams/${trace.date}` : null
      };
    })
  ];

  const rawMutations = [
    ...params.poems.flatMap((poem) =>
      poem.analysis.image_mutations.map((mutation, index) => ({
        id: `mutation:poem:${poem.date}:${index}`,
        date: poem.date,
        summary: [mutation.from, mutation.to, mutation.reason].filter(Boolean).join(" → "),
        anchor: `poem:${poem.date}`,
        poemHref: `/poem/${poem.date}`,
        dreamHref: null
      }))
    ),
    ...params.dreams.flatMap((dream) =>
      dream.memory_mutations.map((summary, index) => ({
        id: `mutation:dream:${dream.date}:${index}`,
        date: dream.date,
        summary,
        anchor: `dream:${dream.date}`,
        poemHref: dream.source_date ? `/poem/${dream.source_date}` : null,
        dreamHref: `/dreams/${dream.date}`
      }))
    )
  ].filter((item) => item.summary.trim());
  const mutationValidation = await validateMemoryPromptFragments(rawMutations.map((item) => item.summary), params.sources);
  const safeMutationSet = new Set(mutationValidation.safe_fragments);
  const mutationAnchors = new Map<string, string>();

  for (const mutation of rawMutations.filter((item) => safeMutationSet.has(item.summary))) {
    mutationAnchors.set(mutation.id, mutation.anchor);
    nodes.push({
      id: mutation.id,
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
      related_poem_href: mutation.poemHref,
      related_dream_href: mutation.dreamHref
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const traceIds = new Set(params.graph.nodes.map((node) => node.id));
  const edges: VisualMemoryMapEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const poem of params.poems) {
    const anchor = `poem:${poem.date}`;
    for (const id of poem.memory_selection?.direct_trace_ids ?? []) if (traceIds.has(id)) addEdge(edges, edgeKeys, anchor, id, "recall");
    for (const id of poem.memory_selection?.indirect_trace_ids ?? []) if (traceIds.has(id)) addEdge(edges, edgeKeys, anchor, id, "indirect");
  }
  for (const dream of params.dreams) {
    const anchor = `dream:${dream.date}`;
    const sourcePoem = `poem:${dream.source_date}`;
    if (nodeIds.has(sourcePoem)) addEdge(edges, edgeKeys, sourcePoem, anchor, "dream_return");
    const suppressed = new Set(dream.memory_selection?.suppressed_trace_ids ?? []);
    const dreamIndirect = new Set(dream.memory_selection?.indirect_trace_ids ?? []);
    for (const id of dream.memory_selection?.selected_trace_ids ?? []) {
      if (!traceIds.has(id)) continue;
      addEdge(edges, edgeKeys, anchor, id, suppressed.has(id) ? "dream_return" : dreamIndirect.has(id) ? "indirect" : "recall");
    }
  }
  for (const edge of params.graph.edges) {
    if (!traceIds.has(edge.source) || !traceIds.has(edge.target)) continue;
    addEdge(edges, edgeKeys, edge.source, edge.target, edge.kind === "dream_return" ? "dream_return" : edge.kind === "indirect" ? "indirect" : "linked");
  }
  for (const node of nodes) {
    if (node.type === "source_effect") {
      const sameDatePoem = `poem:${node.date}`;
      const sameDateDream = `dream:${node.date}`;
      const target = nodeIds.has(sameDatePoem) ? sameDatePoem : nodeIds.has(sameDateDream) ? sameDateDream : null;
      if (target) addEdge(edges, edgeKeys, node.id, target, "source_effect");
    }
    if (node.type === "external_intake") {
      const sameDatePoem = `poem:${node.date}`;
      const sameDateDream = `dream:${node.date}`;
      const target = nodeIds.has(sameDatePoem) ? sameDatePoem : nodeIds.has(sameDateDream) ? sameDateDream : null;
      if (target) addEdge(edges, edgeKeys, node.id, target, "external_intake");
    }
    if (node.type === "mutation") {
      const target = mutationAnchors.get(node.id);
      if (target && nodeIds.has(target)) addEdge(edges, edgeKeys, target, node.id, "mutation");
    }
  }

  return { built_through: params.graph.built_through, window_start: null, nodes, edges };
}
