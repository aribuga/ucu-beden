"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";

import {
  alertFocusTarget,
  buildAnatomyIndexes,
  buildLayout,
  buildOverviewGraph,
  classifyNodeProjection,
  edgeCssClass,
  focusNodeNeighborhood,
  gmailSummary,
  isSecondaryTechnicalEdge,
  nodeMetrics,
  nodeRuntimeState,
  nodeUiKind,
  nodeVisibleInView,
  overviewEdgePair,
  overviewStoryEdgePairs,
  overviewStorySteps,
  searchMatchesEdge,
  searchMatchesNode,
  summarizeEdge,
  type AnatomyAlert,
  type AnatomyEdge,
  type AnatomyGraphBundle,
  type AnatomyIssue,
  type AnatomyLayoutNode,
  type AnatomyUiKind,
  type AnatomyViewMode,
  type OverviewEdge,
  type OverviewNode
} from "../../lib/anatomyGraphTypes";

type Selection = { type: "node" | "edge" | "alert" | "overview-node" | "overview-edge"; id: string } | null;
type PositionMap = Record<string, { x: number; y: number }>;
type StatusFilterKey = "active" | "defined" | "unknown" | "inactive" | "observed" | "inferred" | "planned" | "broken" | "orphan";
type OverviewMode = "map" | "explain";

const kindLabels: Record<AnatomyUiKind, string> = {
  source: "Sources",
  process: "Processes",
  memory: "Memories",
  storage: "Storage",
  scheduler: "Schedulers",
  output: "Outputs",
  observer: "Observers",
  unknown: "Unknown"
};

const statusLabels: Record<StatusFilterKey, string> = {
  active: "Active",
  defined: "Defined",
  unknown: "Unknown",
  inactive: "Inactive",
  observed: "Observed",
  inferred: "Inferred",
  planned: "Planned",
  broken: "Broken",
  orphan: "Orphan"
};

const viewLabels: Record<AnatomyViewMode, string> = {
  overview: "Genel Bakış",
  anatomy: "Node Haritası",
  technical: "Teknik",
  alerts: "Uyarılar"
};

const allKinds = Object.keys(kindLabels) as AnatomyUiKind[];
const allStatusFilters = Object.keys(statusLabels) as StatusFilterKey[];
const allViews: AnatomyViewMode[] = ["overview", "anatomy", "technical", "alerts"];
const nodeWidth = 220;
const nodeHeight = 104;
const overviewNodeWidth = 260;
const overviewNodeHeight = 138;
const layoutStorageKey = "ucu-beden-anatomy-layout-v1";
const viewStorageKey = "ucu-beden-anatomy-view-v1";
const minScale = 0.16;
const maxScale = 1.9;

function activeFilterMap<T extends string>(keys: T[]): Record<T, boolean> {
  return Object.fromEntries(keys.map((key) => [key, true])) as Record<T, boolean>;
}

function validView(value: string | null): value is AnatomyViewMode {
  return Boolean(value && allViews.includes(value as AnatomyViewMode));
}

function shortLabel(value: string, limit = 28): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function clampScale(value: number): number {
  return Math.min(maxScale, Math.max(minScale, value));
}

function graphPointFromEvent(container: HTMLDivElement | null, pan: { x: number; y: number }, scale: number, event: MouseEvent | ReactMouseEvent) {
  const rect = container?.getBoundingClientRect();
  return {
    x: ((event.clientX - (rect?.left ?? 0)) - pan.x) / scale,
    y: ((event.clientY - (rect?.top ?? 0)) - pan.y) / scale
  };
}

function edgePath(source: AnatomyLayoutNode, target: AnatomyLayoutNode): string {
  const sx = source.x + nodeWidth;
  const sy = source.y + nodeHeight / 2;
  const tx = target.x;
  const ty = target.y + nodeHeight / 2;
  const curve = Math.max(70, Math.abs(tx - sx) * 0.42);
  return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
}

function edgeMidpoint(source: AnatomyLayoutNode, target: AnatomyLayoutNode): { x: number; y: number } {
  return {
    x: (source.x + nodeWidth + target.x) / 2,
    y: (source.y + target.y) / 2 + nodeHeight / 2
  };
}

function overviewEdgePath(source: OverviewNode, target: OverviewNode): string {
  const sx = source.x + overviewNodeWidth;
  const sy = source.y + overviewNodeHeight / 2;
  const tx = target.x;
  const ty = target.y + overviewNodeHeight / 2;
  const curve = Math.max(80, Math.abs(tx - sx) * 0.38);
  return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
}

function overviewEdgeMidpoint(source: OverviewNode, target: OverviewNode): { x: number; y: number } {
  return {
    x: (source.x + overviewNodeWidth + target.x) / 2,
    y: (source.y + target.y) / 2 + overviewNodeHeight / 2
  };
}

function evidenceList(edge: AnatomyEdge | null, bundle: AnatomyGraphBundle) {
  const evidenceById = new Map(bundle.evidence.map((item) => [item.id, item]));
  return edge ? edge.evidence_refs.map((id) => evidenceById.get(id)).filter(Boolean) : [];
}

function metadataValue(value: unknown): string {
  if (value === null || value === undefined) return "Not measured";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "empty";
  return JSON.stringify(value);
}

function overviewHumanStatus(node: OverviewNode): string {
  if (node.mainIssue) return node.alertCount ? `${node.alertCount} dikkat noktası` : "dikkat noktası var";
  if (node.orphanCount > 0) return `${node.orphanCount} yetim parça`;
  if (node.activeConnectionCount > 0) return "kanıtlı akış var";
  return node.connectedCount > 0 ? "bağlı" : "bağlantı yok";
}

function focusTargetForAlert(alert: AnatomyAlert): Selection {
  const target = alertFocusTarget(alert);
  return target ? { type: target.type, id: target.id } : { type: "alert", id: alert.id };
}

export function AnatomyExplorer({ bundle, issues }: { bundle: AnatomyGraphBundle | null; issues: AnatomyIssue[] }) {
  const [view, setView] = useState<AnatomyViewMode>("overview");
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("map");
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [kindFilters, setKindFilters] = useState<Record<AnatomyUiKind, boolean>>(() => activeFilterMap(allKinds));
  const [statusFilters, setStatusFilters] = useState<Record<StatusFilterKey, boolean>>(() => activeFilterMap(allStatusFilters));
  const [hideFiltered, setHideFiltered] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [groupFocusNodeIds, setGroupFocusNodeIds] = useState<Set<string> | null>(null);
  const [pendingCenterNodeId, setPendingCenterNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.58);
  const [pan, setPan] = useState({ x: 18, y: 20 });
  const [selection, setSelection] = useState<Selection>(null);
  const [storedPositions, setStoredPositions] = useState<PositionMap>({});
  const [dragging, setDragging] = useState<null | { id: string; offsetX: number; offsetY: number }>(null);
  const [panning, setPanning] = useState<null | { startX: number; startY: number; panX: number; panY: number }>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryView = params.get("view");
      const storedView = window.localStorage.getItem(viewStorageKey);
      if (validView(queryView)) setView(queryView);
      else if (validView(storedView)) setView(storedView);
    } catch {
      setView("overview");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(viewStorageKey, view);
      const url = new URL(window.location.href);
      if (view === "overview") url.searchParams.delete("view");
      else url.searchParams.set("view", view);
      window.history.replaceState(null, "", url);
    } catch {
      // Query param persistence is a convenience only.
    }
  }, [view]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(layoutStorageKey);
      if (raw) setStoredPositions(JSON.parse(raw) as PositionMap);
    } catch {
      setStoredPositions({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(layoutStorageKey, JSON.stringify(storedPositions));
    } catch {
      // localStorage may be unavailable in private contexts; layout still works in memory.
    }
  }, [storedPositions]);

  const indexes = useMemo(() => bundle ? buildAnatomyIndexes(bundle) : null, [bundle]);
  const overview = useMemo(() => bundle ? buildOverviewGraph(bundle) : null, [bundle]);
  const overviewNodesById = useMemo(() => new Map((overview?.nodes ?? []).map((node) => [node.id, node])), [overview]);
  const overviewEdgesById = useMemo(() => new Map((overview?.edges ?? []).map((edge) => [edge.id, edge])), [overview]);
  const currentStoryStep = overviewStorySteps[storyStepIndex] ?? overviewStorySteps[0];
  const currentStoryRegionIds = useMemo(() => new Set(currentStoryStep.regionIds), [currentStoryStep]);
  const currentStoryEdgePairs = useMemo(() => new Set(currentStoryStep.edgePairs), [currentStoryStep]);
  const projectionVisibleNodeIds = useMemo(() => {
    if (!bundle || !indexes) return new Set<string>();
    return new Set(bundle.nodes
      .filter((node) => nodeVisibleInView(node, indexes, view, showPresentation))
      .map((node) => node.id));
  }, [bundle, indexes, view, showPresentation]);

  const focusSeedKey = groupFocusNodeIds ? [...groupFocusNodeIds].sort().join("|") : "";
  const activeFocusNodeIds = useMemo(() => {
    if (!bundle || !indexes || !focusMode || view === "overview" || view === "alerts") return null;
    if (groupFocusNodeIds) return focusNodeNeighborhood(groupFocusNodeIds, indexes);
    if (selection?.type === "node") return focusNodeNeighborhood([selection.id], indexes);
    if (selection?.type === "edge") {
      const edge = indexes.edgesById.get(selection.id);
      return edge ? focusNodeNeighborhood([edge.source, edge.target], indexes) : null;
    }
    return null;
  }, [bundle, indexes, focusMode, view, selection, groupFocusNodeIds, focusSeedKey]);

  const layout = useMemo(() => {
    if (!bundle || !indexes) return null;
    const base = buildLayout(bundle, { visibleNodeIds: projectionVisibleNodeIds });
    return {
      ...base,
      nodes: base.nodes.map((node) => {
        const saved = storedPositions[node.id];
        const metrics = nodeMetrics(node, indexes);
        return {
          ...node,
          x: saved?.x ?? node.x,
          y: saved?.y ?? node.y,
          ui_kind: nodeUiKind(node),
          runtime_state: nodeRuntimeState(node, indexes),
          metrics
        };
      })
    };
  }, [bundle, indexes, projectionVisibleNodeIds, storedPositions]);

  const layoutNodesById = useMemo(() => new Map((layout?.nodes ?? []).map((node) => [node.id, node])), [layout]);
  const selectedNode = selection?.type === "node" ? layoutNodesById.get(selection.id) ?? null : null;
  const selectedEdge = selection?.type === "edge" && bundle ? bundle.edges.find((edge) => edge.id === selection.id) ?? null : null;
  const selectedAlert = selection?.type === "alert" && bundle ? bundle.alerts.find((alert) => alert.id === selection.id) ?? null : null;
  const selectedOverviewNode = selection?.type === "overview-node" ? overviewNodesById.get(selection.id as OverviewNode["id"]) ?? null : null;
  const selectedOverviewEdge = selection?.type === "overview-edge" ? overviewEdgesById.get(selection.id) ?? null : null;

  const overviewFocusedRegionIds = useMemo(() => {
    if (view !== "overview" || !overview) return null;
    if (focusMode && selection?.type === "overview-node") {
      const focused = new Set<string>([selection.id]);
      overview.edges.forEach((edge) => {
        if (edge.source === selection.id) focused.add(edge.target);
        if (edge.target === selection.id) focused.add(edge.source);
      });
      return focused;
    }
    if (overviewMode === "explain") return new Set(currentStoryRegionIds);
    return null;
  }, [focusMode, view, selection, overview, overviewMode, currentStoryRegionIds]);

  const filteredNodeIds = useMemo(() => {
    if (!bundle || !indexes) return new Set<string>();
    return new Set(
      bundle.nodes
        .filter((node) => {
          if (!projectionVisibleNodeIds.has(node.id)) return false;
          const kind = nodeUiKind(node);
          const metrics = nodeMetrics(node, indexes);
          const runtime = nodeRuntimeState(node, indexes);
          const kindOk = kindFilters[kind];
          const statusOk = statusFilters[runtime] && (!metrics.orphan || statusFilters.orphan);
          const focusOk = !activeFocusNodeIds || activeFocusNodeIds.has(node.id);
          return kindOk && statusOk && focusOk && searchMatchesNode(node, query);
        })
        .map((node) => node.id)
    );
  }, [bundle, indexes, projectionVisibleNodeIds, kindFilters, statusFilters, activeFocusNodeIds, query]);

  const filteredEdges = useMemo(() => {
    if (!bundle || !indexes) return new Set<string>();
    return new Set(
      bundle.edges
        .filter((edge) => {
          const inProjection = projectionVisibleNodeIds.has(edge.source) && projectionVisibleNodeIds.has(edge.target);
          const focusOk = !activeFocusNodeIds || (activeFocusNodeIds.has(edge.source) && activeFocusNodeIds.has(edge.target));
          return inProjection && focusOk && statusFilters[edge.status] && searchMatchesEdge(edge, query, indexes);
        })
        .map((edge) => edge.id)
    );
  }, [bundle, indexes, projectionVisibleNodeIds, statusFilters, activeFocusNodeIds, query]);

  useEffect(() => {
    if (!pendingCenterNodeId) return;
    const node = layoutNodesById.get(pendingCenterNodeId);
    if (!node) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    const nextScale = Math.max(scale, 0.86);
    setScale(nextScale);
    setPan({ x: (rect?.width ?? 900) / 2 - node.x * nextScale - 120, y: (rect?.height ?? 600) / 2 - node.y * nextScale - 60 });
    setPendingCenterNodeId(null);
  }, [pendingCenterNodeId, layoutNodesById, scale]);

  function changeView(next: AnatomyViewMode) {
    setView(next);
    if (next === "overview") {
      setGroupFocusNodeIds(null);
      setScale(0.58);
      setPan({ x: 18, y: 20 });
    }
    if (next === "anatomy" || next === "technical") {
      setScale((current) => Math.max(current, 0.74));
      setPan((current) => current.x === 18 && current.y === 20 ? { x: 24, y: 16 } : current);
    }
    if (next === "alerts") setSelection(null);
  }

  function focusSelection(next: Selection) {
    setSelection(next);
    if (!next || next.type === "alert") return;
    if (next.type === "overview-node" || next.type === "overview-edge") {
      setView("overview");
      return;
    }
    setView("anatomy");
    const node = next.type === "node"
      ? layoutNodesById.get(next.id)
      : (() => {
          const edge = bundle?.edges.find((item) => item.id === next.id);
          return edge ? layoutNodesById.get(edge.source) ?? layoutNodesById.get(edge.target) : null;
        })();
    if (!node) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    const nextScale = Math.max(scale, 0.9);
    setScale(nextScale);
    setPan({ x: (rect?.width ?? 900) / 2 - node.x * nextScale - 120, y: (rect?.height ?? 600) / 2 - node.y * nextScale - 60 });
  }

  function drillIntoOverviewNode(node: OverviewNode) {
    setGroupFocusNodeIds(new Set(node.memberNodeIds));
    setFocusMode(true);
    setHideFiltered(false);
    setSelection(null);
    setView("anatomy");
    setPendingCenterNodeId(node.memberNodeIds[0] ?? null);
  }

  function resetLayout() {
    setStoredPositions({});
    setScale(view === "overview" ? 0.58 : 0.74);
    setPan(view === "overview" ? { x: 18, y: 20 } : { x: 24, y: 16 });
  }

  function fitView() {
    if (!overview || !layout) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    const width = view === "overview" ? overview.width : layout.width;
    const height = view === "overview" ? overview.height : layout.height;
    const nextScale = clampScale(Math.min(((rect?.width ?? 900) - 42) / width, ((rect?.height ?? 620) - 42) / height));
    setScale(nextScale);
    setPan({ x: 21, y: 21 });
  }

  function clearFocus() {
    setFocusMode(false);
    setGroupFocusNodeIds(null);
  }

  function changeOverviewMode(next: OverviewMode) {
    setOverviewMode(next);
    if (next === "explain") {
      setFocusMode(false);
      setGroupFocusNodeIds(null);
    }
  }

  function moveStoryStep(delta: number) {
    setOverviewMode("explain");
    setFocusMode(false);
    setGroupFocusNodeIds(null);
    const next = (storyStepIndex + delta + overviewStorySteps.length) % overviewStorySteps.length;
    setStoryStepIndex(next);
    const firstRegion = overviewStorySteps[next]?.regionIds[0];
    if (firstRegion) setSelection({ type: "overview-node", id: firstRegion });
  }

  function handleNodeMouseDown(node: AnatomyLayoutNode, event: ReactMouseEvent) {
    event.stopPropagation();
    const point = graphPointFromEvent(viewportRef.current, pan, scale, event);
    setSelection({ type: "node", id: node.id });
    setDragging({ id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (dragging) {
      const point = graphPointFromEvent(viewportRef.current, pan, scale, event);
      setStoredPositions((current) => ({ ...current, [dragging.id]: { x: Math.max(0, point.x - dragging.offsetX), y: Math.max(0, point.y - dragging.offsetY) } }));
      return;
    }
    if (panning) {
      setPan({ x: panning.panX + event.clientX - panning.startX, y: panning.panY + event.clientY - panning.startY });
    }
  }

  function copyText(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  function handleCanvasMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (event.target === event.currentTarget || target.classList.contains("anatomy-canvas")) {
      setPanning({ startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y });
    }
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const zoomGesture = event.ctrlKey || event.metaKey || event.altKey;
    if (!zoomGesture) {
      setPan((current) => ({
        x: current.x - (event.shiftKey ? event.deltaY : event.deltaX),
        y: current.y - (event.shiftKey ? 0 : event.deltaY)
      }));
      return;
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    const pointerX = event.clientX - (rect?.left ?? 0);
    const pointerY = event.clientY - (rect?.top ?? 0);
    setScale((currentScale) => {
      const nextScale = clampScale(currentScale * (event.deltaY < 0 ? 1.08 : 0.92));
      const graphX = (pointerX - pan.x) / currentScale;
      const graphY = (pointerY - pan.y) / currentScale;
      setPan({ x: pointerX - graphX * nextScale, y: pointerY - graphY * nextScale });
      return nextScale;
    });
  }

  if (!bundle || !layout || !indexes || !overview) {
    return (
      <main className="anatomy-shell">
        <section className="anatomy-error">
          <h1>Anatomy</h1>
          <p>Scanner graph çıktısı yüklenemedi.</p>
          <ul>{issues.map((issue) => <li key={`${issue.code}-${issue.path ?? issue.message}`}>{issue.code}: {issue.message}</li>)}</ul>
        </section>
      </main>
    );
  }

  const summary = bundle.summary;
  const selectedEvidence = evidenceList(selectedEdge, bundle);
  const orphans = (summary.counts.orphan_sources ?? 0) + (summary.counts.orphan_outputs ?? 0);
  const validationProblems = issues.filter((issue) => issue.severity === "error");
  const presentationCount = bundle.nodes.filter((node) => classifyNodeProjection(node, indexes).systemRelevance === "ui-only").length;
  const detailNodeCount = projectionVisibleNodeIds.size;
  const detailEdgeCount = bundle.edges.filter((edge) => projectionVisibleNodeIds.has(edge.source) && projectionVisibleNodeIds.has(edge.target)).length;
  const showInspector = view !== "overview" || Boolean(selection);

  return (
    <main className="anatomy-shell">
      <header className="anatomy-topbar">
        <div className="anatomy-title-block">
          <div className="anatomy-tabs">
            {allViews.map((item) => (
              <button key={item} className={view === item ? "is-active" : ""} onClick={() => changeView(item)}>
                {viewLabels[item]}{item === "alerts" ? <span>{bundle.alerts.length}</span> : null}
              </button>
            ))}
          </div>
          <p>{validationProblems.length ? "Graph şemasında sorun var" : "Salt okunur scanner graph"} / Son tarama: {summary.generated_at ?? "ölçülmedi"}</p>
        </div>
        <label className="anatomy-search">
          <span>Ara</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="node, dosya, tip, ilişki" />
        </label>
        <div className="anatomy-health">
          <span>Nodes {view === "overview" ? overview.nodes.length : detailNodeCount}</span>
          <span>Edges {view === "overview" ? overview.edges.length : detailEdgeCount}</span>
          <span>Observed {summary.counts.observed_edges}</span>
          <span>Inferred {summary.counts.inferred_edges}</span>
          <span>Broken {summary.counts.broken_edges}</span>
          <span>Orphans {orphans}</span>
          <span>Alerts {summary.counts.alerts}</span>
        </div>
        <button className="anatomy-refresh" onClick={() => window.location.reload()}>Reload JSON</button>
      </header>

      {focusMode ? (
        <div className="anatomy-focus-banner">
          <span>Focus mode</span>
          <p>{groupFocusNodeIds ? "Overview group expanded into Anatomy." : "Showing the selected node and one-hop neighbors."}</p>
          <button onClick={clearFocus}>Clear Focus</button>
        </div>
      ) : null}

      <div className={`anatomy-workbench ${view === "overview" ? "is-overview" : ""}${showInspector ? "" : " is-inspector-closed"}`}>
        <aside className={`anatomy-sidebar ${view === "overview" ? "anatomy-sidebar-overview" : ""}`}>
          {view === "overview" ? (
            <>
              <div className="anatomy-side-section">
                <h2>Genel Bakış</h2>
                <div className="anatomy-overview-mode-switch" role="group" aria-label="Overview mode">
                  <button className={overviewMode === "map" ? "is-active" : ""} onClick={() => changeOverviewMode("map")}>Harita</button>
                  <button className={overviewMode === "explain" ? "is-active" : ""} onClick={() => changeOverviewMode("explain")}>Anlat</button>
                </div>
                <p>{overview.nodes.length} ana bölüm, {bundle.nodes.length} scanner node’undan okunuyor.</p>
                <p>{presentationCount} yalnızca arayüz/sunum node’u bu görünümden saklandı.</p>
              </div>
              {overviewMode === "explain" ? (
                <div className="anatomy-side-section anatomy-explain-card">
                  <span>Adım {storyStepIndex + 1} / {overviewStorySteps.length}</span>
                  <h2>{currentStoryStep.title}</h2>
                  <p>{currentStoryStep.body}</p>
                  <div className="anatomy-explain-controls">
                    <button onClick={() => moveStoryStep(-1)}>Daha önce</button>
                    <button onClick={() => moveStoryStep(1)}>Sonraki</button>
                  </div>
                </div>
              ) : null}
              <div className="anatomy-side-section">
                <h2>Controls</h2>
                <button onClick={() => setScale((value) => Math.min(1.45, value + 0.1))}>Zoom in</button>
                <button onClick={() => setScale((value) => Math.max(0.48, value - 0.1))}>Zoom out</button>
                <button onClick={fitView}>Fit View</button>
                <button onClick={resetLayout}>Reset Layout</button>
                {selection?.type === "overview-node" ? <button onClick={() => setFocusMode(true)}>Focus</button> : null}
                {focusMode ? <button onClick={clearFocus}>Clear Focus</button> : null}
              </div>
              <div className="anatomy-side-section anatomy-flow-note">
                <h2>Okuma Notu</h2>
                <p>Bugünün Hafızası state ve daily_life gibi kısa ömürlü izleri tutar.</p>
                <p>Birikmiş Hafıza memory traces, index ve report gibi geçmiş kayıtlarından oluşur.</p>
                <p>Bugünkü Malzeme bu iki hafızadan ve kaynak etkilerinden üretime girecek bağlamı seçer.</p>
              </div>
              <div className="anatomy-side-section anatomy-gmail-card">
                <h2>Gmail</h2>
                {gmailSummary(bundle).map((line) => <p key={line}>{line}</p>)}
              </div>
            </>
          ) : (
            <>
              <div className="anatomy-side-section">
                <h2>Node Types</h2>
                {allKinds.map((kind) => (
                  <label key={kind} className="anatomy-check">
                    <input
                      type="checkbox"
                      checked={kindFilters[kind]}
                      onChange={() => setKindFilters((current) => ({ ...current, [kind]: !current[kind] }))}
                    />
                    <span>{kindLabels[kind]}</span>
                  </label>
                ))}
              </div>
              <div className="anatomy-side-section">
                <h2>Status</h2>
                {allStatusFilters.map((key) => (
                  <label key={key} className="anatomy-check">
                    <input
                      type="checkbox"
                      checked={statusFilters[key]}
                      onChange={() => setStatusFilters((current) => ({ ...current, [key]: !current[key] }))}
                    />
                    <span>{statusLabels[key]}</span>
                  </label>
                ))}
                <label className="anatomy-check anatomy-check-muted">
                  <input type="checkbox" checked={hideFiltered} onChange={() => setHideFiltered((value) => !value)} />
                  <span>Hide filtered</span>
                </label>
                <label className="anatomy-check anatomy-check-muted">
                  <input type="checkbox" checked={showPresentation} onChange={() => setShowPresentation((value) => !value)} />
                  <span>Show presentation/UI-only nodes</span>
                </label>
              </div>
              <div className="anatomy-side-section">
                <h2>Controls</h2>
                <button onClick={() => setScale((value) => Math.min(1.8, value + 0.12))}>Zoom in</button>
                <button onClick={() => setScale((value) => Math.max(0.38, value - 0.12))}>Zoom out</button>
                <button onClick={fitView}>Fit View</button>
                <button onClick={resetLayout}>Reset Layout</button>
                {(selectedNode || selectedEdge) && !focusMode ? <button onClick={() => setFocusMode(true)}>Focus</button> : null}
                {focusMode ? <button onClick={clearFocus}>Clear Focus</button> : null}
              </div>
              <div className="anatomy-side-section anatomy-gmail-card">
                <h2>Gmail</h2>
                {gmailSummary(bundle).map((line) => <p key={line}>{line}</p>)}
                <button onClick={() => focusSelection({ type: "node", id: "external:gmail" })}>Show Gmail node</button>
              </div>
            </>
          )}
        </aside>

        <section
          className="anatomy-main"
          onMouseMove={handleMouseMove}
          onMouseUp={() => { setDragging(null); setPanning(null); }}
          onMouseLeave={() => { setDragging(null); setPanning(null); }}
        >
          {view === "alerts" ? (
            <div className="anatomy-alerts-view">
              <h2>Scanner Alerts</h2>
              <p>Alert entries are read directly from graph/alerts.json. Empty categories are left empty; the UI does not invent alerts.</p>
              <div className="anatomy-alert-grid">
                {bundle.alerts.map((alert) => (
                  <article key={alert.id} className={`anatomy-alert-card anatomy-alert-${alert.severity}`}>
                    <span>{alert.severity}</span>
                    <h3>{alert.type}</h3>
                    <p>{alert.title}</p>
                    <small>{alert.description}</small>
                    <button onClick={() => focusSelection(focusTargetForAlert(alert))}>Show on map</button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div
              ref={viewportRef}
              className={`anatomy-canvas-viewport ${view === "overview" ? "is-overview" : ""}`}
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleCanvasWheel}
            >
              {view === "overview" ? (
                <svg
                  width={overview.width}
                  height={overview.height}
                  className="anatomy-canvas anatomy-overview-canvas"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
                  role="img"
                  aria-label="UCU BEDEN overview graph"
                >
                  <defs>
                    <marker id="anatomy-overview-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
                      <path d="M 0 0 L 9 4.5 L 0 9 z" />
                    </marker>
                  </defs>
                  <g className="anatomy-overview-edges">
                    {overview.edges.map((edge) => {
                      const source = overviewNodesById.get(edge.source);
                      const target = overviewNodesById.get(edge.target);
                      if (!source || !target) return null;
                      const pair = overviewEdgePair(edge);
                      const stepEdge = overviewMode === "explain" && currentStoryEdgePairs.has(pair);
                      const selectedFocusActive = focusMode && selection?.type === "overview-node";
                      const focused = selectedFocusActive
                        ? !overviewFocusedRegionIds || (overviewFocusedRegionIds.has(edge.source) && overviewFocusedRegionIds.has(edge.target))
                        : overviewMode === "explain"
                          ? stepEdge
                          : !overviewFocusedRegionIds || (overviewFocusedRegionIds.has(edge.source) && overviewFocusedRegionIds.has(edge.target));
                      const mid = overviewEdgeMidpoint(source, target);
                      return (
                        <g
                          key={edge.id}
                          className={`anatomy-overview-edge anatomy-edge-${edge.status}${overviewStoryEdgePairs.has(pair) ? " is-story" : ""}${stepEdge ? " is-current-story" : ""}${focused ? "" : " is-dim"}${selection?.type === "overview-edge" && selection.id === edge.id ? " is-selected" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelection({ type: "overview-edge", id: edge.id });
                          }}
                        >
                          <path d={overviewEdgePath(source, target)} markerEnd="url(#anatomy-overview-arrow)" style={{ strokeWidth: Math.min(6, 1.4 + edge.memberEdgeIds.length * 0.08) }} />
                          {scale > 0.76 ? <text x={mid.x} y={mid.y - 8}>{stepEdge ? "bu adım" : `${edge.memberEdgeIds.length} kanıt`}</text> : null}
                        </g>
                      );
                    })}
                  </g>
                  <g className="anatomy-overview-nodes">
                    {overview.nodes.map((node) => {
                      const focused = !overviewFocusedRegionIds || overviewFocusedRegionIds.has(node.id);
                      const storyActive = overviewMode === "explain" && currentStoryRegionIds.has(node.id);
                      const queryMatch = !query.trim()
                        || node.label.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))
                        || node.technicalLabel.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))
                        || node.importantNodeLabels.some((label) => label.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x} ${node.y})`}
                          className={`anatomy-overview-node anatomy-overview-status-${node.status}${storyActive ? " is-current-story" : ""}${focused && queryMatch ? "" : " is-dim"}${selection?.type === "overview-node" && selection.id === node.id ? " is-selected" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelection({ type: "overview-node", id: node.id });
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            drillIntoOverviewNode(node);
                          }}
                        >
                          <rect width={overviewNodeWidth} height={overviewNodeHeight} rx="7" />
                          <text className="anatomy-overview-title" x="16" y="25">{node.label}</text>
                          <text className="anatomy-overview-description" x="16" y="48">{shortLabel(node.description, 38)}</text>
                          <text className="anatomy-overview-status" x="16" y="70">{overviewHumanStatus(node)}</text>
                          {scale > 0.54 ? <text className="anatomy-overview-line" x="16" y="92">{node.connectedCount} bağlı parça / {node.nodeCount} kayıt</text> : null}
                          {scale > 0.72 && node.mainIssue ? <text className="anatomy-overview-issue" x="16" y="114">{shortLabel(node.mainIssue, 38)}</text> : null}
                          {scale > 1.08 ? <text className="anatomy-overview-line" x="16" y="130">{shortLabel(node.technicalLabel, 42)}</text> : null}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              ) : (
                <svg
                  width={layout.width}
                  height={layout.height}
                  className="anatomy-canvas"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
                  role="img"
                  aria-label="UCU BEDEN scanner graph"
                >
                  <defs>
                    <marker id="anatomy-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                      <path d="M 0 0 L 8 4 L 0 8 z" />
                    </marker>
                  </defs>
                  <g className="anatomy-edges">
                    {bundle.edges.map((edge) => {
                      const source = layoutNodesById.get(edge.source);
                      const target = layoutNodesById.get(edge.target);
                      if (!source || !target) return null;
                      const sourceVisible = filteredNodeIds.has(source.id);
                      const targetVisible = filteredNodeIds.has(target.id);
                      const edgeVisible = filteredEdges.has(edge.id) && sourceVisible && targetVisible;
                      if (hideFiltered && !edgeVisible) return null;
                      const mid = edgeMidpoint(source, target);
                      const secondary = isSecondaryTechnicalEdge(edge, indexes);
                      return (
                        <g
                          key={edge.id}
                          className={`${edgeCssClass(edge)}${edgeVisible ? "" : " is-dim"}${secondary && view === "anatomy" ? " is-secondary" : ""}${selection?.type === "edge" && selection.id === edge.id ? " is-selected" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelection({ type: "edge", id: edge.id });
                          }}
                        >
                          <path d={edgePath(source, target)} markerEnd="url(#anatomy-arrow)" />
                          <text x={mid.x} y={mid.y - 6}>
                            {shortLabel(edge.relation, 18)} / {edge.status} / {pct(edge.confidence)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                  <g className="anatomy-nodes">
                    {layout.nodes.map((node) => {
                      const nodeVisible = filteredNodeIds.has(node.id);
                      if (hideFiltered && !nodeVisible) return null;
                      const alertCount = indexes.alertsByNode.get(node.id)?.length ?? 0;
                      const projection = classifyNodeProjection(node, indexes);
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x} ${node.y})`}
                          className={`anatomy-node anatomy-node-${node.ui_kind} anatomy-runtime-${node.runtime_state}${nodeVisible ? "" : " is-dim"}${node.metrics.orphan ? " is-orphan" : ""}${projection.systemRelevance === "ui-only" ? " is-ui-only" : ""}${selection?.type === "node" && selection.id === node.id ? " is-selected" : ""}`}
                          onMouseDown={(event) => handleNodeMouseDown(node, event)}
                        >
                          <rect width={nodeWidth} height={nodeHeight} rx="6" />
                          <circle className="anatomy-port anatomy-port-in" cx="0" cy={nodeHeight / 2} r="5" />
                          <circle className="anatomy-port anatomy-port-out" cx={nodeWidth} cy={nodeHeight / 2} r="5" />
                          <text className="anatomy-node-title" x="14" y="22">{shortLabel(node.label)}</text>
                          <text className="anatomy-node-kind" x="14" y="42">{node.ui_kind} / {node.runtime_state}</text>
                          <text className="anatomy-node-confidence" x="14" y="62">confidence {pct(node.confidence)}</text>
                          {alertCount > 0 ? <text className="anatomy-node-alert" x="174" y="22">! {alertCount}</text> : null}
                          {scale > 1.08 ? (
                            <>
                              <text className="anatomy-node-path" x="14" y="83">{shortLabel(node.file_path ?? "No file path", 32)}</text>
                              <text className="anatomy-node-path" x="14" y="98">in {node.metrics.inputs} / out {node.metrics.outputs} / links {node.metrics.links}</text>
                            </>
                          ) : node.metrics.orphan ? <text className="anatomy-node-orphan" x="14" y="83">No downstream consumer</text> : null}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
            </div>
          )}
        </section>

        {showInspector ? (
          <aside className="anatomy-inspector">
            <h2>Inspector</h2>
            {issues.length > 0 ? (
              <section className="anatomy-inspector-block">
                <h3>Schema Warnings</h3>
                {issues.slice(0, 5).map((issue) => <p key={`${issue.code}-${issue.path ?? issue.message}`}>{issue.severity}: {issue.message}</p>)}
              </section>
            ) : null}

            {selectedOverviewNode ? (
              <section className="anatomy-inspector-block">
                <h3>{selectedOverviewNode.label}</h3>
                <dl>
                  <dt>Teknik ad</dt><dd>{selectedOverviewNode.technicalLabel}</dd>
                  <dt>Status</dt><dd>{selectedOverviewNode.status}</dd>
                  <dt>Nodes</dt><dd>{selectedOverviewNode.nodeCount}</dd>
                  <dt>Connected</dt><dd>{selectedOverviewNode.connectedCount}</dd>
                  <dt>Alerts</dt><dd>{selectedOverviewNode.alertCount}</dd>
                  <dt>Issue</dt><dd>{selectedOverviewNode.mainIssue ?? "No primary issue"}</dd>
                  <dt>Ne yapar</dt><dd>{selectedOverviewNode.description}</dd>
                  <dt>Neye göre gelir</dt><dd>{selectedOverviewNode.entryRule}</dd>
                  <dt>Nereye gider</dt><dd>{selectedOverviewNode.exitRule}</dd>
                </dl>
                <button onClick={() => drillIntoOverviewNode(selectedOverviewNode)}>Open In Anatomy</button>
                <button onClick={() => setFocusMode(true)}>Focus</button>
                <h4>Included Nodes</h4>
                <ul>{selectedOverviewNode.importantNodeLabels.map((label) => <li key={label}><span>node</span>{label}</li>)}</ul>
              </section>
            ) : null}

            {selectedOverviewEdge ? (
              <section className="anatomy-inspector-block">
                <h3>{selectedOverviewEdge.relation}</h3>
                <dl>
                  <dt>Source</dt><dd>{overviewNodesById.get(selectedOverviewEdge.source)?.label ?? selectedOverviewEdge.source}</dd>
                  <dt>Target</dt><dd>{overviewNodesById.get(selectedOverviewEdge.target)?.label ?? selectedOverviewEdge.target}</dd>
                  <dt>Status</dt><dd>{selectedOverviewEdge.status}</dd>
                  <dt>Confidence</dt><dd>{pct(selectedOverviewEdge.confidence)}</dd>
                  <dt>Edges</dt><dd>{selectedOverviewEdge.memberEdgeIds.length}</dd>
                  <dt>Issues</dt><dd>{selectedOverviewEdge.issueCount}</dd>
                </dl>
                <p>This overview edge is an aggregate of real scanner edges.</p>
              </section>
            ) : null}

            {selectedNode ? (
              <section className="anatomy-inspector-block">
                <h3>{selectedNode.label}</h3>
                <dl>
                  <dt>ID</dt><dd>{selectedNode.id}</dd>
                  <dt>Type</dt><dd>{selectedNode.type} / {selectedNode.ui_kind}</dd>
                  <dt>Status</dt><dd>{selectedNode.runtime_state}</dd>
                  <dt>Layer</dt><dd>{classifyNodeProjection(selectedNode, indexes).layer} / {classifyNodeProjection(selectedNode, indexes).systemRelevance}</dd>
                  <dt>Confidence</dt><dd>{pct(selectedNode.confidence)}</dd>
                  <dt>Last run</dt><dd>{metadataValue(selectedNode.metadata.last_run_at)}</dd>
                  <dt>File</dt><dd>{selectedNode.file_path ?? "Not measured"} {selectedNode.file_path ? <button onClick={() => copyText(selectedNode.file_path!)}>Copy</button> : null}</dd>
                  <dt>Inputs</dt><dd>{selectedNode.metrics.inputs}</dd>
                  <dt>Outputs</dt><dd>{selectedNode.metrics.outputs}</dd>
                  <dt>Links</dt><dd>{selectedNode.metrics.links}</dd>
                  <dt>Memory connection</dt><dd>{selectedNode.metrics.memoryConnection}</dd>
                  <dt>Orphan</dt><dd>{selectedNode.metrics.orphan ? "yes" : "no"}</dd>
                  <dt>Detection</dt><dd>{selectedNode.detection_method}</dd>
                </dl>
                <button onClick={() => setFocusMode(true)}>Focus</button>
                {selectedNode.id === "external:gmail" ? <div className="anatomy-gmail-lines">{gmailSummary(bundle).map((line) => <p key={line}>{line}</p>)}</div> : null}
                <h4>Metadata</h4>
                <ul>{Object.entries(selectedNode.metadata).slice(0, 14).map(([key, value]) => <li key={key}><span>{key}</span>{metadataValue(value)}</li>)}</ul>
              </section>
            ) : null}

            {selectedEdge ? (
              <section className="anatomy-inspector-block">
                <h3>{selectedEdge.relation}</h3>
                <dl>
                  <dt>Source</dt><dd>{indexes.nodesById.get(selectedEdge.source)?.label ?? selectedEdge.source}</dd>
                  <dt>Target</dt><dd>{indexes.nodesById.get(selectedEdge.target)?.label ?? selectedEdge.target}</dd>
                  <dt>Status</dt><dd>{selectedEdge.status}</dd>
                  <dt>Confidence</dt><dd>{pct(selectedEdge.confidence)}</dd>
                  <dt>Evidence</dt><dd>{selectedEvidence.length}</dd>
                  <dt>Summary</dt><dd>{summarizeEdge(selectedEdge, indexes)}</dd>
                </dl>
                <button onClick={() => setFocusMode(true)}>Focus</button>
                <h4>Evidence</h4>
                {selectedEvidence.length ? selectedEvidence.map((item) => item ? (
                  <article key={item.id} className="anatomy-evidence">
                    <button onClick={() => copyText(`${item.source_file}${item.line ? `:${item.line}` : ""}`)}>Copy path</button>
                    <strong>{item.source_file}{item.line ? `:${item.line}` : ""}</strong>
                    <p>{item.description}</p>
                    {item.snippet ? <code>{item.snippet}</code> : null}
                  </article>
                ) : null) : <p>No evidence refs recorded.</p>}
                <h4>Known Uncertainty</h4>
                <p>{selectedEdge.status === "observed" ? "Direct scanner evidence is present." : "This relation is not treated as a direct fact. More function-level or runtime evidence would be needed."}</p>
              </section>
            ) : null}

            {selectedAlert ? (
              <section className="anatomy-inspector-block">
                <h3>{selectedAlert.type}</h3>
                <p>{selectedAlert.title}</p>
                <p>{selectedAlert.description}</p>
                <button onClick={() => focusSelection(focusTargetForAlert(selectedAlert))}>Show on map</button>
              </section>
            ) : null}

            {!selectedNode && !selectedEdge && !selectedAlert && !selectedOverviewNode && !selectedOverviewEdge ? (
              <section className="anatomy-inspector-block">
                <p>Select a node, edge, or alert to inspect it.</p>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
