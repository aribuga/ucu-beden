import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

type GraphNode = {
  id: string;
  label: string;
  type: string;
  file_path: string | null;
  active: boolean;
  detection_method: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: string;
  confidence: number;
  evidence_refs: string[];
};

type Evidence = {
  id: string;
  source_file: string;
  line: number | null;
  symbol: string | null;
  snippet: string | null;
  description: string;
};

type Alert = {
  id: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  evidence_refs: string[];
  metadata: Record<string, unknown>;
};

type Issue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
};

const repoRoot = process.cwd();
const graphFiles = [
  "graph/nodes.json",
  "graph/edges.json",
  "graph/evidence.json",
  "graph/alerts.json",
  "graph/scan-summary.json",
  "graph/graph-preview.md"
];
const nodeTypes = new Set(["scheduler", "script", "process", "data_store", "database", "external_source", "output"]);
const edgeStatuses = new Set(["observed", "inferred", "planned", "broken"]);
const alertSeverities = new Set(["info", "warning", "error"]);
const ignoredPathPatterns = [
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)out\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)graph\//,
  /(^|\/)__tests__\//,
  /\.test\./,
  /\.spec\./,
  /backup/i,
  /copy/i,
  /demo/i
];

function resolveRepo(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(resolveRepo(relativePath), "utf8")) as T;
}

async function readOutput(relativePath: string): Promise<string> {
  return fs.readFile(resolveRepo(relativePath), "utf8");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function hashOutputs(): Promise<Record<string, string>> {
  const entries = await Promise.all(graphFiles.map(async (file) => [file, hash(await readOutput(file))] as const));
  return Object.fromEntries(entries);
}

function runScanner(): void {
  execFileSync(process.execPath, [...process.execArgv, "src/scripts/scanRepoGraph.ts"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe"
  });
}

function isNormalizedPath(value: string): boolean {
  return !value.includes("\\") && !path.isAbsolute(value);
}

function isIgnoredEvidencePath(value: string): boolean {
  return ignoredPathPatterns.some((pattern) => pattern.test(value));
}

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isCommentSnippet(snippet: string): boolean {
  const trimmed = snippet.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

function isImportOnlySnippet(snippet: string): boolean {
  const trimmed = snippet.trim();
  return /^import\b/.test(trimmed) && !trimmed.includes("await ") && !trimmed.includes("export ") && !/\b\w+\s*\(/.test(trimmed.replace(/import[\s\S]*?from\s+["'][^"']+["'];?/, ""));
}

function concreteEvidence(edge: GraphEdge, evidenceById: Map<string, Evidence>): boolean {
  if (edge.status !== "observed") return true;
  return edge.evidence_refs.some((id) => {
    const evidence = evidenceById.get(id);
    const snippet = evidence?.snippet ?? "";
    if (!evidence || !snippet || isCommentSnippet(snippet) || isImportOnlySnippet(snippet)) return false;
    const hasSymbolCall = Boolean(evidence.symbol && new RegExp(`\\b${escapeRegExp(evidence.symbol)}\\s*\\(`).test(snippet));
    const helperEvidence = /^(Read|Write) helper /.test(evidence.description) && hasSymbolCall;
    const runtimeStorageEvidence =
      evidence.description.includes("repo filesystem storage helpers at runtime") &&
      /\b[a-zA-Z_]\w*\s*\(/.test(snippet) &&
      !/^import\b/.test(snippet.trim());
    if (edge.relation === "runs_script") return /\bnpm run\b/.test(snippet);
    if (edge.relation === "calls_process") return hasSymbolCall;
    if (edge.relation === "calls_external_api") return /OPENAI_API_KEY|api\.openai\.com|\/v1\/images|NEWS_API_KEY|open-meteo/i.test(snippet);
    if (["reads", "writes", "read_by", "uses_database"].includes(edge.relation)) {
      return helperEvidence || runtimeStorageEvidence || /storagePaths\.|readJsonFile|writeJsonFile|readTextFile|readOptionalTextFile|pathExists|listFiles|listGeneratedPoems|listDreams|readVisual|readDailyLife|writeMemoryArchive|public\/generated\/visuals|visualPath|fs\.(readFile|writeFile|access|readdir|mkdir)/.test(snippet);
    }
    if (["collects_from", "fetches_news", "fetches_weather", "uses_mock_source"].includes(edge.relation)) {
      return Boolean(evidence.symbol && snippet.includes(evidence.symbol));
    }
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sensitiveMatches(serializedGraph: string): string[] {
  const checks: Array<[string, RegExp]> = [
    ["email_address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ["unredacted_secret_context", /\$\{\{\s*secrets\.(?!REDACTED\b)[^}]+\}\}/gi],
    ["api_key_value", /\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AIza[0-9A-Za-z_-]{16,})\b/g],
    ["env_assignment", /\b[A-Z0-9_]*(TOKEN|SECRET|API_KEY|COOKIE|SESSION)[A-Z0-9_]*\s*=\s*["']?[^"',\s}]{8,}/g],
    ["oauth_secret", /\b(refresh_token|access_token|client_secret)\b\s*[:=]\s*["'][^"']+["']/gi]
  ];
  return checks.flatMap(([name, pattern]) => [...serializedGraph.matchAll(pattern)].map(() => name));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const issues: Issue[] = [];
  let deterministic = true;

  if (args.includes("--determinism")) {
    runScanner();
    const firstHashes = await hashOutputs();
    runScanner();
    const secondHashes = await hashOutputs();
    deterministic = JSON.stringify(firstHashes) === JSON.stringify(secondHashes);
    if (!deterministic) {
      issues.push({ severity: "error", code: "non_deterministic_outputs", message: "Graph outputs changed across two identical scanner runs.", metadata: { firstHashes, secondHashes } });
    }
  }

  const [nodes, edges, evidence, alerts, summaryText, previewText] = await Promise.all([
    readJson<GraphNode[]>("graph/nodes.json"),
    readJson<GraphEdge[]>("graph/edges.json"),
    readJson<Evidence[]>("graph/evidence.json"),
    readJson<Alert[]>("graph/alerts.json"),
    readOutput("graph/scan-summary.json"),
    readOutput("graph/graph-preview.md")
  ]);

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  for (const node of nodes) {
    if (nodeIds.has(node.id)) issues.push({ severity: "error", code: "duplicate_node_id", message: `Duplicate node id: ${node.id}` });
    nodeIds.add(node.id);
    if (!nodeTypes.has(node.type)) issues.push({ severity: "error", code: "invalid_node_type", message: `Invalid node type: ${node.type}`, metadata: { node: node.id } });
    if (!inRange(node.confidence)) issues.push({ severity: "error", code: "node_confidence_out_of_range", message: `Node confidence is outside 0-1: ${node.id}` });
    if (node.file_path && !isNormalizedPath(node.file_path)) issues.push({ severity: "error", code: "node_path_not_normalized", message: `Node path is not normalized: ${node.file_path}`, metadata: { node: node.id } });
  }

  for (const item of evidence) {
    if (evidenceIds.has(item.id)) issues.push({ severity: "error", code: "duplicate_evidence_id", message: `Duplicate evidence id: ${item.id}` });
    evidenceIds.add(item.id);
    if (!isNormalizedPath(item.source_file)) issues.push({ severity: "error", code: "evidence_path_not_normalized", message: `Evidence path is not normalized: ${item.source_file}`, metadata: { evidence: item.id } });
    if (isIgnoredEvidencePath(item.source_file)) issues.push({ severity: "error", code: "ignored_path_in_evidence", message: `Ignored path leaked into evidence: ${item.source_file}`, metadata: { evidence: item.id } });
  }

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) issues.push({ severity: "error", code: "duplicate_edge_id", message: `Duplicate edge id: ${edge.id}` });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) issues.push({ severity: "error", code: "missing_edge_source", message: `Edge source missing: ${edge.source}`, metadata: { edge: edge.id } });
    if (!nodeIds.has(edge.target)) issues.push({ severity: "error", code: "missing_edge_target", message: `Edge target missing: ${edge.target}`, metadata: { edge: edge.id } });
    if (!edgeStatuses.has(edge.status)) issues.push({ severity: "error", code: "invalid_edge_status", message: `Invalid edge status: ${edge.status}`, metadata: { edge: edge.id } });
    if (!inRange(edge.confidence)) issues.push({ severity: "error", code: "edge_confidence_out_of_range", message: `Edge confidence is outside 0-1: ${edge.id}` });
    for (const evidenceRef of edge.evidence_refs) {
      if (!evidenceIds.has(evidenceRef)) issues.push({ severity: "error", code: "missing_edge_evidence", message: `Edge evidence ref missing: ${evidenceRef}`, metadata: { edge: edge.id } });
    }
    if (edge.status === "observed" && !concreteEvidence(edge, evidenceById)) {
      issues.push({ severity: "error", code: "observed_edge_without_concrete_evidence", message: `Observed edge lacks direct runtime evidence: ${edge.id}`, metadata: { evidence_refs: edge.evidence_refs } });
    }
  }

  for (const alert of alerts) {
    if (!alertSeverities.has(alert.severity)) issues.push({ severity: "error", code: "invalid_alert_severity", message: `Invalid alert severity: ${alert.severity}`, metadata: { alert: alert.id } });
    for (const evidenceRef of alert.evidence_refs) {
      if (!evidenceIds.has(evidenceRef)) issues.push({ severity: "error", code: "missing_alert_evidence", message: `Alert evidence ref missing: ${evidenceRef}`, metadata: { alert: alert.id } });
    }
  }

  const edgeSignatures = edges.map((edge) => `${edge.source}|${edge.target}|${edge.relation}`);
  const duplicateSignatures = edgeSignatures.filter((signature, index) => edgeSignatures.indexOf(signature) !== index);
  for (const signature of new Set(duplicateSignatures)) {
    issues.push({ severity: "error", code: "duplicate_edge_signature", message: `Duplicate edge signature: ${signature}` });
  }

  const serializedGraph = [JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(evidence), JSON.stringify(alerts), summaryText, previewText].join("\n");
  const sensitive = [...new Set(sensitiveMatches(serializedGraph))];
  if (sensitive.length > 0) {
    issues.push({ severity: "error", code: "sensitive_data_in_graph", message: "Potential sensitive data found in graph outputs.", metadata: { match_types: sensitive } });
  }

  const summary = JSON.parse(summaryText) as { counts?: Record<string, number>; gmail?: Record<string, unknown> };
  const result = {
    valid: !issues.some((issue) => issue.severity === "error"),
    deterministic,
    issue_count: issues.length,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
    counts: summary.counts ?? null,
    gmail: summary.gmail ?? null
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "repo_graph_validation", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
