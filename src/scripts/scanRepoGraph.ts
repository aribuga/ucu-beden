import { promises as fs } from "node:fs";
import path from "node:path";

type NodeType = "scheduler" | "script" | "process" | "data_store" | "database" | "external_source" | "output";
type EdgeStatus = "observed" | "inferred" | "planned" | "broken";
type AlertSeverity = "info" | "warning" | "error";

type GraphNode = {
  id: string;
  label: string;
  type: NodeType;
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
  status: EdgeStatus;
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
  severity: AlertSeverity;
  type: string;
  title: string;
  description: string;
  evidence_refs: string[];
  metadata: Record<string, unknown>;
};

type StoragePath = {
  key: string;
  relativePath: string;
  line: number;
};

type PackageScript = {
  name: string;
  command: string;
  entrypoint: string | null;
  line: number;
};

const repoRoot = process.cwd();
const graphDir = "graph";
const ignoredDirs = new Set([".git", ".next", "node_modules", "out", "coverage", "dist", "__tests__", "fixtures", "tmp", "temp"]);
const ignoredFilePatterns = [/^\.env($|\.)/, /secret/i, /token/i, /\.test\./, /\.spec\./, /\.bak$/, /backup/i, /copy/i, /demo/i];
const storageHelperReads: Record<string, string[]> = {
  getLatestDream: ["dreams"],
  getLatestPoem: ["generatedPoems"],
  listDreams: ["dreams"],
  listGeneratedPoems: ["generatedPoems"],
  listMemoryTraceFiles: ["memoryTraces"],
  listMemoryTraces: ["memoryTraces"],
  listSourceDigests: ["sourceDigests"],
  listSources: ["sources"],
  listYearlyReports: ["yearlyReports"],
  readDailyLife: ["dailyLife"],
  readInputAnalysis: ["inputAnalysis"],
  readMemoryIndex: ["memoryIndex"],
  readMemoryReport: ["memoryReport"],
  readPersonalitySettings: ["personalitySettings"],
  readRssSources: ["rssSources"],
  readSiteSettings: ["siteSettings"],
  readSourceDigest: ["sourceDigests"],
  readState: ["state"],
  readVisual: ["visuals"],
  readWorld: ["world"]
};
const storageHelperWrites: Record<string, string[]> = {
  writeMemoryArchive: ["memoryTraces", "memoryIndex", "memoryReport"]
};
const processOutputHints: Record<string, Array<{ target: string; relation: string; status: EdgeStatus; confidence: number }>> = {
  analyzeAndSaveInputPoems: [{ target: "inputAnalysis", relation: "writes", status: "inferred", confidence: 0.72 }],
  buildMemoryArchive: [
    { target: "generatedPoems", relation: "reads", status: "inferred", confidence: 0.78 },
    { target: "dreams", relation: "reads", status: "inferred", confidence: 0.78 },
    { target: "dailyLife", relation: "reads", status: "inferred", confidence: 0.78 },
    { target: "sources", relation: "reads", status: "inferred", confidence: 0.78 },
    { target: "sourceDigests", relation: "reads", status: "inferred", confidence: 0.78 }
  ],
  collectSources: [{ target: "sources", relation: "produces_in_memory", status: "observed", confidence: 0.78 }],
  ensureSourceDigest: [{ target: "sourceDigests", relation: "writes", status: "inferred", confidence: 0.72 }],
  generateVisualImage: [{ target: "public/generated/visuals", relation: "writes", status: "observed", confidence: 0.86 }],
  maybeCreateYearlyReport: [{ target: "yearlyReports", relation: "writes", status: "inferred", confidence: 0.76 }],
  updateMemoryAfterPoem: [
    { target: "state", relation: "writes", status: "inferred", confidence: 0.72 },
    { target: "vocabularyMemory", relation: "writes", status: "inferred", confidence: 0.72 },
    { target: "imageMutations", relation: "writes", status: "inferred", confidence: 0.72 }
  ],
  writeMemoryArchive: [
    { target: "memoryTraces", relation: "writes", status: "observed", confidence: 0.85 },
    { target: "memoryIndex", relation: "writes", status: "observed", confidence: 0.85 },
    { target: "memoryReport", relation: "writes", status: "observed", confidence: 0.85 }
  ]
};

class GraphBuilder {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, GraphEdge>();
  readonly evidence: Evidence[] = [];
  readonly alerts: Alert[] = [];

  addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (!existing) {
      this.nodes.set(node.id, node);
      return;
    }
    this.nodes.set(node.id, {
      ...existing,
      ...node,
      active: existing.active || node.active,
      confidence: Math.max(existing.confidence, node.confidence),
      metadata: { ...existing.metadata, ...node.metadata }
    });
  }

  addEvidence(input: Omit<Evidence, "id">): string {
    const id = `ev-${String(this.evidence.length + 1).padStart(4, "0")}`;
    this.evidence.push({
      id,
      source_file: input.source_file,
      line: input.line,
      symbol: input.symbol,
      snippet: input.snippet ? sanitizeSnippet(input.snippet, input.symbol) : null,
      description: input.description
    });
    return id;
  }

  addEdge(edge: Omit<GraphEdge, "id" | "evidence_refs"> & { evidence_refs?: string[] }): void {
    const id = `${edge.source} -> ${edge.target} :: ${edge.relation}`;
    const existing = this.edges.get(id);
    if (!existing) {
      this.edges.set(id, { ...edge, id, evidence_refs: edge.evidence_refs ?? [] });
      return;
    }
    this.edges.set(id, {
      ...existing,
      status: mergeStatus(existing.status, edge.status),
      confidence: Math.max(existing.confidence, edge.confidence),
      evidence_refs: unique([...existing.evidence_refs, ...(edge.evidence_refs ?? [])])
    });
  }

  addAlert(input: Omit<Alert, "id">): void {
    const id = `alert-${String(this.alerts.length + 1).padStart(3, "0")}`;
    this.alerts.push({ ...input, id });
  }
}

function mergeStatus(a: EdgeStatus, b: EdgeStatus): EdgeStatus {
  const rank: Record<EdgeStatus, number> = { observed: 4, inferred: 3, planned: 2, broken: 1 };
  return rank[a] >= rank[b] ? a : b;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function toRel(absoluteOrRelativePath: string): string {
  const relative = path.isAbsolute(absoluteOrRelativePath)
    ? path.relative(repoRoot, absoluteOrRelativePath)
    : absoluteOrRelativePath;
  return relative.replaceAll("\\", "/");
}

function toAbs(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function nodeId(prefix: string, value: string): string {
  return `${prefix}:${value.replaceAll("\\", "/")}`;
}

function dataNodeId(relativePath: string): string {
  return nodeId("data", relativePath);
}

function storageDataNodeId(storagePaths: Map<string, StoragePath>, key: string): string | null {
  const storagePath = storagePaths.get(key);
  return storagePath ? dataNodeId(storagePath.relativePath) : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeSnippet(snippet: string, symbol?: string | null): string {
  let compact = snippet.replace(/\s+/g, " ").trim();
  if (symbol && compact.length > 260) {
    const callIndex = compact.search(new RegExp(`\\b${escapeRegExp(symbol)}\\s*\\(`));
    const symbolIndex = callIndex >= 0 ? callIndex : compact.indexOf(symbol);
    if (symbolIndex >= 0) {
      const start = Math.max(0, symbolIndex - 90);
      const end = Math.min(compact.length, symbolIndex + 190);
      compact = `${start > 0 ? "... " : ""}${compact.slice(start, end)}${end < compact.length ? " ..." : ""}`;
    }
  }
  return compact
    .replace(/\$\{\{\s*secrets\.[^}]+\}\}/g, "${{ secrets.REDACTED }}")
    .replace(/(api[_-]?key|token|secret)(\s*[:=]\s*)["'][^"']+["']/gi, "$1$2\"REDACTED\"")
    .slice(0, 260);
}

function lineNumber(lines: string[], predicate: (line: string) => boolean): number | null {
  const index = lines.findIndex(predicate);
  return index >= 0 ? index + 1 : null;
}

function lineText(lines: string[], line: number | null): string | null {
  return line ? lines[line - 1] ?? null : null;
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

function isImportOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("import ") && !trimmed.includes("export ");
}

function isIgnoredPath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  return parts.some((part) => ignoredDirs.has(part)) || ignoredFilePatterns.some((pattern) => pattern.test(path.basename(relativePath)));
}

function isGraphObserverPath(relativePath: string): boolean {
  return (
    relativePath.startsWith("src/app/anatomy/") ||
    relativePath.startsWith("src/components/anatomy/") ||
    relativePath.startsWith("src/lib/anatomyGraph") ||
    relativePath === "src/scripts/testAnatomyUi.ts" ||
    relativePath === "src/scripts/validateRepoGraph.ts"
  );
}

function isGmailImplementationSearchPath(relativePath: string): boolean {
  if (isGraphObserverPath(relativePath)) return false;
  if (relativePath.startsWith("docs/") || relativePath === "README.md") return false;
  return (
    relativePath === "package.json" ||
    relativePath.startsWith(".github/") ||
    relativePath.startsWith("src/lib/") ||
    relativePath.startsWith("src/scripts/") ||
    relativePath.startsWith("data/settings/")
  );
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(toAbs(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(toAbs(relativePath), "utf8");
}

async function listFilesRecursive(relativeDir: string): Promise<string[]> {
  const absoluteDir = toAbs(relativeDir);
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = toRel(path.join(relativeDir, entry.name));
      if (isIgnoredPath(relativePath)) return [];
      if (entry.isDirectory()) return listFilesRecursive(relativePath);
      return [relativePath];
    })
  );
  return files.flat().sort();
}

async function immediateFileStats(relativePath: string): Promise<Record<string, unknown>> {
  if (!(await pathExists(relativePath))) return { exists: false, file_count: 0 };
  const stat = await fs.stat(toAbs(relativePath));
  if (stat.isFile()) return { exists: true, kind: "file", size_bytes: stat.size };
  const entries = await fs.readdir(toAbs(relativePath), { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const jsonFiles = files.filter((file) => file.endsWith(".json"));
  const dateLike = jsonFiles.map((file) => file.match(/\d{4}-\d{2}-\d{2}/)?.[0]).filter((date): date is string => Boolean(date)).sort();
  return {
    exists: true,
    kind: "directory",
    file_count: files.length,
    json_count: jsonFiles.length,
    date_range: dateLike.length > 0 ? { first: dateLike[0], last: dateLike.at(-1) } : null
  };
}

function parseStoragePaths(fileStorageText: string): StoragePath[] {
  const lines = fileStorageText.split(/\r?\n/);
  const objectMatch = fileStorageText.match(/export const storagePaths = \{([\s\S]*?)\} as const;/);
  if (!objectMatch) return [];
  const storageLine = lineNumber(lines, (line) => line.includes("export const storagePaths")) ?? 1;
  return [...objectMatch[1].matchAll(/(\w+):"([^"]+)"/g)].map((match) => ({
    key: match[1],
    relativePath: match[2],
    line: storageLine
  }));
}

async function scanStorage(builder: GraphBuilder): Promise<Map<string, StoragePath>> {
  const file = "src/lib/fileStorage.ts";
  const text = await readText(file);
  const lines = text.split(/\r?\n/);
  const storagePaths = parseStoragePaths(text);
  const map = new Map(storagePaths.map((item) => [item.key, item]));
  const evidenceRef = builder.addEvidence({
    source_file: file,
    line: lineNumber(lines, (line) => line.includes("export const storagePaths")),
    symbol: "storagePaths",
    snippet: lineText(lines, lineNumber(lines, (line) => line.includes("export const storagePaths"))),
    description: "Canonical repo storage path declarations."
  });

  builder.addNode({
    id: "db:json-filesystem",
    label: "JSON filesystem storage",
    type: "database",
    file_path: "data",
    active: await pathExists("data"),
    detection_method: "fileStorage storagePaths",
    confidence: 0.94,
    metadata: { storage_path_count: storagePaths.length }
  });

  for (const item of storagePaths) {
    builder.addNode({
      id: dataNodeId(item.relativePath),
      label: item.relativePath,
      type: "data_store",
      file_path: item.relativePath,
      active: await pathExists(item.relativePath),
      detection_method: "fileStorage storagePaths",
      confidence: 0.94,
      metadata: {
        storage_key: item.key,
        ...(await immediateFileStats(item.relativePath)),
        evidence_ref: evidenceRef
      }
    });
  }

  const publicVisualPath = "public/generated/visuals";
  builder.addNode({
    id: dataNodeId(publicVisualPath),
    label: publicVisualPath,
    type: "output",
    file_path: publicVisualPath,
    active: await pathExists(publicVisualPath),
    detection_method: "known image output path from image provider/workflows",
    confidence: 0.82,
    metadata: await immediateFileStats(publicVisualPath)
  });

  return map;
}

async function parsePackageScripts(builder: GraphBuilder): Promise<{ scripts: PackageScript[]; entrypointToScript: Map<string, string> }> {
  const file = "package.json";
  const text = await readText(file);
  const lines = text.split(/\r?\n/);
  const packageJson = JSON.parse(text) as { scripts?: Record<string, string> };
  const scripts = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => {
    const line = lineNumber(lines, (candidate) => candidate.includes(`"${name}"`)) ?? 1;
    return {
      name,
      command,
      entrypoint: command.match(/src\/scripts\/[\w.-]+\.ts/)?.[0] ?? null,
      line
    };
  });
  const entrypointToScript = new Map<string, string>();

  for (const script of scripts) {
    const evidenceRef = builder.addEvidence({
      source_file: file,
      line: script.line,
      symbol: `npm:${script.name}`,
      snippet: lineText(lines, script.line),
      description: `Package script "${script.name}" is declared.`
    });
    const id = nodeId("script", script.name);
    if (script.entrypoint) entrypointToScript.set(script.entrypoint, id);
    builder.addNode({
      id,
      label: `npm run ${script.name}`,
      type: "script",
      file_path: script.entrypoint ?? file,
      active: !script.name.startsWith("debug:"),
      detection_method: "package.json scripts",
      confidence: 0.95,
      metadata: {
        npm_script: script.name,
        command: sanitizeSnippet(script.command),
        entrypoint: script.entrypoint,
        evidence_ref: evidenceRef
      }
    });

    for (const nested of script.command.matchAll(/npm run ([\w:-]+)/g)) {
      const targetScript = nested[1];
      builder.addEdge({
        source: id,
        target: nodeId("script", targetScript),
        relation: "runs_script",
        status: "observed",
        confidence: 0.94,
        evidence_refs: [evidenceRef]
      });
    }
  }

  return { scripts, entrypointToScript };
}

async function scanWorkflowSchedulers(builder: GraphBuilder, packageScripts: Set<string>): Promise<void> {
  const workflowFiles = (await listFilesRecursive(".github/workflows")).filter((file) => /\.(ya?ml)$/.test(file));
  for (const file of workflowFiles) {
    const text = await readText(file);
    const lines = text.split(/\r?\n/);
    const triggerLine = lineNumber(lines, (line) => /^on:/.test(line.trim()));
    const triggers = ["schedule", "workflow_dispatch", "push", "pull_request"].filter((trigger) => text.includes(`${trigger}:`));
    const scheduleCrons = [...text.matchAll(/cron:\s*"([^"]+)"/g)].map((match) => match[1]);
    const schedulerId = nodeId("scheduler", file);
    const evidenceRef = builder.addEvidence({
      source_file: file,
      line: triggerLine,
      symbol: "on",
      snippet: lineText(lines, triggerLine),
      description: "GitHub Actions workflow trigger declaration."
    });
    builder.addNode({
      id: schedulerId,
      label: path.basename(file),
      type: "scheduler",
      file_path: file,
      active: triggers.length > 0,
      detection_method: "GitHub Actions workflow",
      confidence: 0.96,
      metadata: { triggers, schedule_crons: scheduleCrons, evidence_ref: evidenceRef }
    });

    lines.forEach((line, index) => {
      for (const match of line.matchAll(/npm run ([\w:-]+)/g)) {
        const scriptName = match[1];
        const scriptId = nodeId("script", scriptName);
        const runEvidence = builder.addEvidence({
          source_file: file,
          line: index + 1,
          symbol: `npm:${scriptName}`,
          snippet: line,
          description: `Workflow runs package script "${scriptName}".`
        });
        if (!packageScripts.has(scriptName)) {
          builder.addNode({
            id: scriptId,
            label: `missing npm script ${scriptName}`,
            type: "script",
            file_path: "package.json",
            active: false,
            detection_method: "workflow command without matching package script",
            confidence: 0.2,
            metadata: { missing: true }
          });
          builder.addAlert({
            severity: "error",
            type: "missing_script_target",
            title: `Workflow references missing npm script: ${scriptName}`,
            description: `${file} runs npm script "${scriptName}", but package.json does not declare it.`,
            evidence_refs: [runEvidence],
            metadata: { workflow: file, npm_script: scriptName }
          });
        }
        builder.addEdge({
          source: schedulerId,
          target: scriptId,
          relation: "runs_script",
          status: packageScripts.has(scriptName) ? "observed" : "broken",
          confidence: packageScripts.has(scriptName) ? 0.96 : 0.92,
          evidence_refs: [runEvidence]
        });
      }
    });
  }
}

function actorNodeForSourceFile(file: string, entrypointToScript: Map<string, string>): { id: string; type: NodeType; label: string; active: boolean } {
  const scriptId = entrypointToScript.get(file);
  if (scriptId) return { id: scriptId, type: "script", label: `npm script for ${path.basename(file)}`, active: true };
  if (file.startsWith("src/scripts/")) {
    const name = path.basename(file, ".ts");
    return { id: nodeId("script-file", name), type: "script", label: name, active: !name.startsWith("debug") };
  }
  if (file.startsWith("src/app/")) return { id: nodeId("ui-route", file), type: "process", label: file, active: true };
  if (file.startsWith("src/components/")) return { id: nodeId("ui-component", file), type: "process", label: file, active: true };
  return { id: nodeId("process-module", file), type: "process", label: file, active: true };
}

function addReadEdge(builder: GraphBuilder, actorId: string, targetId: string, evidenceRef: string, status: EdgeStatus, confidence: number): void {
  builder.addEdge({ source: actorId, target: targetId, relation: "reads", status, confidence, evidence_refs: [evidenceRef] });
  builder.addEdge({ source: targetId, target: actorId, relation: "read_by", status, confidence, evidence_refs: [evidenceRef] });
}

function addWriteEdge(builder: GraphBuilder, actorId: string, targetId: string, evidenceRef: string, status: EdgeStatus, confidence: number): void {
  builder.addEdge({ source: actorId, target: targetId, relation: "writes", status, confidence, evidence_refs: [evidenceRef] });
}

function importedLibFunctions(text: string): Array<{ functionName: string; libFile: string; importLine: number | null }> {
  const result: Array<{ functionName: string; libFile: string; importLine: number | null }> = [];
  const lines = text.split(/\r?\n/);
  for (const match of text.matchAll(/import\s+\{([\s\S]*?)\}\s+from\s+"..\/lib\/([^"]+)";/g)) {
    const imports = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim());
    const importLine = lineNumber(lines, (line) => line.includes(`../lib/${match[2]}`));
    for (const functionName of imports) {
      result.push({ functionName, libFile: `src/lib/${match[2]}.ts`, importLine });
    }
  }
  return result;
}

function storageVariableTargets(lines: string[], storagePaths: Map<string, StoragePath>): Map<string, string> {
  const variables = new Map<string, string>();
  lines.forEach((line) => {
    const variableMatch = line.match(/\b(?:const|let)\s+(\w+)\s*=\s*`?\$\{?storagePaths\.(\w+)\}?/);
    if (variableMatch && storagePaths.has(variableMatch[2])) variables.set(variableMatch[1], variableMatch[2]);
  });
  return variables;
}

function firstRuntimeStorageLine(lines: string[]): number | null {
  const helperNames = unique([
    ...Object.keys(storageHelperReads),
    ...Object.keys(storageHelperWrites),
    "readJsonFile",
    "writeJsonFile",
    "readTextFile",
    "readOptionalTextFile",
    "pathExists",
    "listFiles"
  ]);
  return lineNumber(lines, (line) => {
    if (isCommentLine(line) || isImportOnlyLine(line)) return false;
    return line.includes("storagePaths.") || helperNames.some((helper) => new RegExp(`\\b${helper}\\s*\\(`).test(line));
  });
}

async function scanSourceFile(
  builder: GraphBuilder,
  file: string,
  storagePaths: Map<string, StoragePath>,
  entrypointToScript: Map<string, string>
): Promise<void> {
  const text = await readText(file);
  const lines = text.split(/\r?\n/);
  const actor = actorNodeForSourceFile(file, entrypointToScript);
  const referencesStorage = text.includes("storagePaths") || Object.keys(storageHelperReads).some((helper) => text.includes(`${helper}(`));
  const hasMeaningfulProcessImports = importedLibFunctions(text).some((item) => item.libFile !== "src/lib/fileStorage.ts" && text.includes(`${item.functionName}(`));

  if (!referencesStorage && !hasMeaningfulProcessImports && !file.startsWith("src/scripts/")) return;

  builder.addNode({
    id: actor.id,
    label: actor.label,
    type: actor.type,
    file_path: file,
    active: actor.active,
    detection_method: file.startsWith("src/scripts/") ? "source script file" : "source file storage/process reference",
    confidence: 0.8,
    metadata: { source_file: file }
  });

  if (referencesStorage) {
    const runtimeStorageLine = firstRuntimeStorageLine(lines);
    if (runtimeStorageLine) {
    const evidenceRef = builder.addEvidence({
      source_file: file,
      line: runtimeStorageLine,
      symbol: "fileStorage",
      snippet: lineText(lines, runtimeStorageLine),
      description: "Source file uses repo filesystem storage helpers at runtime."
    });
    builder.addEdge({
      source: actor.id,
      target: "db:json-filesystem",
      relation: "uses_database",
      status: "observed",
      confidence: 0.82,
      evidence_refs: [evidenceRef]
    });
    }
  }

  const variableTargets = storageVariableTargets(lines, storagePaths);
  if (file === "src/scripts/backfillVisuals.ts") {
    variableTargets.set("visualPath", "visuals");
  }
  lines.forEach((line, index) => {
    if (isCommentLine(line) || isImportOnlyLine(line)) return;
    const lineNo = index + 1;
    const lineStorageKeys = [...line.matchAll(/storagePaths\.(\w+)/g)].map((match) => match[1]).filter((key) => storagePaths.has(key));
    const readLike = /\b(readJsonFile|pathExists|readTextFile|readOptionalTextFile|listFiles|fs\.readFile|fs\.access|fs\.readdir|visualImageIsUsable|reconcileVisualImagePath)\b/.test(line);
    const writeLike = /\b(writeJsonFile|writeTextFile|fs\.writeFile|fs\.mkdir)\b/.test(line);

    for (const key of lineStorageKeys) {
      const targetId = storageDataNodeId(storagePaths, key);
      if (!targetId) continue;
      const evidenceRef = builder.addEvidence({
        source_file: file,
        line: lineNo,
        symbol: `storagePaths.${key}`,
        snippet: line,
        description: `Direct storagePaths.${key} reference.`
      });
      if (writeLike) addWriteEdge(builder, actor.id, targetId, evidenceRef, "observed", 0.88);
      if (readLike || !writeLike) addReadEdge(builder, actor.id, targetId, evidenceRef, "observed", readLike ? 0.88 : 0.66);
    }

    for (const [variable, key] of variableTargets) {
      if (!new RegExp(`\\b${variable}\\b`).test(line)) continue;
      const targetId = storageDataNodeId(storagePaths, key);
      if (!targetId) continue;
      const evidenceRef = builder.addEvidence({
        source_file: file,
        line: lineNo,
        symbol: variable,
        snippet: line,
        description: `Storage path variable "${variable}" points to storagePaths.${key}.`
      });
      if (writeLike) addWriteEdge(builder, actor.id, targetId, evidenceRef, "observed", 0.86);
      if (readLike || /\bexists\b/i.test(line)) addReadEdge(builder, actor.id, targetId, evidenceRef, "observed", 0.82);
    }

    for (const [helper, targets] of Object.entries(storageHelperReads)) {
      if (!new RegExp(`\\b${helper}\\s*\\(`).test(line)) continue;
      const evidenceRef = builder.addEvidence({
        source_file: file,
        line: lineNo,
        symbol: helper,
        snippet: line,
        description: `Read helper "${helper}" is called.`
      });
      for (const key of targets) {
        const targetId = storageDataNodeId(storagePaths, key);
        if (targetId) addReadEdge(builder, actor.id, targetId, evidenceRef, "observed", 0.9);
      }
    }

    for (const [helper, targets] of Object.entries(storageHelperWrites)) {
      if (!new RegExp(`\\b${helper}\\s*\\(`).test(line)) continue;
      const evidenceRef = builder.addEvidence({
        source_file: file,
        line: lineNo,
        symbol: helper,
        snippet: line,
        description: `Write helper "${helper}" is called.`
      });
      for (const key of targets) {
        const targetId = storageDataNodeId(storagePaths, key);
        if (targetId) addWriteEdge(builder, actor.id, targetId, evidenceRef, "observed", 0.88);
      }
    }
  });

  for (const imported of importedLibFunctions(text)) {
    if (imported.libFile === "src/lib/fileStorage.ts") continue;
    const callLine = lineNumber(lines, (line) => new RegExp(`\\b${imported.functionName}\\s*\\(`).test(line));
    if (!callLine) continue;
    const processId = nodeId("process", imported.functionName);
    const evidenceRef = builder.addEvidence({
      source_file: file,
      line: callLine,
      symbol: imported.functionName,
      snippet: lineText(lines, callLine),
      description: `Source file calls imported process "${imported.functionName}".`
    });
    builder.addNode({
      id: processId,
      label: imported.functionName,
      type: "process",
      file_path: imported.libFile,
      active: true,
      detection_method: "imported lib function call",
      confidence: 0.82,
      metadata: { imported_from: imported.libFile, import_line: imported.importLine }
    });
    builder.addEdge({
      source: actor.id,
      target: processId,
      relation: "calls_process",
      status: "observed",
      confidence: 0.86,
      evidence_refs: [evidenceRef]
    });

    for (const hint of processOutputHints[imported.functionName] ?? []) {
      const targetId = hint.target === "public/generated/visuals" ? dataNodeId(hint.target) : storageDataNodeId(storagePaths, hint.target);
      if (!targetId) continue;
      builder.addEdge({
        source: processId,
        target: targetId,
        relation: hint.relation,
        status: hint.status,
        confidence: hint.confidence,
        evidence_refs: [evidenceRef]
      });
      if (hint.relation === "reads") {
        builder.addEdge({
          source: targetId,
          target: processId,
          relation: "read_by",
          status: hint.status,
          confidence: hint.confidence,
          evidence_refs: [evidenceRef]
        });
      }
    }
  }
}

async function scanExternalSources(builder: GraphBuilder): Promise<void> {
  const sourceCollectors = "src/lib/sourceCollectors.ts";
  const openaiImageProvider = "src/lib/openaiImageProvider.ts";
  const openaiTextFiles = ["src/lib/poemGenerator.ts", "src/lib/dreamEngine.ts", "src/lib/sourceDigestion.ts", "src/lib/visualBriefGenerator.ts"];

  for (const external of [
    { id: "external:rss", label: "RSS feeds", file: sourceCollectors, pattern: "readRssSources", process: "collectRss", relation: "collects_from" },
    { id: "external:open-meteo", label: "Open-Meteo weather", file: sourceCollectors, pattern: "open-meteo.com", process: "collectWeather", relation: "fetches_weather" },
    { id: "external:newsapi", label: "NewsAPI", file: sourceCollectors, pattern: "NEWS_API_KEY", process: "collectTurkeyNews", relation: "fetches_news" },
    { id: "external:mock-art", label: "Mock art source", file: sourceCollectors, pattern: "collectArtWorld", process: "collectArtWorld", relation: "uses_mock_source" }
  ]) {
    const text = await readText(external.file);
    const lines = text.split(/\r?\n/);
    const line = lineNumber(lines, (candidate) => !isImportOnlyLine(candidate) && !isCommentLine(candidate) && candidate.includes(external.pattern));
    const evidenceRef = builder.addEvidence({
      source_file: external.file,
      line,
      symbol: external.pattern,
      snippet: lineText(lines, line),
      description: `${external.label} source is referenced by source collection code.`
    });
    const processId = nodeId("process", external.process);
    builder.addNode({
      id: processId,
      label: external.process,
      type: "process",
      file_path: external.file,
      active: true,
      detection_method: "source collector function",
      confidence: 0.78,
      metadata: { evidence_ref: evidenceRef }
    });
    builder.addNode({
      id: external.id,
      label: external.label,
      type: "external_source",
      file_path: external.file,
      active: true,
      detection_method: "source collector code reference",
      confidence: 0.82,
      metadata: { evidence_ref: evidenceRef }
    });
    builder.addEdge({
      source: processId,
      target: external.id,
      relation: external.relation,
      status: "observed",
      confidence: 0.82,
      evidence_refs: [evidenceRef]
    });
  }

  const imageText = await readText(openaiImageProvider);
  const imageLines = imageText.split(/\r?\n/);
  const imageLine = lineNumber(imageLines, (line) => line.includes("/v1/images/generations") || line.includes("OPENAI_API_KEY"));
  const imageEvidence = builder.addEvidence({
    source_file: openaiImageProvider,
    line: imageLine,
    symbol: "OpenAI Images",
    snippet: lineText(imageLines, imageLine),
    description: "Image provider references OpenAI image generation."
  });
  builder.addNode({
    id: "external:openai-images",
    label: "OpenAI Images API",
    type: "external_source",
    file_path: openaiImageProvider,
    active: true,
    detection_method: "OpenAI image provider code reference",
    confidence: 0.86,
    metadata: { evidence_ref: imageEvidence }
  });
  builder.addEdge({
    source: nodeId("process", "generateVisualImage"),
    target: "external:openai-images",
    relation: "calls_external_api",
    status: "observed",
    confidence: 0.86,
    evidence_refs: [imageEvidence]
  });
  const writeLine = lineNumber(imageLines, (line) => line.includes("public/generated/visuals") || line.includes("fs.writeFile"));
  if (writeLine) {
    const writeEvidence = builder.addEvidence({
      source_file: openaiImageProvider,
      line: writeLine,
      symbol: "public/generated/visuals",
      snippet: lineText(imageLines, writeLine),
      description: "Image provider writes generated image files under public/generated/visuals."
    });
    builder.addEdge({
      source: nodeId("process", "generateVisualImage"),
      target: dataNodeId("public/generated/visuals"),
      relation: "writes",
      status: "observed",
      confidence: 0.9,
      evidence_refs: [writeEvidence]
    });
  }

  for (const file of openaiTextFiles) {
    if (!(await pathExists(file))) continue;
    const text = await readText(file);
    if (!text.includes("OPENAI_API_KEY") && !text.includes("api.openai.com")) continue;
    const lines = text.split(/\r?\n/);
    const line = lineNumber(lines, (candidate) => candidate.includes("OPENAI_API_KEY") || candidate.includes("api.openai.com"));
    const evidenceRef = builder.addEvidence({
      source_file: file,
      line,
      symbol: "OpenAI text",
      snippet: lineText(lines, line),
      description: "Text generation module references OpenAI."
    });
    const processModuleId = nodeId("process-module", file);
    builder.addNode({
      id: processModuleId,
      label: file,
      type: "process",
      file_path: file,
      active: true,
      detection_method: "OpenAI text provider code reference",
      confidence: 0.74,
      metadata: { evidence_ref: evidenceRef }
    });
    builder.addNode({
      id: "external:openai-text",
      label: "OpenAI text API",
      type: "external_source",
      file_path: file,
      active: true,
      detection_method: "OpenAI text provider code reference",
      confidence: 0.84,
      metadata: { evidence_ref: evidenceRef }
    });
    builder.addEdge({
      source: processModuleId,
      target: "external:openai-text",
      relation: "calls_external_api",
      status: "observed",
      confidence: 0.78,
      evidence_refs: [evidenceRef]
    });
  }
}

async function scanVisualImageConsumption(builder: GraphBuilder): Promise<void> {
  const file = "src/components/VisualField.tsx";
  if (!(await pathExists(file))) return;
  const text = await readText(file);
  if (!text.includes("image_path") || !text.includes("<img")) return;
  const lines = text.split(/\r?\n/);
  const line = lineNumber(lines, (candidate) => candidate.includes("imageSource") || candidate.includes("<img"));
  const evidenceRef = builder.addEvidence({
    source_file: file,
    line,
    symbol: "image_path",
    snippet: lineText(lines, line),
    description: "VisualField resolves visual.image_path into an image source for rendering."
  });
  const componentId = nodeId("ui-component", file);
  const outputId = dataNodeId("public/generated/visuals");
  builder.addNode({
    id: componentId,
    label: file,
    type: "process",
    file_path: file,
    active: true,
    detection_method: "visual image_path render",
    confidence: 0.72,
    metadata: { evidence_ref: evidenceRef }
  });
  builder.addEdge({
    source: componentId,
    target: outputId,
    relation: "reads",
    status: "inferred",
    confidence: 0.72,
    evidence_refs: [evidenceRef]
  });
  builder.addEdge({
    source: outputId,
    target: componentId,
    relation: "read_by",
    status: "inferred",
    confidence: 0.72,
    evidence_refs: [evidenceRef]
  });
}

async function scanGmailStatus(builder: GraphBuilder): Promise<void> {
  const files = (await listFilesRecursive(".")).filter((file) =>
    /\.(ts|tsx|js|mjs|cjs|json|ya?ml|md)$/.test(file) &&
    !file.startsWith("data/") &&
    !file.startsWith("graph/") &&
    file !== "src/scripts/scanRepoGraph.ts" &&
    isGmailImplementationSearchPath(file) &&
    !isIgnoredPath(file)
  );
  const matches: Array<{ file: string; line: number; snippet: string }> = [];
  for (const file of files) {
    const text = await readText(file);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/git config user\.email/.test(line)) return;
      if (/\b(gmail|imap|inbox|mailbox|external_intake)\b/i.test(line)) {
        matches.push({ file, line: index + 1, snippet: sanitizeSnippet(line) });
      }
    });
  }

  builder.addNode({
    id: "external:gmail",
    label: "Gmail intake",
    type: "external_source",
    file_path: null,
    active: matches.length > 0,
    detection_method: matches.length > 0 ? "keyword match in non-data repo files" : "negative code search",
    confidence: matches.length > 0 ? 0.45 : 0.08,
    metadata: {
      observed_implementation: matches.length > 0,
      match_count: matches.length,
      memory_connection_observed: false,
      status: matches.length > 0 ? "ambiguous_keyword_matches_only" : "not_observed_in_repo"
    }
  });

  if (matches.length === 0) {
    builder.addAlert({
      severity: "info",
      type: "gmail_not_observed",
      title: "Gmail node has no observed repo implementation",
      description: "No Gmail, IMAP, inbox, mailbox, or external_intake implementation was found in source, workflow, package, or settings files.",
      evidence_refs: [],
      metadata: { gmail_active: false, memory_connection_observed: false }
    });
    return;
  }

  const evidenceRefs = matches.slice(0, 8).map((match) =>
    builder.addEvidence({
      source_file: match.file,
      line: match.line,
      symbol: "gmail-keyword",
      snippet: match.snippet,
      description: "Ambiguous Gmail/mail intake keyword match."
    })
  );
  builder.addAlert({
    severity: "warning",
    type: "gmail_ambiguous",
    title: "Gmail status is ambiguous",
    description: "Gmail-like keywords exist, but the scanner did not verify a complete memory ingestion path.",
    evidence_refs: evidenceRefs,
    metadata: { match_count: matches.length, memory_connection_observed: false }
  });
}

async function scanDataHealth(builder: GraphBuilder, storagePaths: Map<string, StoragePath>): Promise<void> {
  const listJsonDates = async (key: string): Promise<string[]> => {
    const storage = storagePaths.get(key);
    if (!storage || !(await pathExists(storage.relativePath))) return [];
    const stat = await fs.stat(toAbs(storage.relativePath));
    if (!stat.isDirectory()) return [];
    const entries = await fs.readdir(toAbs(storage.relativePath));
    return entries.map((file) => file.match(/\d{4}-\d{2}-\d{2}/)?.[0]).filter((date): date is string => Boolean(date)).sort();
  };

  const [poemDates, dreamDates, dailyLifeDates, sourceDates, digestDates, visualFiles] = await Promise.all([
    listJsonDates("generatedPoems"),
    listJsonDates("dreams"),
    listJsonDates("dailyLife"),
    listJsonDates("sources"),
    listJsonDates("sourceDigests"),
    storagePaths.get("visuals") && (await pathExists(storagePaths.get("visuals")!.relativePath))
      ? fs.readdir(toAbs(storagePaths.get("visuals")!.relativePath))
      : Promise.resolve([])
  ]);
  const digestSet = new Set(digestDates);
  const dailyLifeSet = new Set(dailyLifeDates);
  const visualSet = new Set(visualFiles.filter((file) => file.endsWith(".json")));
  const missingDigests = sourceDates.filter((date) => !digestSet.has(date));
  const missingDailyLife = poemDates.filter((date) => !dailyLifeSet.has(date));
  const missingPoemVisuals = poemDates.filter((date) => !visualSet.has(`${date}-poem.json`));
  const missingDreamVisuals = dreamDates.filter((date) => !visualSet.has(`${date}-dream.json`));

  if (missingDigests.length > 0) {
    builder.addAlert({
      severity: "warning",
      type: "missing_source_digests",
      title: "Some source bundles do not have public source digests",
      description: "Source digest files are missing for source dates. This is likely a legacy gap rather than a scanner error.",
      evidence_refs: [],
      metadata: { missing_dates: missingDigests }
    });
  }
  if (missingDailyLife.length > 0) {
    builder.addAlert({
      severity: "error",
      type: "missing_daily_life",
      title: "Some poems do not have matching daily_life records",
      description: "Generated poem dates were found without matching daily_life JSON files.",
      evidence_refs: [],
      metadata: { missing_dates: missingDailyLife }
    });
  }
  if (missingPoemVisuals.length > 0 || missingDreamVisuals.length > 0) {
    builder.addAlert({
      severity: "error",
      type: "missing_visual_metadata",
      title: "Some generated records do not have matching visual metadata",
      description: "Poem or dream dates are missing matching data/visuals metadata JSON files.",
      evidence_refs: [],
      metadata: { poem_dates: missingPoemVisuals, dream_dates: missingDreamVisuals }
    });
  }

  const memoryPath = storagePaths.get("memoryTraces")?.relativePath;
  const sourceCounts: Record<string, number> = {};
  if (memoryPath && (await pathExists(memoryPath))) {
    const traceFiles = (await fs.readdir(toAbs(memoryPath))).filter((file) => file.endsWith(".json"));
    for (const file of traceFiles) {
      try {
        const parsed = JSON.parse(await fs.readFile(toAbs(path.join(memoryPath, file)), "utf8")) as { traces?: Array<{ source?: string }> };
        for (const trace of parsed.traces ?? []) {
          if (trace.source) sourceCounts[trace.source] = (sourceCounts[trace.source] ?? 0) + 1;
        }
      } catch {
        builder.addAlert({
          severity: "warning",
          type: "unreadable_memory_trace_file",
          title: "Memory trace file could not be parsed",
          description: "A memory trace JSON file could not be parsed by the scanner.",
          evidence_refs: [],
          metadata: { file: path.join(memoryPath, file).replaceAll("\\", "/") }
        });
      }
    }
  }
  if ((sourceCounts.visual ?? 0) === 0 && visualFiles.length > 0) {
    builder.addAlert({
      severity: "warning",
      type: "visual_output_not_linked_to_memory_traces",
      title: "Visual outputs are present but visual memory traces are empty",
      description: "data/visuals exists, but current memory trace files contain no traces with source=visual.",
      evidence_refs: [],
      metadata: { visual_metadata_files: visualFiles.filter((file) => file.endsWith(".json")).length, memory_trace_source_counts: sourceCounts }
    });
  }
}

function addOrphanAlerts(builder: GraphBuilder): void {
  const edges = [...builder.edges.values()];
  const dataNodes = [...builder.nodes.values()].filter((node) => node.type === "data_store" || node.type === "output");
  for (const node of dataNodes) {
    const written = edges.some((edge) => edge.target === node.id && ["writes", "produces_in_memory"].includes(edge.relation));
    const read = edges.some((edge) => edge.source === node.id && edge.relation === "read_by");
    if (written && !read && node.file_path !== graphDir) {
      builder.addAlert({
        severity: "info",
        type: "possibly_unused_output",
        title: `Produced output has no observed reader: ${node.label}`,
        description: "The scanner found a producer edge, but no observed read_by edge for this output.",
        evidence_refs: [],
        metadata: { node_id: node.id, file_path: node.file_path }
      });
    }
  }

  for (const edge of edges) {
    if (!builder.nodes.has(edge.source) || !builder.nodes.has(edge.target)) {
      builder.addAlert({
        severity: "error",
        type: "edge_endpoint_missing",
        title: "Edge endpoint is missing",
        description: "An edge points to a node id that was not registered.",
        evidence_refs: edge.evidence_refs,
        metadata: { edge_id: edge.id, source_exists: builder.nodes.has(edge.source), target_exists: builder.nodes.has(edge.target) }
      });
    }
  }
}

function orphanSourceCount(nodes: GraphNode[], edges: GraphEdge[]): number {
  return nodes.filter((node) => node.type === "external_source" && !edges.some((edge) => edge.source === node.id || edge.target === node.id)).length;
}

function orphanOutputCount(nodes: GraphNode[], edges: GraphEdge[]): number {
  return nodes.filter((node) => {
    if (node.type !== "data_store" && node.type !== "output") return false;
    const written = edges.some((edge) => edge.target === node.id && ["writes", "produces_in_memory"].includes(edge.relation));
    const read = edges.some((edge) => edge.source === node.id && edge.relation === "read_by");
    return written && !read;
  }).length;
}

function edgeMarker(edge: GraphEdge): string {
  const symbol: Record<EdgeStatus, string> = { observed: "observed", inferred: "inferred", planned: "planned", broken: "broken" };
  return `[${symbol[edge.status]}, ${Math.round(edge.confidence * 100)}%]`;
}

function nodeLabel(nodesById: Map<string, GraphNode>, id: string): string {
  return nodesById.get(id)?.label ?? id;
}

function previewChild(prefix: string, edge: GraphEdge, nodesById: Map<string, GraphNode>): string {
  return `${prefix}${nodeLabel(nodesById, edge.target)} ${edgeMarker(edge)}`;
}

function buildGraphPreview(nodes: GraphNode[], edges: GraphEdge[], alerts: Alert[]): string {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const lines: string[] = [
    "# UCU BEDEN Graph Preview",
    "",
    "Legend: observed = direct code/workflow evidence, inferred = probable runtime relation, planned = not implemented yet, broken = missing endpoint.",
    ""
  ];

  const schedulerNodes = nodes.filter((node) => node.type === "scheduler").sort((a, b) => a.id.localeCompare(b.id));
  lines.push("Scheduler");
  for (const scheduler of schedulerNodes) {
    lines.push(`|-- ${scheduler.label}`);
    const schedulerEdges = edges.filter((edge) => edge.source === scheduler.id && edge.relation === "runs_script").sort((a, b) => a.target.localeCompare(b.target));
    if (schedulerEdges.length === 0) lines.push("|   |-- broken: no package script target found");
    for (const edge of schedulerEdges) lines.push(previewChild("|   |-- ", edge, nodesById));
  }
  lines.push("");

  const scriptSections = [
    { title: "Daily Generation", id: "script:generate:today" },
    { title: "Dream Generation", id: "script:generate:dream" },
    { title: "Visual Backfill", id: "script:backfill:visuals" },
    { title: "Source Digest", id: "script:digest:sources" },
    { title: "Memory Rebuild", id: "script:rebuild:memory" }
  ];
  for (const section of scriptSections) {
    lines.push(section.title);
    const node = nodesById.get(section.id);
    if (!node) {
      lines.push("|-- broken: script node missing");
      lines.push("");
      continue;
    }
    lines.push(`|-- ${node.label}`);
    const selectedEdges = edges
      .filter((edge) => edge.source === section.id && ["reads", "writes", "calls_process", "uses_database"].includes(edge.relation))
      .sort((a, b) => `${a.relation}:${a.target}`.localeCompare(`${b.relation}:${b.target}`));
    for (const edge of selectedEdges.slice(0, 22)) {
      lines.push(previewChild(`|   |-- ${edge.relation}: `, edge, nodesById));
    }
    if (selectedEdges.length > 22) lines.push(`|   |-- ... ${selectedEdges.length - 22} more edges`);
    lines.push("");
  }

  const gmailNode = nodesById.get("external:gmail");
  lines.push("Gmail");
  if (!gmailNode || !gmailNode.active) {
    lines.push("|-- Gmail intake [orphan source, 0% output influence]");
    lines.push("|   |-- no observed reader script");
    lines.push("|   |-- no observed storage output");
    lines.push("|   |-- no observed memory consumer");
  } else {
    lines.push(`|-- ${gmailNode.label} [ambiguous, ${Math.round(gmailNode.confidence * 100)}%]`);
  }
  lines.push("");

  lines.push("Alerts");
  for (const alert of alerts) {
    lines.push(`|-- ${alert.severity}: ${alert.type} - ${alert.title}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  const absolutePath = toAbs(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(relativePath: string, value: string): Promise<void> {
  const absolutePath = toAbs(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, value, "utf8");
}

async function main(): Promise<void> {
  const builder = new GraphBuilder();
  const storagePaths = await scanStorage(builder);
  const { scripts, entrypointToScript } = await parsePackageScripts(builder);
  await scanWorkflowSchedulers(builder, new Set(scripts.map((script) => script.name)));

  const sourceFiles = (await listFilesRecursive("src")).filter((file) => /\.(ts|tsx)$/.test(file));
  for (const file of sourceFiles) {
    if (file === "src/scripts/scanRepoGraph.ts") continue;
    if (isGraphObserverPath(file)) continue;
    await scanSourceFile(builder, file, storagePaths, entrypointToScript);
  }

  await scanExternalSources(builder);
  await scanVisualImageConsumption(builder);
  await scanGmailStatus(builder);
  await scanDataHealth(builder, storagePaths);
  addOrphanAlerts(builder);

  const nodes = [...builder.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...builder.edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  const evidence = builder.evidence.sort((a, b) => a.id.localeCompare(b.id));
  const alerts = builder.alerts.sort((a, b) => a.id.localeCompare(b.id));
  const summary = {
    generated_at: null,
    scan_version: 1,
    repo_root: repoRoot,
    mode: "static_read_only_scan",
    outputs: [
      `${graphDir}/nodes.json`,
      `${graphDir}/edges.json`,
      `${graphDir}/evidence.json`,
      `${graphDir}/alerts.json`,
      `${graphDir}/scan-summary.json`,
      `${graphDir}/graph-preview.md`
    ],
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      evidence: evidence.length,
      alerts: alerts.length,
      observed_edges: edges.filter((edge) => edge.status === "observed").length,
      inferred_edges: edges.filter((edge) => edge.status === "inferred").length,
      planned_edges: edges.filter((edge) => edge.status === "planned").length,
      broken_edges: edges.filter((edge) => edge.status === "broken").length,
      orphan_sources: orphanSourceCount(nodes, edges),
      orphan_outputs: orphanOutputCount(nodes, edges)
    },
    nodes_by_type: countBy(nodes, (node) => node.type),
    edges_by_relation: countBy(edges, (edge) => edge.relation),
    alerts_by_severity: countBy(alerts, (alert) => alert.severity),
    gmail: nodes.find((node) => node.id === "external:gmail")?.metadata ?? null,
    notes: [
      "The scanner does not execute generation, network, cron, memory rebuild, or deploy tasks.",
      "Data files are summarized by path/count/date metadata; generated poem, dream, mail body, or secret content is not copied into graph JSON.",
      "File-name similarity alone is not promoted to observed edges; it is either ignored or represented through health alerts."
    ]
  };

  await writeJson(`${graphDir}/nodes.json`, nodes);
  await writeJson(`${graphDir}/edges.json`, edges);
  await writeJson(`${graphDir}/evidence.json`, evidence);
  await writeJson(`${graphDir}/alerts.json`, alerts);
  await writeJson(`${graphDir}/scan-summary.json`, summary);
  await writeText(`${graphDir}/graph-preview.md`, buildGraphPreview(nodes, edges, alerts));
  console.log(JSON.stringify(summary, null, 2));
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: "repo_graph_scan", status: "failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
