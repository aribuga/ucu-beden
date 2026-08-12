import type { VisualMemoryMapEdge, VisualMemoryMapNode } from "./types";

export type MemoryFieldRelation = "strong" | "weak" | "dream" | "mutation" | "suppressed";

export type MemoryFieldEdge = VisualMemoryMapEdge & {
  relation: MemoryFieldRelation;
  common_terms: string[];
};

export type MemoryFieldCluster = {
  id: string;
  label: string;
  x: number;
  y: number;
  node_count: number;
};

export type MemoryFieldLayout = {
  positions: Map<string, { x: number; y: number }>;
  edges: MemoryFieldEdge[];
  clusters: MemoryFieldCluster[];
  terms_by_node: Map<string, string[]>;
};

const stopWords = new Set([
  "ama", "ancak", "artık", "ben", "bile", "bir", "biri", "biz", "bu", "bütün", "çok", "daha", "değil", "diye",
  "en", "gibi", "hem", "her", "için", "ile", "kadar", "kendi", "ki", "mı", "nasıl", "ne", "olan", "olarak", "oldu",
  "olmak", "sonra", "şey", "ve", "veya", "var", "yine", "bugün", "bugünkü", "hali", "iz", "dış", "etki", "mutasyon",
  "absurdity", "aesthetic", "anger", "attention", "category", "clarity", "conceptual", "desire", "effect", "external", "fatigue",
  "hope", "influence", "items", "kind", "learning", "melancholy", "memory", "mood", "packet", "pressure", "prompt", "rhythm", "safe", "source",
  "summary", "tenderness", "terms", "trace", "vocabulary"
]);

function hashNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[^a-zçğıöşü0-9]+/giu, " ")
    .trim();
}

function termsForNode(node: VisualMemoryMapNode): string[] {
  return Array.from(new Set(normalize(`${node.label} ${node.summary} ${(node.affinity_terms ?? []).join(" ")}`)
    .split(/\s+/)
    .filter((term) => term.length >= 4 && !stopWords.has(term) && !/^\d+$/.test(term))))
    .slice(0, 24);
}

function relationForEdge(edge: VisualMemoryMapEdge, nodesById: Map<string, VisualMemoryMapNode>): MemoryFieldRelation {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (source?.suppressed || target?.suppressed) return "suppressed";
  if (edge.kind === "dream_return" || source?.dream_return || target?.dream_return) return "dream";
  if (edge.kind === "mutation" || source?.type === "mutation" || target?.type === "mutation") return "mutation";
  if (edge.kind === "external_intake" || source?.type === "external_intake" || target?.type === "external_intake") return "strong";
  if (edge.kind === "recall" || edge.kind === "source_effect" || edge.weight >= 0.68) return "strong";
  return "weak";
}

function collisionRadius(node: VisualMemoryMapNode): number {
  if (node.type === "poem") return 66;
  if (node.type === "dream") return 52;
  if (node.type === "mutation") return 30;
  if (node.type === "source_effect") return 22;
  if (node.type === "external_intake") return 28;
  return 25;
}

function semanticEdges(nodes: VisualMemoryMapNode[], termsByNode: Map<string, string[]>): MemoryFieldEdge[] {
  const termNodes = new Map<string, string[]>();
  for (const node of nodes) {
    for (const term of termsByNode.get(node.id) ?? []) termNodes.set(term, [...(termNodes.get(term) ?? []), node.id]);
  }
  const pairTerms = new Map<string, string[]>();
  for (const [term, ids] of termNodes) {
    if (ids.length < 2 || ids.length > Math.max(38, nodes.length * 0.28)) continue;
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const pair = [ids[left], ids[right]].sort();
        const key = pair.join("|");
        pairTerms.set(key, [...(pairTerms.get(key) ?? []), term]);
      }
    }
  }

  const candidates = Array.from(pairTerms.entries())
    .filter(([, terms]) => terms.length >= 2)
    .map(([key, terms]) => {
      const [source, target] = key.split("|");
      const denominator = Math.max(1, Math.min(termsByNode.get(source)?.length ?? 1, termsByNode.get(target)?.length ?? 1));
      const similarity = terms.length / denominator;
      return {
        id: `semantic:${key}`,
        source,
        target,
        kind: similarity >= 0.28 || terms.length >= 4 ? "linked" as const : "indirect" as const,
        weight: Math.min(0.92, 0.34 + similarity + terms.length * 0.04),
        relation: similarity >= 0.28 || terms.length >= 4 ? "strong" as const : "weak" as const,
        common_terms: terms.slice(0, 6)
      };
    })
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

  const degree = new Map<string, number>();
  return candidates.filter((edge) => {
    const sourceDegree = degree.get(edge.source) ?? 0;
    const targetDegree = degree.get(edge.target) ?? 0;
    if (sourceDegree >= 4 || targetDegree >= 4) return false;
    degree.set(edge.source, sourceDegree + 1);
    degree.set(edge.target, targetDegree + 1);
    return true;
  });
}

function clusterTerms(nodes: VisualMemoryMapNode[], termsByNode: Map<string, string[]>): Array<{ term: string; count: number }> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const term of termsByNode.get(node.id) ?? []) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3 && count <= Math.max(12, nodes.length * 0.12))
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || b.term.length - a.term.length || a.term.localeCompare(b.term, "tr"))
    .slice(0, 12);
}

export function buildMemoryFieldLayout(params: {
  nodes: VisualMemoryMapNode[];
  edges: VisualMemoryMapEdge[];
  width: number;
  height: number;
}): MemoryFieldLayout {
  const { nodes, width, height } = params;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const termsByNode = new Map(nodes.map((node) => [node.id, termsForNode(node)]));
  const existingEdges: MemoryFieldEdge[] = params.edges.map((edge) => ({
    ...edge,
    relation: relationForEdge(edge, nodesById),
    common_terms: []
  }));
  const existingPairs = new Set(existingEdges.map((edge) => [edge.source, edge.target].sort().join("|")));
  const inferredEdges = semanticEdges(nodes, termsByNode).filter((edge) => !existingPairs.has([edge.source, edge.target].sort().join("|")));
  const edges = [...existingEdges, ...inferredEdges];
  const rankedClusters = clusterTerms(nodes, termsByNode);
  const clusters = rankedClusters.map(({ term, count }, index) => {
    const angle = (index / Math.max(1, rankedClusters.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: `cluster:${term}`,
      label: term,
      x: width / 2 + Math.cos(angle) * width * 0.32,
      y: height / 2 + Math.sin(angle) * height * 0.31,
      node_count: count
    };
  });
  const clusterByTerm = new Map(clusters.map((cluster) => [cluster.label, cluster]));
  const primaryCluster = new Map<string, MemoryFieldCluster | null>();
  for (const node of nodes) {
    const cluster = (termsByNode.get(node.id) ?? []).map((term) => clusterByTerm.get(term)).find((item): item is MemoryFieldCluster => item !== undefined) ?? null;
    primaryCluster.set(node.id, cluster);
  }

  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  for (const node of nodes) {
    const cluster = primaryCluster.get(node.id);
    const seed = hashNumber(node.id);
    const angle = ((seed % 360) / 180) * Math.PI;
    const spread = 55 + (seed % 190);
    positions.set(node.id, {
      x: (cluster?.x ?? width / 2) + Math.cos(angle) * spread,
      y: (cluster?.y ?? height / 2) + Math.sin(angle) * spread,
      vx: 0,
      vy: 0
    });
  }

  const iterations = nodes.length > 220 ? 58 : 76;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cooling = 1 - iteration / iterations;
    for (let left = 0; left < nodes.length; left += 1) {
      const first = positions.get(nodes[left].id);
      if (!first) continue;
      for (let right = left + 1; right < nodes.length; right += 1) {
        const second = positions.get(nodes[right].id);
        if (!second) continue;
        const dx = second.x - first.x || 0.1;
        const dy = second.y - first.y || 0.1;
        const distanceSquared = Math.max(120, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const force = 3400 / distanceSquared;
        first.vx -= dx * force;
        first.vy -= dy * force;
        second.vx += dx * force;
        second.vy += dy * force;
        const minimumDistance = collisionRadius(nodes[left]) + collisionRadius(nodes[right]);
        if (distance < minimumDistance) {
          const collision = (minimumDistance - distance) * 0.075;
          first.vx -= (dx / distance) * collision;
          first.vy -= (dy / distance) * collision;
          second.vx += (dx / distance) * collision;
          second.vy += (dy / distance) * collision;
        }
      }
    }
    for (const edge of edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = edge.relation === "strong" ? 130 : edge.relation === "mutation" ? 145 : edge.relation === "dream" ? 175 : edge.relation === "suppressed" ? 240 : 215;
      const strength = (edge.relation === "strong" ? 0.018 : edge.relation === "weak" ? 0.006 : 0.012) * edge.weight;
      const force = (distance - desired) * strength;
      source.vx += (dx / distance) * force;
      source.vy += (dy / distance) * force;
      target.vx -= (dx / distance) * force;
      target.vy -= (dy / distance) * force;
    }
    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      const cluster = primaryCluster.get(node.id);
      const targetX = cluster?.x ?? width / 2;
      const targetY = cluster?.y ?? height / 2;
      point.vx += (targetX - point.x) * 0.006;
      point.vy += (targetY - point.y) * 0.006;
      point.vx += (width / 2 - point.x) * 0.0008;
      point.vy += (height / 2 - point.y) * 0.0008;
      point.x = Math.max(110, Math.min(width - 110, point.x + point.vx * cooling));
      point.y = Math.max(110, Math.min(height - 110, point.y + point.vy * cooling));
      point.vx *= 0.72;
      point.vy *= 0.72;
    }
  }

  return {
    positions: new Map(Array.from(positions.entries()).map(([id, point]) => [id, { x: point.x, y: point.y }])),
    edges,
    clusters,
    terms_by_node: termsByNode
  };
}
