"use client";

import { useEffect, useMemo, useState } from "react";

import type { MemoryGraphData, MemoryGraphNode, MemoryTraceSource, MemoryTraceStatus } from "../lib/types";

const width = 1000;
const height = 680;
const sourceOrder: MemoryTraceSource[] = ["poem", "dream", "daily_life", "source", "walk", "visual", "contact_residue"];
const sourceColors: Record<MemoryTraceSource, string> = {
  poem: "#d45a3a",
  dream: "#7253b6",
  daily_life: "#3f7f67",
  source: "#347ca8",
  walk: "#b18a32",
  visual: "#a84f82",
  contact_residue: "#66645f"
};

type FilterId =
  | "focus"
  | "all"
  | MemoryTraceStatus
  | "dream_return"
  | "external"
  | MemoryTraceSource;

type PositionedNode = MemoryGraphNode & {
  x: number;
  y: number;
  radius: number;
  opacity: number;
};

const filterLabels: Array<[FilterId, string]> = [
  ["focus", "odak"],
  ["all", "tümü"],
  ["active", "active"],
  ["suppressed", "suppressed"],
  ["overexposed", "overexposed"],
  ["dream_return", "dream return"],
  ["external", "external / internalized"],
  ["poem", "poem"],
  ["dream", "dream"],
  ["daily_life", "daily life"],
  ["source", "source"],
  ["walk", "walk"],
  ["visual", "visual"]
];

function hashNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function shortText(value: string, limit = 180): string {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit);
  const boundary = clipped.lastIndexOf(" ");
  return `${boundary > limit * 0.65 ? clipped.slice(0, boundary) : clipped}...`;
}

function focusNode(node: MemoryGraphNode): boolean {
  return (
    node.times_recalled > 0 ||
    node.times_returned_in_dream > 0 ||
    node.kind === "dream_return" ||
    ["suppressed", "overexposed", "unstable"].includes(node.status)
  );
}

function matchesFilter(node: MemoryGraphNode, filter: FilterId): boolean {
  if (filter === "focus") return focusNode(node);
  if (filter === "all") return true;
  if (filter === "dream_return") return node.kind === "dream_return" || node.times_returned_in_dream > 0;
  if (filter === "external") return node.source === "source";
  if (["active", "dim", "suppressed", "fossilized", "overexposed", "unstable"].includes(filter)) return node.status === filter;
  return node.source === filter;
}

function initialFilter(data: MemoryGraphData): FilterId {
  return data.nodes.length > 45 && data.nodes.some(focusNode) ? "focus" : "all";
}

function positions(data: MemoryGraphData): PositionedNode[] {
  const dates = Array.from(new Set(data.nodes.map((node) => node.date))).sort();
  const activeSources = sourceOrder.filter((source) => data.nodes.some((node) => node.source === source));
  return data.nodes.map((node) => {
    const dateIndex = Math.max(0, dates.indexOf(node.date));
    const sourceIndex = Math.max(0, activeSources.indexOf(node.source));
    const jitter = (hashNumber(node.id) % 29) - 14;
    const x = dates.length <= 1 ? width / 2 : 75 + (dateIndex / (dates.length - 1)) * (width - 150) + jitter;
    const laneY = activeSources.length <= 1 ? height / 2 : 80 + (sourceIndex / (activeSources.length - 1)) * (height - 180);
    const y = node.status === "overexposed" ? height - 48 + jitter * 0.25 : laneY + jitter;
    const radius = 5 + node.recallability * 4 + node.emotional_weight * 4 + Math.min(4, node.times_recalled * 0.8);
    const baseOpacity = 0.28 + (1 - node.decay) * 0.36 + (1 - node.repression) * 0.28;
    const opacity = Math.max(0.18, Math.min(0.96, node.status === "suppressed" ? baseOpacity * 0.55 : baseOpacity));
    return { ...node, x, y, radius, opacity };
  });
}

function NodeShape({ node, contextOnly }: { node: PositionedNode; contextOnly: boolean }) {
  const fill = sourceColors[node.source];
  const opacity = contextOnly ? 0.17 : node.opacity;
  const common = {
    fill,
    fillOpacity: opacity,
    stroke: "currentColor",
    strokeWidth: node.kind === "dream_return" ? 2.4 : 1.4,
    strokeDasharray: node.status === "overexposed" ? "2 3" : node.status === "suppressed" ? "5 3" : undefined
  };
  if (node.status === "suppressed") {
    const size = node.radius * 1.3;
    return <rect {...common} x={node.x - size / 2} y={node.y - size / 2} width={size} height={size} transform={`rotate(45 ${node.x} ${node.y})`} />;
  }
  if (node.status === "overexposed") {
    return <rect {...common} x={node.x - node.radius} y={node.y - node.radius} width={node.radius * 2} height={node.radius * 2} />;
  }
  if (node.status === "unstable") {
    const points = `${node.x},${node.y - node.radius} ${node.x - node.radius},${node.y + node.radius} ${node.x + node.radius},${node.y + node.radius}`;
    return <polygon {...common} points={points} />;
  }
  return <circle {...common} cx={node.x} cy={node.y} r={node.radius} />;
}

function TraceDetail({
  node,
  nodes,
  onSelect
}: {
  node: MemoryGraphNode | null;
  nodes: Map<string, MemoryGraphNode>;
  onSelect: (id: string) => void;
}) {
  if (!node) {
    return (
      <aside className="mutation-detail">
        <h2>Trace detayı</h2>
        <p>Metnini ve bağlantılarını okumak için graph içinden bir iz seç.</p>
      </aside>
    );
  }
  const linked = node.linked_traces.map((id) => nodes.get(id)).filter((item): item is MemoryGraphNode => item !== undefined);
  return (
    <aside className="mutation-detail">
      <div className="mutation-detail-heading">
        <h2>Seçili trace</h2>
        <span className={`mutation-status status-${node.status}`}>{node.status}</span>
      </div>
      <p className="mutation-detail-text">{node.transformed_text}</p>
      <div className="mutation-detail-tags">
        <span>{node.date}</span>
        <span>{node.source}</span>
        <span>{node.kind}</span>
      </div>
      <section className="mutation-detail-block">
        <h3>Hatırlanma</h3>
        <p>{node.times_recalled} çağrı; son çağrı: {node.last_recalled_at ?? "kayıt yok"}.</p>
        <p>{node.times_returned_in_dream} rüya dönüşü; son dönüş: {node.last_dream_return_at ?? "kayıt yok"}.</p>
        <p>Mode: {node.recall_modes.join(", ") || "kayıt yok"}.</p>
      </section>
      <section className="mutation-detail-block">
        <h3>Bağlı izler</h3>
        {linked.length === 0 ? <p>Bağlantı yok.</p> : (
          <ul className="mutation-linked-list">
            {linked.slice(0, 5).map((trace) => (
              <li key={trace.id}>
                <button type="button" onClick={() => onSelect(trace.id)}>
                  <strong>{shortText(trace.transformed_text, 120)}</strong>
                  <span>{trace.source} / {trace.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {linked.length > 5 ? (
          <details className="mutation-linked-more">
            <summary>{linked.length - 5} bağlantı daha</summary>
            <ul className="mutation-linked-list">
              {linked.slice(5).map((trace) => (
                <li key={trace.id}>
                  <button type="button" onClick={() => onSelect(trace.id)}>
                    <strong>{shortText(trace.transformed_text, 120)}</strong>
                    <span>{trace.source} / {trace.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      <details className="mutation-technical">
        <summary>teknik kayıt</summary>
        <dl className="state-list">
          <div><dt>id</dt><dd>{node.id}</dd></div>
          <div><dt>source ref</dt><dd>{node.source_ref ?? "gizli veya geçersiz"}</dd></div>
        </dl>
      </details>
    </aside>
  );
}

export function MemoryMutationGraph({ data }: { data: MemoryGraphData }) {
  const [filter, setFilter] = useState<FilterId>(() => initialFilter(data));
  const [showAllEdges, setShowAllEdges] = useState(data.edges.length <= 70);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [hoveredTraceId, setHoveredTraceId] = useState<string | null>(null);
  const graphNodes = useMemo(() => positions(data), [data]);
  const nodesById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const positionedById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const primaryIds = useMemo(() => new Set(data.nodes.filter((node) => matchesFilter(node, filter)).map((node) => node.id)), [data.nodes, filter]);
  const activeNodeId = hoveredTraceId ?? selectedTraceId;
  const visibleEdges = useMemo(
    () =>
      data.edges.filter((edge) => {
        const touchesPrimary = primaryIds.has(edge.source) || primaryIds.has(edge.target);
        if (filter !== "all" && !touchesPrimary) return false;
        if (showAllEdges) return true;
        if (edge.kind !== "linked") return true;
        if (activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId)) return true;
        return filter !== "all" && primaryIds.size <= 24 && primaryIds.has(edge.source) && primaryIds.has(edge.target);
      }),
    [activeNodeId, data.edges, filter, primaryIds, showAllEdges]
  );
  const visibleIds = useMemo(() => {
    if (filter === "all") return new Set(data.nodes.map((node) => node.id));
    const ids = new Set(primaryIds);
    for (const edge of visibleEdges) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
    return ids;
  }, [data.nodes, filter, primaryIds, visibleEdges]);
  const availableFilters = filterLabels
    .map(([id, label]) => [id, label, data.nodes.filter((node) => matchesFilter(node, id)).length] as const)
    .filter(([id, , count]) => id === "all" || count > 0);
  const hovered = hoveredTraceId ? nodesById.get(hoveredTraceId) ?? null : null;
  const selected = selectedTraceId ? nodesById.get(selectedTraceId) ?? null : null;

  useEffect(() => {
    setSelectedTraceId(null);
    setHoveredTraceId(null);
  }, [filter]);

  return (
    <section className="mutation-layout">
      <div className="mutation-controls">
        <div>
          <h1>Hafıza Mutasyonları</h1>
          <p>{visibleIds.size} / {data.nodes.length} public-safe trace; {visibleEdges.length} / {data.linked_edge_count} bağlantı görünür.</p>
        </div>
        <div className="mutation-filter-area">
          <div className="mutation-filters" aria-label="Trace filtreleri">
            {availableFilters.map(([id, label, count]) => (
              <button type="button" key={id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <button className="mutation-edge-toggle" type="button" onClick={() => setShowAllEdges((value) => !value)}>
            {showAllEdges ? "düşük ağırlıklı bağlantıları gizle" : "tüm bağlantıları göster"}
          </button>
        </div>
        <div className="mutation-legend">
          {sourceOrder.filter((source) => data.nodes.some((node) => node.source === source)).map((source) => (
            <span key={source}><i style={{ background: sourceColors[source] }} />{source}</span>
          ))}
        </div>
      </div>

      <div className="mutation-main">
        <div className="mutation-graph-wrap">
          {hovered ? (
            <div className="mutation-hover">
              <strong>{shortText(hovered.transformed_text)}</strong>
              <span>{hovered.date} / {hovered.source} / {hovered.kind} / {hovered.status}</span>
            </div>
          ) : null}
          <svg className="mutation-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hafıza trace bağlantı grafiği">
            <rect
              className="mutation-graph-background"
              x="0"
              y="0"
              width={width}
              height={height}
              onClick={() => {
                setSelectedTraceId(null);
                setHoveredTraceId(null);
              }}
            />
            <g className="mutation-edges">
              {visibleEdges.map((edge) => {
                const source = positionedById.get(edge.source);
                const target = positionedById.get(edge.target);
                if (!source || !target) return null;
                const isFocused = Boolean(activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId));
                return <line key={edge.id} className={`mutation-edge edge-${edge.kind}${isFocused ? " is-focused" : ""}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
              })}
            </g>
            <g className="mutation-nodes">
              {graphNodes.map((node) => {
                if (!visibleIds.has(node.id)) return null;
                const contextOnly = filter !== "all" && !primaryIds.has(node.id);
                const isSelected = selectedTraceId === node.id;
                const isHovered = hoveredTraceId === node.id;
                return (
                  <g
                    key={node.id}
                    className={`mutation-node status-${node.status}${isSelected ? " is-selected" : ""}${isHovered ? " is-hovered" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.date} ${node.source} ${node.kind} ${node.status}`}
                    onMouseEnter={() => setHoveredTraceId(node.id)}
                    onMouseLeave={() => setHoveredTraceId(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedTraceId(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTraceId(node.id);
                      }
                    }}
                  >
                    {isSelected || isHovered ? (
                      <circle
                        className={`mutation-node-halo ${isSelected ? "is-selected-halo" : "is-hover-halo"}`}
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + (isSelected ? 8 : 5)}
                      />
                    ) : null}
                    <NodeShape node={node} contextOnly={contextOnly} />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <TraceDetail node={selected} nodes={nodesById} onSelect={setSelectedTraceId} />
      </div>
    </section>
  );
}
