"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

import { buildMemoryFieldLayout, type MemoryFieldEdge } from "../lib/memoryFieldLayout";
import type { VisualMemoryMapData, VisualMemoryMapEdge, VisualMemoryMapNode, VisualMemoryMapNodeType } from "../lib/types";

const width = 2800;
const height = 1700;
const center = { x: 1400, y: 820 };
const minZoom = 0.35;
const maxZoom = 2.8;

type PositionedNode = VisualMemoryMapNode & {
  x: number;
  y: number;
  radius: number;
};

type GraphTransform = {
  x: number;
  y: number;
  scale: number;
};

type GraphPoint = {
  x: number;
  y: number;
};

type ViewMode = "near" | "full";

type ArchiveLayoutMode = "timeline" | "field";

type FullMapFilter = "all" | VisualMemoryMapNodeType | "suppressed" | "overexposed";

type MemoryFieldRelations = {
  poems: PositionedNode[];
  dreams: PositionedNode[];
  sourceEffects: PositionedNode[];
  mutations: PositionedNode[];
  suppressed: PositionedNode[];
  commonWords: string[];
  commonImages: string[];
};

const fullMapFilters: Array<[FullMapFilter, string]> = [
  ["all", "tümü"],
  ["poem", "poem"],
  ["dream", "dream"],
  ["memory_trace", "memory trace"],
  ["source_effect", "source effect"],
  ["mutation", "mutation"],
  ["suppressed", "suppressed"],
  ["overexposed", "overexposed"]
];

const typeLabels: Record<VisualMemoryMapNodeType, string> = {
  poem: "şiir",
  dream: "rüya",
  memory_trace: "hafıza izi",
  source_effect: "içselleştirilmiş dış etki",
  mutation: "mutasyon"
};

function hashNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function shortText(value: string, limit = 170): string {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit);
  const boundary = clipped.lastIndexOf(" ");
  return `${boundary > limit * 0.65 ? clipped.slice(0, boundary) : clipped}...`;
}

function radialPosition(node: VisualMemoryMapNode, index: number, total: number, radius: number, phase: number, verticalScale: number) {
  const jitter = ((hashNumber(node.id) % 41) - 20) * 0.7;
  const angle = phase + (index / Math.max(1, total)) * Math.PI * 2 + jitter * 0.006;
  return {
    x: center.x + Math.cos(angle) * (radius + jitter),
    y: center.y + Math.sin(angle) * (radius * verticalScale + jitter * 0.5)
  };
}

function nodeRadius(node: VisualMemoryMapNode): number {
  if (node.type === "poem") return 31;
  if (node.type === "dream") return 24;
  if (node.type === "source_effect") return 6;
  if (node.type === "mutation") return 8;
  return 8 + Math.min(7, node.times_recalled * 1.1) + (node.recall_type === "direct" ? 3 : 0);
}

function fieldNodeRadius(node: VisualMemoryMapNode): number {
  if (node.type === "poem") return 43;
  if (node.type === "dream") return 31;
  if (node.type === "source_effect") return 9;
  if (node.type === "mutation") return 12;
  return 7 + Math.min(8, node.times_recalled * 1.15) + (node.recall_type === "direct" ? 3 : 0);
}

function positionNearNodes(nodes: VisualMemoryMapNode[]): PositionedNode[] {
  const groups = {
    poem: nodes.filter((node) => node.type === "poem"),
    dream: nodes.filter((node) => node.type === "dream"),
    direct: nodes.filter((node) => node.type === "memory_trace" && (node.recall_type === "direct" || node.recall_type === "dream_return")),
    indirect: nodes.filter((node) => node.type === "memory_trace" && !["direct", "dream_return"].includes(node.recall_type)),
    source: nodes.filter((node) => node.type === "source_effect"),
    mutation: nodes.filter((node) => node.type === "mutation")
  };

  return nodes.map((node) => {
    let point = center;
    if (node.type === "dream") point = { x: center.x + 250, y: center.y - 170 };
    if (node.type === "memory_trace") {
      const directIndex = groups.direct.findIndex((item) => item.id === node.id);
      const indirectIndex = groups.indirect.findIndex((item) => item.id === node.id);
      point = directIndex >= 0
        ? radialPosition(node, directIndex, groups.direct.length, 440, -0.45, 0.68)
        : radialPosition(node, indirectIndex, groups.indirect.length, 760, 0.3, 0.63);
    }
    if (node.type === "source_effect") point = radialPosition(node, groups.source.findIndex((item) => item.id === node.id), groups.source.length, 1120, 0.72, 0.56);
    if (node.type === "mutation") point = radialPosition(node, groups.mutation.findIndex((item) => item.id === node.id), groups.mutation.length, 260, 1.1, 0.78);
    return { ...node, ...point, radius: nodeRadius(node) };
  });
}

function positionFullNodes(nodes: VisualMemoryMapNode[]): PositionedNode[] {
  const dates = Array.from(new Set(nodes.map((node) => node.date))).sort();
  const sameDateTypeIndex = new Map<string, number>();
  return nodes.map((node) => {
    const dateIndex = Math.max(0, dates.indexOf(node.date));
    const xBase = dates.length <= 1 ? center.x : 250 + (dateIndex / (dates.length - 1)) * (width - 500);
    const groupKey = `${node.date}:${node.type}`;
    const groupIndex = sameDateTypeIndex.get(groupKey) ?? 0;
    sameDateTypeIndex.set(groupKey, groupIndex + 1);
    const jitter = ((hashNumber(node.id) % 53) - 26) * 1.15;
    let x = xBase + jitter;
    let y = center.y + jitter * 0.7;
    if (node.type === "poem") y = center.y - 40;
    if (node.type === "dream") y = center.y + 210;
    if (node.type === "memory_trace") {
      const column = groupIndex % 3;
      const row = Math.floor(groupIndex / 3);
      x += (column - 1) * 58;
      y = center.y - 400 + row * 98 + (column % 2) * 28 + jitter * 0.3;
    }
    if (node.type === "source_effect") {
      x += ((groupIndex % 3) - 1) * 48;
      y = 150 + Math.floor(groupIndex / 3) * 62 + jitter * 0.25;
    }
    if (node.type === "mutation") {
      x += ((groupIndex % 3) - 1) * 54;
      y = height - 220 - Math.floor(groupIndex / 3) * 68 + jitter * 0.25;
    }
    return { ...node, x, y, radius: nodeRadius(node) };
  });
}

function positionNodes(nodes: VisualMemoryMapNode[], mode: ViewMode, archiveLayout: ArchiveLayoutMode, fieldPositions: Map<string, { x: number; y: number }>): PositionedNode[] {
  if (mode === "near") return positionNearNodes(nodes);
  if (archiveLayout === "timeline") return positionFullNodes(nodes);
  return nodes.map((node) => ({ ...node, ...(fieldPositions.get(node.id) ?? center), radius: fieldNodeRadius(node) }));
}

function matchesFullFilter(node: VisualMemoryMapNode, filter: FullMapFilter): boolean {
  if (filter === "all") return true;
  if (filter === "suppressed") return node.suppressed;
  if (filter === "overexposed") return node.overexposed;
  return node.type === filter;
}

function clampZoom(value: number): number {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

function nodeBounds(nodes: PositionedNode[]) {
  const padding = 78;
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x - node.radius - padding),
      minY: Math.min(bounds.minY, node.y - node.radius - padding),
      maxX: Math.max(bounds.maxX, node.x + node.radius + padding),
      maxY: Math.max(bounds.maxY, node.y + node.radius + padding)
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
  );
}

function fitTransform(nodes: PositionedNode[]): GraphTransform {
  if (nodes.length === 0) return { x: 0, y: 0, scale: 1 };
  const bounds = nodeBounds(nodes);
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clampZoom(Math.min(width / boundsWidth, height / boundsHeight) * 0.94);
  return {
    x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    scale
  };
}

function curvePath(edge: VisualMemoryMapEdge, source: PositionedNode, target: PositionedNode): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const bend = edge.kind === "dream_return" ? 0.2 : edge.kind === "indirect" ? -0.13 : 0.08;
  const controlX = (source.x + target.x) / 2 - dy * bend;
  const controlY = (source.y + target.y) / 2 + dx * bend;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function fieldRelationsForNode(
  node: PositionedNode | null,
  nodesById: Map<string, PositionedNode>,
  edges: MemoryFieldEdge[],
  termsByNode: Map<string, string[]>
): MemoryFieldRelations | null {
  if (!node) return null;
  const touching = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const related = touching
    .map((edge) => nodesById.get(edge.source === node.id ? edge.target : edge.source))
    .filter((item): item is PositionedNode => item !== undefined);
  const distinctRelated = Array.from(new Map(related.map((item) => [item.id, item])).values());
  const selectedTerms = new Set(termsByNode.get(node.id) ?? []);
  const commonCounts = new Map<string, number>();
  for (const relatedNode of distinctRelated) {
    for (const term of termsByNode.get(relatedNode.id) ?? []) {
      if (selectedTerms.has(term)) commonCounts.set(term, (commonCounts.get(term) ?? 0) + 1);
    }
  }
  for (const edge of touching) {
    for (const term of edge.common_terms) commonCounts.set(term, (commonCounts.get(term) ?? 0) + 2);
  }
  const commonWords = Array.from(commonCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr")).slice(0, 10).map(([term]) => term);
  const imageRelatedIds = new Set(distinctRelated.filter((item) => ["poem", "dream", "mutation"].includes(item.type)).map((item) => item.id));
  const imageCounts = new Map<string, number>();
  for (const relatedNode of distinctRelated) {
    if (!imageRelatedIds.has(relatedNode.id)) continue;
    for (const term of termsByNode.get(relatedNode.id) ?? []) {
      if (selectedTerms.has(term) || commonCounts.has(term)) imageCounts.set(term, (imageCounts.get(term) ?? 0) + 1);
    }
  }
  const commonImages = Array.from(imageCounts.entries()).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 8).map(([term]) => term);
  return {
    poems: distinctRelated.filter((item) => item.type === "poem"),
    dreams: distinctRelated.filter((item) => item.type === "dream"),
    sourceEffects: distinctRelated.filter((item) => item.type === "source_effect"),
    mutations: distinctRelated.filter((item) => item.type === "mutation"),
    suppressed: distinctRelated.filter((item) => item.suppressed),
    commonWords,
    commonImages
  };
}

function NodeGlyph({ node }: { node: PositionedNode }) {
  if (node.type === "poem") {
    return (
      <>
        <circle className="memory-map-anchor-ring" cx={node.x} cy={node.y} r={node.radius + 8} />
        <circle cx={node.x} cy={node.y} r={node.radius} />
      </>
    );
  }
  if (node.type === "dream") {
    return <path d={`M ${node.x + node.radius * 0.72} ${node.y - node.radius} A ${node.radius} ${node.radius} 0 1 0 ${node.x + node.radius * 0.72} ${node.y + node.radius} A ${node.radius * 0.72} ${node.radius * 0.72} 0 0 1 ${node.x + node.radius * 0.72} ${node.y - node.radius}`} />;
  }
  if (node.type === "source_effect") return <circle cx={node.x} cy={node.y} r={node.radius} />;
  if (node.type === "mutation") {
    const points = `${node.x},${node.y - node.radius} ${node.x + node.radius},${node.y} ${node.x},${node.y + node.radius} ${node.x - node.radius},${node.y}`;
    return <polygon points={points} />;
  }
  if (node.suppressed) {
    const size = node.radius * 1.45;
    return <rect x={node.x - size / 2} y={node.y - size / 2} width={size} height={size} transform={`rotate(45 ${node.x} ${node.y})`} />;
  }
  if (node.overexposed) return <circle cx={node.x} cy={node.y} r={node.radius} className="memory-map-hot-node" />;
  return <circle cx={node.x} cy={node.y} r={node.radius} />;
}

function RelationNodeList({ nodes, onSelect }: { nodes: PositionedNode[]; onSelect: (node: PositionedNode) => void }) {
  if (nodes.length === 0) return <p>Bağlantı yok.</p>;
  return (
    <ul className="memory-field-relation-list">
      {nodes.slice(0, 6).map((node) => (
        <li key={node.id}>
          <button type="button" onClick={() => onSelect(node)}>
            <strong>{node.label}</strong>
            <span>{node.date} / {typeLabels[node.type]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetailPanel({ node, fieldRelations, onSelect }: {
  node: PositionedNode | null;
  fieldRelations: MemoryFieldRelations | null;
  onSelect: (node: PositionedNode) => void;
}) {
  if (!node) {
    return (
      <aside className="memory-map-detail">
        <span className="memory-map-kicker">yaklaş</span>
        <h2>Bir izi seç</h2>
        <p>Düğümün bugünkü şiirle, rüyayla ve hatırlama biçimiyle ilişkisi burada açılır.</p>
      </aside>
    );
  }

  return (
    <aside className="memory-map-detail">
      <span className="memory-map-kicker">{typeLabels[node.type]}</span>
      <h2>{node.label}</h2>
      <p className="memory-map-detail-summary">{node.summary}</p>
      <dl className="memory-map-detail-list">
        <div><dt>tarih</dt><dd>{node.date}</dd></div>
        <div><dt>çağırma</dt><dd>{node.recall_type === "none" ? "kayıt yok" : node.recall_type}</dd></div>
        <div><dt>durum</dt><dd>{node.status ?? typeLabels[node.type]}</dd></div>
        <div><dt>çağrılma sayısı</dt><dd>{node.times_recalled}</dd></div>
      </dl>
      <div className="memory-map-flags" aria-label="Hafıza durumu">
        {node.suppressed ? <span>bastırılmış</span> : null}
        {node.dream_return ? <span>rüyadan dönmüş</span> : null}
        {node.overexposed ? <span>fazla görünmüş</span> : null}
      </div>
      <div className="memory-map-detail-links">
        {node.related_poem_href ? <Link href={node.related_poem_href}>ilişkili şiire git</Link> : null}
        {node.related_dream_href ? <Link href={node.related_dream_href}>ilişkili rüyaya git</Link> : null}
      </div>
      {fieldRelations ? (
        <div className="memory-field-chain">
          <h3>İlişkili hafıza zinciri</h3>
          <section><h4>bağlı şiirler</h4><RelationNodeList nodes={fieldRelations.poems} onSelect={onSelect} /></section>
          <section><h4>bağlı rüyalar</h4><RelationNodeList nodes={fieldRelations.dreams} onSelect={onSelect} /></section>
          <section><h4>ortak imgeler</h4><p>{fieldRelations.commonImages.join(", ") || "kayıt yok"}</p></section>
          <section><h4>ortak kelimeler</h4><p>{fieldRelations.commonWords.join(", ") || "kayıt yok"}</p></section>
          <section><h4>source effect</h4><RelationNodeList nodes={fieldRelations.sourceEffects} onSelect={onSelect} /></section>
          <section><h4>mutation geçmişi</h4><RelationNodeList nodes={fieldRelations.mutations} onSelect={onSelect} /></section>
          <section><h4>suppressed bağlantılar</h4><RelationNodeList nodes={fieldRelations.suppressed} onSelect={onSelect} /></section>
        </div>
      ) : null}
    </aside>
  );
}

export function VisualMemoryMap({ nearData, fullData }: { nearData: VisualMemoryMapData; fullData: VisualMemoryMapData }) {
  const [viewMode, setViewMode] = useState<ViewMode>("near");
  const [archiveLayout, setArchiveLayout] = useState<ArchiveLayoutMode>("timeline");
  const [fullFilter, setFullFilter] = useState<FullMapFilter>("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<GraphTransform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointersRef = useRef(new Map<number, GraphPoint>());
  const dragRef = useRef<{ pointerId: number; point: GraphPoint; transform: GraphTransform } | null>(null);
  const pinchRef = useRef<{ distance: number; midpoint: GraphPoint; transform: GraphTransform } | null>(null);
  const movedRef = useRef(false);
  const data = viewMode === "near" ? nearData : fullData;
  const filteredDataNodes = useMemo(
    () => viewMode === "full" ? data.nodes.filter((node) => matchesFullFilter(node, fullFilter)) : data.nodes,
    [data.nodes, fullFilter, viewMode]
  );
  const fullFieldLayout = useMemo(
    () => buildMemoryFieldLayout({ nodes: fullData.nodes, edges: fullData.edges, width, height }),
    [fullData.edges, fullData.nodes]
  );
  const nodes = useMemo(
    () => positionNodes(filteredDataNodes, viewMode, archiveLayout, fullFieldLayout.positions),
    [archiveLayout, filteredDataNodes, fullFieldLayout.positions, viewMode]
  );
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selected = selectedNodeId ? byId.get(selectedNodeId) ?? null : null;
  const hovered = hoveredNodeId ? byId.get(hoveredNodeId) ?? null : null;
  const activeId = hoveredNodeId ?? selectedNodeId;
  const visibleNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const visibleEdges = useMemo(
    () => (viewMode === "full" && archiveLayout === "field" ? fullFieldLayout.edges : data.edges)
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [archiveLayout, data.edges, fullFieldLayout.edges, viewMode, visibleNodeIds]
  );
  const renderedNodes = useMemo(() => {
    const layerOrder: Record<VisualMemoryMapNodeType, number> = { memory_trace: 0, source_effect: 1, mutation: 2, dream: 3, poem: 4 };
    return [...nodes].sort((a, b) => layerOrder[a.type] - layerOrder[b.type]);
  }, [nodes]);
  const selectedFieldRelations = useMemo(
    () => viewMode === "full" && archiveLayout === "field"
      ? fieldRelationsForNode(selected, byId, visibleEdges as MemoryFieldEdge[], fullFieldLayout.terms_by_node)
      : null,
    [archiveLayout, byId, fullFieldLayout.terms_by_node, selected, viewMode, visibleEdges]
  );
  const fittedTransform = useMemo(() => fitTransform(nodes), [nodes]);
  const availableFullFilters = useMemo(
    () => fullMapFilters
      .map(([id, label]) => [id, label, fullData.nodes.filter((node) => matchesFullFilter(node, id)).length] as const)
      .filter(([id, , count]) => id === "all" || count > 0),
    [fullData.nodes]
  );

  useEffect(() => {
    setTransform(fittedTransform);
  }, [fittedTransform]);

  useEffect(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  }, [archiveLayout, fullFilter, viewMode]);

  const clientToGraphPoint = useCallback((clientX: number, clientY: number): GraphPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height
    };
  }, []);

  const zoomAt = useCallback((point: GraphPoint, nextScale: number) => {
    setTransform((current) => {
      const scale = clampZoom(nextScale);
      const worldX = (point.x - current.x) / current.scale;
      const worldY = (point.y - current.y) / current.scale;
      return { x: point.x - worldX * scale, y: point.y - worldY * scale, scale };
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    zoomAt({ x: width / 2, y: height / 2 }, transform.scale * factor);
  }, [transform.scale, zoomAt]);

  const focusNode = useCallback((node: PositionedNode) => {
    setTransform((current) => {
      const scale = Math.max(current.scale, 0.82);
      return { x: width * 0.46 - node.x * scale, y: height * 0.5 - node.y * scale, scale };
    });
  }, []);

  const selectNode = useCallback((node: PositionedNode) => {
    if (movedRef.current) return;
    setSelectedNodeId(node.id);
    focusNode(node);
  }, [focusNode]);

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = clientToGraphPoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0014);
    zoomAt(point, transform.scale * factor);
  }, [clientToGraphPoint, transform.scale, zoomAt]);

  const startPinch = useCallback(() => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) {
      pinchRef.current = null;
      return;
    }
    const [first, second] = points;
    pinchRef.current = {
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      transform
    };
  }, [transform]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".memory-map-node")) {
      movedRef.current = false;
      return;
    }
    const point = clientToGraphPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    setIsPanning(true);
    if (pointersRef.current.size === 1) dragRef.current = { pointerId: event.pointerId, point, transform };
    else startPinch();
  }, [clientToGraphPoint, startPinch, transform]);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = clientToGraphPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = Array.from(pointersRef.current.values());
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const initial = pinchRef.current;
      const scale = clampZoom(initial.transform.scale * (distance / Math.max(1, initial.distance)));
      const worldX = (initial.midpoint.x - initial.transform.x) / initial.transform.scale;
      const worldY = (initial.midpoint.y - initial.transform.y) / initial.transform.scale;
      movedRef.current = true;
      setTransform({ x: midpoint.x - worldX * scale, y: midpoint.y - worldY * scale, scale });
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = point.x - drag.point.x;
    const deltaY = point.y - drag.point.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) movedRef.current = true;
    setTransform({ x: drag.transform.x + deltaX, y: drag.transform.y + deltaY, scale: drag.transform.scale });
  }, [clientToGraphPoint]);

  const endPointer = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      pinchRef.current = null;
      setIsPanning(false);
    } else if (pointersRef.current.size === 1) {
      const [pointerId, point] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = { pointerId, point, transform };
      pinchRef.current = null;
    } else {
      startPinch();
    }
    window.setTimeout(() => {
      movedRef.current = false;
    }, 0);
  }, [startPinch, transform]);

  return (
    <section className="memory-map-experience">
      <header className="memory-map-intro">
        <div>
          <span className="memory-map-kicker">{viewMode === "near" ? "son yedi günün yakın alanı" : archiveLayout === "timeline" ? "public-safe zaman atlası" : "ilişkisel hafıza alanı"}</span>
          <h1>Visual Memory Map</h1>
          <p>{viewMode === "near"
            ? "Bugünün şiiri merkezde; rüya, hatırlamalar, dönüşler ve içselleştirilmiş dış etkiler çevresinde."
            : archiveLayout === "timeline"
              ? "Şiirler, rüyalar, hafıza izleri ve dönüşümler tarihler boyunca daha geniş bir arşiv alanına yayılıyor."
              : "Kayıtlar tarihe göre değil; ortak dil, tekrar, rüya, mutation ve source ilişkilerinin çekimiyle kümeleniyor."}</p>
        </div>
        <div className="memory-map-legend" aria-label="Harita açıklaması">
          <span><i className="is-direct" />doğrudan çağrı</span>
          <span><i className="is-indirect" />dolaylı çağrı</span>
          <span><i className="is-dream" />rüya dönüşü</span>
          <span><i className="is-source" />dış etki</span>
        </div>
      </header>
      <div className="memory-map-scope-bar">
        <div className="memory-map-view-toggle" aria-label="Harita kapsamı">
          <button type="button" className={viewMode === "near" ? "is-active" : ""} onClick={() => setViewMode("near")}>Yakın Alan</button>
          <button type="button" className={viewMode === "full" ? "is-active" : ""} onClick={() => setViewMode("full")}>Tüm Hafıza</button>
        </div>
        {viewMode === "full" ? (
          <div className="memory-map-full-controls">
            <div className="memory-map-layout-toggle" aria-label="Tüm hafıza görünümü">
              <button type="button" className={archiveLayout === "timeline" ? "is-active" : ""} onClick={() => setArchiveLayout("timeline")}>Zaman Atlası</button>
              <button type="button" className={archiveLayout === "field" ? "is-active" : ""} onClick={() => setArchiveLayout("field")}>Hafıza Alanı</button>
            </div>
            <div className="memory-map-filter-row" aria-label="Tüm hafıza filtreleri">
              {availableFullFilters.map(([id, label, count]) => (
                <button type="button" key={id} className={fullFilter === id ? "is-active" : ""} onClick={() => setFullFilter(id)}>
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span className="memory-map-scope-count">{nearData.nodes.length} yakın düğüm</span>
        )}
      </div>
      <div className="memory-map-layout">
        <div className={`memory-map-canvas mode-${viewMode}${viewMode === "full" ? ` archive-${archiveLayout}` : ""}`}>
          <div className="memory-map-controls" aria-label="Harita kontrolleri">
            <button type="button" onClick={() => zoomBy(1.22)} aria-label="Yaklaştır" title="Yaklaştır">+</button>
            <button type="button" onClick={() => zoomBy(1 / 1.22)} aria-label="Uzaklaştır" title="Uzaklaştır">−</button>
            <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>reset</button>
            <button type="button" onClick={() => setTransform(fittedTransform)}>fit</button>
            <span>{Math.round(transform.scale * 100)}%</span>
          </div>
          {hovered ? (
            <div className="memory-map-hover">
              <strong>{hovered.label}</strong>
              <span>{shortText(hovered.summary)}</span>
              <small>{hovered.date} / {typeLabels[hovered.type]} / {hovered.recall_type}</small>
            </div>
          ) : null}
          <svg
            ref={svgRef}
            className={`memory-map-svg${isPanning ? " is-panning" : ""}${transform.scale < 0.62 ? " is-zoomed-out" : ""}`}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="UCU BEDEN görsel hafıza haritası"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onClick={() => {
              if (movedRef.current) return;
              setSelectedNodeId(null);
              setHoveredNodeId(null);
            }}
          >
            <defs>
              <filter id="memory-map-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="memory-map-field">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g className="memory-map-transform-layer" transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
              <ellipse className="memory-map-field" cx={center.x} cy={center.y} rx="810" ry="440" />
              {viewMode === "full" && archiveLayout === "field" && fullFilter === "all" ? (
                <g className="memory-field-cluster-labels">
                  {fullFieldLayout.clusters.map((cluster) => (
                    <text key={cluster.id} x={cluster.x} y={cluster.y} textAnchor="middle">{cluster.label}</text>
                  ))}
                </g>
              ) : null}
              <g className="memory-map-edges">
                {visibleEdges.map((edge) => {
                  const source = byId.get(edge.source);
                  const target = byId.get(edge.target);
                  if (!source || !target) return null;
                  const focused = Boolean(activeId && (edge.source === activeId || edge.target === activeId));
                  const relation = "relation" in edge ? (edge as MemoryFieldEdge).relation : null;
                  return <path key={edge.id} className={`memory-map-edge edge-${edge.kind}${relation ? ` relation-${relation}` : ""}${focused ? " is-focused" : ""}`} d={curvePath(edge, source, target)} style={{ opacity: focused ? 1 : Math.max(0.12, edge.weight * 0.72) }} />;
                })}
              </g>
              <g className="memory-map-nodes">
                {renderedNodes.map((node) => {
                  const selectedNode = selectedNodeId === node.id;
                  const hoveredNode = hoveredNodeId === node.id;
                  return (
                    <g
                      key={node.id}
                      className={[
                        "memory-map-node",
                        `node-${node.type}`,
                        `recall-${node.recall_type}`,
                        node.suppressed ? "is-suppressed" : "",
                        node.dream_return ? "is-dream-return" : "",
                        node.overexposed ? "is-overexposed" : "",
                        selectedNode ? "is-selected" : "",
                        hoveredNode ? "is-hovered" : ""
                      ].filter(Boolean).join(" ")}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.label}, ${typeLabels[node.type]}, ${node.date}`}
                      onPointerEnter={() => setHoveredNodeId(node.id)}
                      onPointerLeave={() => setHoveredNodeId(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectNode(node);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedNodeId(node.id);
                          focusNode(node);
                        }
                      }}
                    >
                      <title>{`${node.label} / ${node.date} / ${typeLabels[node.type]} / ${shortText(node.summary, 110)}`}</title>
                      {selectedNode || hoveredNode ? (
                        <circle
                          className={`memory-map-node-halo ${selectedNode ? "is-selected-halo" : "is-hover-halo"}`}
                          cx={node.x}
                          cy={node.y}
                          r={node.radius + 10}
                        />
                      ) : null}
                      <NodeGlyph node={node} />
                      {(node.type === "poem" || node.type === "dream") ? <text x={node.x} y={node.y + node.radius + 22} textAnchor="middle">{shortText(node.label, 34)}</text> : null}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>
        <DetailPanel node={selected} fieldRelations={selectedFieldRelations} onSelect={selectNode} />
      </div>
    </section>
  );
}
