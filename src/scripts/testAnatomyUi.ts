import assert from "node:assert/strict";

import { readAnatomyGraphBundle } from "../lib/anatomyGraphServer";
import {
  alertFocusTarget,
  buildAnatomyIndexes,
  buildLayout,
  buildOverviewGraph,
  classifyNodeProjection,
  edgeCssClass,
  gmailSummary,
  nodeMetrics,
  nodeUiKind,
  nodeVisibleInView,
  overviewStoryEdgePairs,
  overviewStorySteps,
  parseGraphBundle,
  searchMatchesEdge,
  searchMatchesNode,
  summarizeEdge,
  validateGraphBundle,
  type AnatomyEdge,
  type AnatomyGraphBundle
} from "../lib/anatomyGraphTypes";

function cloneBundle(bundle: AnatomyGraphBundle): AnatomyGraphBundle {
  return JSON.parse(JSON.stringify(bundle)) as AnatomyGraphBundle;
}

function firstEdge(bundle: AnatomyGraphBundle, status: AnatomyEdge["status"]): AnatomyEdge {
  const edge = bundle.edges.find((item) => item.status === status);
  if (!edge) throw new Error(`Expected ${status} edge in graph.`);
  return edge;
}

async function main(): Promise<void> {
  const { bundle, issues } = await readAnatomyGraphBundle();
  assert.equal(issues.some((issue) => issue.severity === "error"), false, "graph loader should not return fatal schema issues");
  assert.ok(bundle, "node JSON loading should produce a graph bundle");
  assert.ok(bundle.nodes.length > 0, "Node JSON loading");
  assert.ok(bundle.edges.length > 0, "Edge JSON loading");

  const before = JSON.stringify(bundle);
  const indexes = buildAnatomyIndexes(bundle);
  const layout = buildLayout(bundle);
  assert.ok(layout.nodes.length === bundle.nodes.length, "layout should keep every node");

  const overview = buildOverviewGraph(bundle);
  assert.ok(overview.nodes.length > 0, "Overview projection should create system regions");
  assert.ok(overview.nodes.length < bundle.nodes.length, "Overview should be smaller than the technical graph");
  assert.ok(overview.nodes.every((node) => node.memberNodeIds.length > 0), "Overview nodes should reference real scanner nodes");
  assert.ok(overview.nodes.every((node) => node.description && node.entryRule && node.exitRule), "Overview nodes should include readable explanations");
  assert.ok(overview.nodes.some((node) => node.id === "short-term-memory" && node.label === "Bugünün Hafızası" && node.technicalLabel === "Short-Term Memory"), "Overview should use human labels while preserving technical names");
  assert.ok(overview.edges.every((edge) => edge.memberEdgeIds.length > 0), "Overview edges should reference real scanner edges");
  assert.ok(overviewStorySteps.length >= 6, "Overview story mode should include explanation steps");
  assert.ok(overviewStorySteps.every((step) => step.title && step.body && step.regionIds.length > 0), "Overview story steps should be readable");
  assert.ok(overviewStorySteps.every((step) => step.edgePairs.every((pair) => overviewStoryEdgePairs.has(pair))), "Story edge lookup should include all step edges");

  const observed = firstEdge(bundle, "observed");
  assert.equal(edgeCssClass(observed), "anatomy-edge anatomy-edge-observed", "Observed edge render");
  const inferred = firstEdge(bundle, "inferred");
  assert.equal(edgeCssClass(inferred), "anatomy-edge anatomy-edge-inferred", "Inferred edge render");
  const brokenClass = edgeCssClass({ ...observed, status: "broken" });
  assert.equal(brokenClass, "anatomy-edge anatomy-edge-broken", "Broken edge render");

  const gmail = bundle.nodes.find((node) => node.id === "external:gmail");
  assert.ok(gmail, "Gmail node should be present");
  assert.equal(nodeUiKind(gmail), "source", "Gmail should render as source");
  assert.equal(nodeMetrics(gmail, indexes).orphan, true, "Orphan node render");
  assert.ok(gmailSummary(bundle).some((line) => line.includes("No observed memory connection")), "Gmail memory absence should be visible");
  assert.equal(gmail.metadata.memory_connection_observed, false, "Gmail flow should not claim memory connection");
  assert.ok(overview.nodes.some((node) => node.id === "external-sources" && node.mainIssue?.includes("Gmail")), "Overview should surface Gmail as a primary issue");

  const uiOnly = bundle.nodes.find((node) => node.id === "ui-component:src/components/ArchiveList.tsx");
  assert.ok(uiOnly, "UI-only fixture node should exist");
  assert.equal(classifyNodeProjection(uiOnly, indexes).systemRelevance, "ui-only", "Presentation/UI-only node classification");
  assert.equal(nodeVisibleInView(uiOnly, indexes, "anatomy", false), false, "UI-only nodes should be hidden in default Anatomy view");
  assert.equal(nodeVisibleInView(uiOnly, indexes, "technical", true), true, "Technical view should be able to reveal UI-only nodes");

  const dataFlowUi = bundle.nodes.find((node) => node.id === "ui-route:src/app/page.tsx");
  assert.ok(dataFlowUi, "Data-flow UI route node should exist");
  assert.equal(classifyNodeProjection(dataFlowUi, indexes).systemRelevance, "data-flow", "UI route with reads should remain data-flow");

  const evidence = observed.evidence_refs.map((id) => indexes.evidenceById.get(id)).filter(Boolean);
  assert.ok(evidence.length > 0, "Inspector evidence display");
  assert.ok(evidence[0]?.source_file, "Inspector evidence should include source file");

  const gmailAlert = bundle.alerts.find((alert) => alert.type === "gmail_not_observed");
  assert.ok(gmailAlert, "Gmail alert should be present");
  assert.deepEqual(alertFocusTarget(gmailAlert), { type: "node", id: "external:gmail" }, "Alert to node focusing");

  assert.equal(searchMatchesNode(gmail, "gmail"), true, "Search should match node label/id");
  assert.equal(searchMatchesEdge(observed, observed.relation, indexes), true, "Search should match relation");
  assert.ok(summarizeEdge(observed, indexes).includes(observed.relation), "Edge inspector summary");

  const brokenBundle = cloneBundle(bundle);
  brokenBundle.edges = [{ ...brokenBundle.edges[0], id: "broken-test-edge", source: "missing-node-for-test" }, ...brokenBundle.edges.slice(1)];
  assert.ok(validateGraphBundle(brokenBundle).some((issue) => issue.code === "missing_source"), "Missing node reference");

  const rawResult = parseGraphBundle({
    nodes: cloneBundle(bundle).nodes,
    edges: cloneBundle(bundle).edges,
    evidence: cloneBundle(bundle).evidence,
    alerts: cloneBundle(bundle).alerts,
    summary: cloneBundle(bundle).summary
  });
  assert.ok(rawResult.bundle, "schema parser should accept current graph");
  assert.equal(JSON.stringify(bundle), before, "UI graph helpers must not mutate graph data");

  console.log(JSON.stringify({
    status: "passed",
    tests: [
      "Node JSON loading",
      "Edge JSON loading",
      "Missing node reference",
      "Observed edge render",
      "Inferred edge render",
      "Broken edge render",
      "Orphan node render",
      "Inspector evidence display",
      "Alert to node focusing",
      "Search",
      "Gmail flow",
      "Overview projection",
      "Overview story mode",
      "Presentation/UI-only filtering",
      "Read-only graph data"
    ],
    nodes: bundle.nodes.length,
    edges: bundle.edges.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
