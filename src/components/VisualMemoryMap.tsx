"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { VisualMemoryMapData, VisualMemoryMapEdge, VisualMemoryMapNode, VisualMemoryMapNodeType } from "../lib/types";

const width = 1120;
const height = 760;
const center = { x: 535, y: 365 };

type PositionedNode = VisualMemoryMapNode & {
  x: number;
  y: number;
  radius: number;
};

const typeLabels: Record<VisualMemoryMapNodeType, string> = {
  poem: "bugünün şiiri",
  dream: "bugünkü rüya",
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

function radialPosition(node: VisualMemoryMapNode, index: number, total: number, radius: number, phase: number) {
  const jitter = ((hashNumber(node.id) % 41) - 20) * 0.7;
  const angle = phase + (index / Math.max(1, total)) * Math.PI * 2 + jitter * 0.006;
  return {
    x: center.x + Math.cos(angle) * (radius + jitter),
    y: center.y + Math.sin(angle) * (radius * 0.73 + jitter * 0.5)
  };
}

function nodeRadius(node: VisualMemoryMapNode): number {
  if (node.type === "poem") return 31;
  if (node.type === "dream") return 24;
  if (node.type === "source_effect") return 6;
  if (node.type === "mutation") return 8;
  return 8 + Math.min(7, node.times_recalled * 1.1) + (node.recall_type === "direct" ? 3 : 0);
}

function positionNodes(nodes: VisualMemoryMapNode[]): PositionedNode[] {
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
    if (node.type === "dream") point = { x: center.x + 132, y: center.y - 92 };
    if (node.type === "memory_trace") {
      const directIndex = groups.direct.findIndex((item) => item.id === node.id);
      const indirectIndex = groups.indirect.findIndex((item) => item.id === node.id);
      point = directIndex >= 0
        ? radialPosition(node, directIndex, groups.direct.length, 185, -0.45)
        : radialPosition(node, indirectIndex, groups.indirect.length, 290, 0.3);
    }
    if (node.type === "source_effect") point = radialPosition(node, groups.source.findIndex((item) => item.id === node.id), groups.source.length, 430, 0.72);
    if (node.type === "mutation") point = radialPosition(node, groups.mutation.findIndex((item) => item.id === node.id), groups.mutation.length, 112, 1.1);
    return { ...node, ...point, radius: nodeRadius(node) };
  });
}

function curvePath(edge: VisualMemoryMapEdge, source: PositionedNode, target: PositionedNode): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const bend = edge.kind === "dream_return" ? 0.2 : edge.kind === "indirect" ? -0.13 : 0.08;
  const controlX = (source.x + target.x) / 2 - dy * bend;
  const controlY = (source.y + target.y) / 2 + dx * bend;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
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

function DetailPanel({ node }: { node: VisualMemoryMapNode | null }) {
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
    </aside>
  );
}

export function VisualMemoryMap({ data }: { data: VisualMemoryMapData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nodes = useMemo(() => positionNodes(data.nodes), [data.nodes]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const hovered = hoveredId ? byId.get(hoveredId) ?? null : null;
  const activeId = hoveredId ?? selectedId;

  return (
    <section className="memory-map-experience">
      <header className="memory-map-intro">
        <div>
          <span className="memory-map-kicker">son yedi günün yakın alanı</span>
          <h1>Visual Memory Map</h1>
          <p>Bugünün şiiri merkezde; rüya, hatırlamalar, dönüşler ve içselleştirilmiş dış etkiler çevresinde.</p>
        </div>
        <div className="memory-map-legend" aria-label="Harita açıklaması">
          <span><i className="is-direct" />doğrudan çağrı</span>
          <span><i className="is-indirect" />dolaylı çağrı</span>
          <span><i className="is-dream" />rüya dönüşü</span>
          <span><i className="is-source" />dış etki</span>
        </div>
      </header>
      <div className="memory-map-layout">
        <div className="memory-map-canvas">
          {hovered ? (
            <div className="memory-map-hover">
              <strong>{hovered.label}</strong>
              <span>{shortText(hovered.summary)}</span>
              <small>{hovered.date} / {typeLabels[hovered.type]} / {hovered.recall_type}</small>
            </div>
          ) : null}
          <svg className="memory-map-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="UCU BEDEN görsel hafıza haritası">
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
            <ellipse className="memory-map-field" cx={center.x} cy={center.y} rx="465" ry="315" />
            <g className="memory-map-edges">
              {data.edges.map((edge) => {
                const source = byId.get(edge.source);
                const target = byId.get(edge.target);
                if (!source || !target) return null;
                const focused = Boolean(activeId && (edge.source === activeId || edge.target === activeId));
                return <path key={edge.id} className={`memory-map-edge edge-${edge.kind}${focused ? " is-focused" : ""}`} d={curvePath(edge, source, target)} style={{ opacity: focused ? 1 : Math.max(0.2, edge.weight * 0.72) }} />;
              })}
            </g>
            <g className="memory-map-nodes">
              {nodes.map((node) => {
                const selectedNode = selectedId === node.id;
                const hoveredNode = hoveredId === node.id;
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
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(node.id)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setSelectedId(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(node.id);
                      }
                    }}
                  >
                    {selectedNode || hoveredNode ? <circle className="memory-map-node-halo" cx={node.x} cy={node.y} r={node.radius + 10} /> : null}
                    <NodeGlyph node={node} />
                    {(node.type === "poem" || node.type === "dream") ? <text x={node.x} y={node.y + node.radius + 22} textAnchor="middle">{shortText(node.label, 34)}</text> : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <DetailPanel node={selected} />
      </div>
    </section>
  );
}
