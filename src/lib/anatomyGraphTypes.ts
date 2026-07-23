export type AnatomyNodeType = "scheduler" | "script" | "process" | "data_store" | "database" | "external_source" | "output";
export type AnatomyEdgeStatus = "observed" | "inferred" | "planned" | "broken";
export type AnatomyAlertSeverity = "info" | "warning" | "error";
export type AnatomyUiKind = "source" | "process" | "memory" | "storage" | "scheduler" | "output" | "observer" | "unknown";
export type AnatomyRuntimeState = "active" | "defined" | "unknown" | "inactive" | "broken";
export type AnatomyViewMode = "overview" | "anatomy" | "technical" | "alerts";
export type AnatomyLayer = "system" | "interface" | "presentation" | "observer";
export type AnatomySystemRelevance = "data-flow" | "ui-only" | "technical-helper" | "unknown";
export type OverviewRegionId =
  | "external-sources"
  | "manual-inputs"
  | "ingestion"
  | "processing"
  | "short-term-memory"
  | "long-term-memory"
  | "identity-core-memory"
  | "context-assembly"
  | "generation"
  | "outputs"
  | "observability";

export type AnatomyNode = {
  id: string;
  label: string;
  type: AnatomyNodeType;
  file_path: string | null;
  active: boolean;
  detection_method: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type AnatomyEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: AnatomyEdgeStatus;
  confidence: number;
  evidence_refs: string[];
};

export type AnatomyEvidence = {
  id: string;
  source_file: string;
  line: number | null;
  symbol: string | null;
  snippet: string | null;
  description: string;
};

export type AnatomyAlert = {
  id: string;
  severity: AnatomyAlertSeverity;
  type: string;
  title: string;
  description: string;
  evidence_refs: string[];
  metadata: Record<string, unknown>;
};

export type AnatomyScanSummary = {
  generated_at: string | null;
  scan_version?: number;
  repo_root?: string;
  mode?: string;
  outputs?: string[];
  counts: {
    nodes: number;
    edges: number;
    evidence: number;
    alerts: number;
    observed_edges: number;
    inferred_edges: number;
    planned_edges: number;
    broken_edges: number;
    orphan_sources?: number;
    orphan_outputs?: number;
  };
  nodes_by_type: Record<string, number>;
  edges_by_relation: Record<string, number>;
  alerts_by_severity: Record<string, number>;
  gmail?: Record<string, unknown> | null;
  notes?: string[];
};

export type AnatomyGraphBundle = {
  nodes: AnatomyNode[];
  edges: AnatomyEdge[];
  evidence: AnatomyEvidence[];
  alerts: AnatomyAlert[];
  summary: AnatomyScanSummary;
};

export type AnatomyIssue = {
  severity: "warning" | "error";
  code: string;
  message: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export type AnatomyIndexes = {
  nodesById: Map<string, AnatomyNode>;
  edgesById: Map<string, AnatomyEdge>;
  evidenceById: Map<string, AnatomyEvidence>;
  alertsById: Map<string, AnatomyAlert>;
  incomingByNode: Map<string, AnatomyEdge[]>;
  outgoingByNode: Map<string, AnatomyEdge[]>;
  alertsByNode: Map<string, AnatomyAlert[]>;
  alertsByEdge: Map<string, AnatomyAlert[]>;
};

export type AnatomyNodeMetrics = {
  inputs: number;
  outputs: number;
  links: number;
  alerts: number;
  memoryConnection: "observed" | "none observed" | "not applicable";
  orphan: boolean;
};

export type AnatomyLayoutNode = AnatomyNode & {
  x: number;
  y: number;
  ui_kind: AnatomyUiKind;
  runtime_state: AnatomyRuntimeState;
  metrics: AnatomyNodeMetrics;
};

export type AnatomyLayout = {
  nodes: AnatomyLayoutNode[];
  width: number;
  height: number;
};

export type AnatomyNodeProjection = {
  layer: AnatomyLayer;
  systemRelevance: AnatomySystemRelevance;
  visibleByDefault: boolean;
  reason: string;
};

export type OverviewNode = {
  id: OverviewRegionId;
  label: string;
  technicalLabel: string;
  description: string;
  entryRule: string;
  exitRule: string;
  status: AnatomyRuntimeState | "ok";
  memberNodeIds: string[];
  x: number;
  y: number;
  nodeCount: number;
  alertCount: number;
  connectedCount: number;
  orphanCount: number;
  activeConnectionCount: number;
  mainIssue: string | null;
  importantNodeLabels: string[];
  summary: string;
};

export type OverviewEdge = {
  id: string;
  source: OverviewRegionId;
  target: OverviewRegionId;
  relation: string;
  status: AnatomyEdgeStatus;
  confidence: number;
  memberEdgeIds: string[];
  issueCount: number;
};

export type OverviewGraph = {
  nodes: OverviewNode[];
  edges: OverviewEdge[];
  width: number;
  height: number;
};

export type OverviewStoryStep = {
  id: string;
  title: string;
  body: string;
  regionIds: OverviewRegionId[];
  edgePairs: string[];
};

export const anatomyNodeTypes: AnatomyNodeType[] = ["scheduler", "script", "process", "data_store", "database", "external_source", "output"];
export const anatomyEdgeStatuses: AnatomyEdgeStatus[] = ["observed", "inferred", "planned", "broken"];
export const anatomyAlertSeverities: AnatomyAlertSeverity[] = ["info", "warning", "error"];

const overviewLabels: Record<OverviewRegionId, string> = {
  "external-sources": "Dış Dünya",
  "manual-inputs": "Senin Girdilerin",
  ingestion: "Veriyi İçeri Alma",
  processing: "Hazırlama",
  "short-term-memory": "Bugünün Hafızası",
  "long-term-memory": "Birikmiş Hafıza",
  "identity-core-memory": "Karakter Hafızası",
  "context-assembly": "Bugünkü Malzeme",
  generation: "Üretim",
  outputs: "Siteye Düşenler",
  observability: "Kontrol / Debug"
};

const overviewTechnicalLabels: Record<OverviewRegionId, string> = {
  "external-sources": "External Sources",
  "manual-inputs": "Manual Inputs",
  ingestion: "Ingestion",
  processing: "Processing",
  "short-term-memory": "Short-Term Memory",
  "long-term-memory": "Long-Term Memory",
  "identity-core-memory": "Identity / Core Memory",
  "context-assembly": "Context Assembly",
  generation: "Generation",
  outputs: "Outputs",
  observability: "Observability"
};

const overviewDescriptions: Record<OverviewRegionId, { description: string; entryRule: string; exitRule: string }> = {
  "external-sources": {
    description: "Haber, hava, RSS ve API sinyalleri.",
    entryRule: "Repo dışındaki kaynaklar burada başlar; scanner yalnızca kodda görünen bağlantıları gösterir.",
    exitRule: "Kanıt varsa ingestion veya generation tarafına akar; yoksa kaynak yetim kalır."
  },
  "manual-inputs": {
    description: "Elle tutulan şiir girdileri ve ayarlar.",
    entryRule: "Dosya olarak girilen poems_input, settings ve dünya/personality kayıtları burada toplanır.",
    exitRule: "Üretim prompt'una, source toplama ayarlarına veya kimlik katmanına veri sağlar."
  },
  ingestion: {
    description: "Dış veriyi yerel kayda çevirir.",
    entryRule: "RSS, haber, hava durumu ve benzer kaynakları okuyabilen collector/digest işleri buraya düşer.",
    exitRule: "Temizlenmiş kaynak kayıtları processing, memory ve context tarafına gider."
  },
  processing: {
    description: "Kayıtları ölçer, dönüştürür, hazırlar.",
    entryRule: "Scriptler, helper process'ler ve veri okuma-yazma işleri burada gruplanır.",
    exitRule: "Ara sonuçlar kısa/uzun hafızaya, context'e veya output depolarına aktarılır."
  },
  "short-term-memory": {
    description: "Bugünün durumu ve geçici izleri.",
    entryRule: "data/state ve daily_life gibi güncel, üretim çevriminde değişen kayıtlar buraya gider.",
    exitRule: "Bugünkü mood, beden hali ve yakın bağlam generation/context tarafından okunur."
  },
  "long-term-memory": {
    description: "Günler arası biriken hafıza.",
    entryRule: "data/memory traces, index ve report gibi kalıcılaştırılmış geçmiş izleri buraya gider.",
    exitRule: "Memory selection ve context assembly bu havuzdan bugüne uygun parçaları seçer."
  },
  "identity-core-memory": {
    description: "UCU BEDEN'in sabit karakteri.",
    entryRule: "World ve personality ayarları gibi daha yavaş değişen çekirdek kayıtlar burada durur.",
    exitRule: "Üretim diline, mood yorumuna ve site davranışına karakter sınırları verir."
  },
  "context-assembly": {
    description: "Bugünkü prompt bağlamını kurar.",
    entryRule: "Mood, memory selection, source influence ve repetition bilgileri burada birleşir.",
    exitRule: "Generation adımına hangi izlerin ve kısıtların gireceğini belirler."
  },
  generation: {
    description: "Şiir, rüya ve görsel üretimi.",
    entryRule: "Context, hafıza, günlük veri ve dış API sağlayıcıları üretim işlerine girer.",
    exitRule: "Generated poem, dream, visual metadata ve image dosyaları output tarafına yazılır."
  },
  outputs: {
    description: "Üretilen dosyalar ve site ekranları.",
    entryRule: "Şiir, rüya, görsel JSON'ları, public görseller ve veri okuyan route'lar burada görünür.",
    exitRule: "Kullanıcı arayüzü bunları okur; downstream yoksa scanner bunu uyarı olarak gösterebilir."
  },
  observability: {
    description: "Scanner, validation ve debug gözlemi.",
    entryRule: "Sistemi okumak veya doğrulamak için yazılmış script ve health yüzeyleri buraya düşer.",
    exitRule: "Graph, alert ve rapor üretir; gerçek üretim akışını kendi başına değiştirmez."
  }
};

export const overviewStorySteps: OverviewStoryStep[] = [
  {
    id: "inputs",
    title: "1. Malzeme Nereden Geliyor?",
    body: "UCU BEDEN önce dış dünyadan sinyal alır; hava, haber, RSS ve Gmail gibi kaynaklar burada görünür. Senin elle tuttuğun şiir girdileri, ayarlar ve karakter dosyaları da ayrı bir giriş kapısıdır.",
    regionIds: ["external-sources", "manual-inputs"],
    edgePairs: ["external-sources->ingestion", "manual-inputs->ingestion"]
  },
  {
    id: "ingestion",
    title: "2. Veri Yerel Kayda Çevrilir",
    body: "Collector ve digest işleri dışarıdaki ham sinyali doğrudan üretime sokmaz; önce okunabilir, izlenebilir yerel kayıtlara dönüştürür. Gmail varsa bu aşamada çalıştığı görülür, ama hafızaya akıp akmadığı ayrı kanıt ister.",
    regionIds: ["ingestion"],
    edgePairs: ["external-sources->ingestion", "ingestion->processing"]
  },
  {
    id: "processing",
    title: "3. Hazırlama ve Temizleme",
    body: "Scriptler günlük kayıtları ölçer, dönüştürür ve bir sonraki adıma uygun hale getirir. Bu bölüm ham dosya ile şiir/görsel üretimi arasındaki atölye gibi okunabilir.",
    regionIds: ["processing"],
    edgePairs: ["ingestion->processing", "processing->short-term-memory", "processing->long-term-memory", "processing->context-assembly"]
  },
  {
    id: "memory",
    title: "4. Hafıza Katmanları Ayrılır",
    body: "Bugünün Hafızası güncel state ve daily_life izlerini taşır. Birikmiş Hafıza geçmiş günlerden gelen memory kayıtlarını tutar. Karakter Hafızası ise UCU BEDEN'in daha sabit dünya ve kişilik sınırlarını üretime taşır.",
    regionIds: ["short-term-memory", "long-term-memory", "identity-core-memory"],
    edgePairs: ["short-term-memory->context-assembly", "long-term-memory->context-assembly", "identity-core-memory->context-assembly"]
  },
  {
    id: "context",
    title: "5. Bugünkü Malzeme Seçilir",
    body: "Context Assembly şiire, rüyaya ve görsele girecek parçaları seçer: mood, memory selection, source etkileri ve tekrar baskısı burada birleşir. Kısa hafıza ile uzun hafızanın üretime nasıl karıştığını buradan izlersin.",
    regionIds: ["context-assembly"],
    edgePairs: ["short-term-memory->context-assembly", "long-term-memory->context-assembly", "identity-core-memory->context-assembly", "context-assembly->generation"]
  },
  {
    id: "generation",
    title: "6. Üretim Çalışır",
    body: "Şiir, rüya ve görsel üretimi bu bölümde başlar. OpenAI çağrıları, görsel brief ve günlük generation scriptleri burada gerçek çıktıya dönüşür.",
    regionIds: ["generation"],
    edgePairs: ["context-assembly->generation", "generation->outputs"]
  },
  {
    id: "outputs",
    title: "7. Siteye Düşen Dosyalar",
    body: "Üretilen şiir, rüya, görsel metadata ve public görseller bu katmanda görünür. Arayüz bunları okur; üretilmiş ama downstream tüketicisi olmayan çıktı varsa scanner bunu ayrı işaretler.",
    regionIds: ["outputs"],
    edgePairs: ["generation->outputs", "outputs->observability"]
  },
  {
    id: "observability",
    title: "8. Kontrol ve Debug",
    body: "Scanner, doğrulama ve health yüzeyleri sistemi değiştirmeden okur. Bu alan bir üretim motoru değil; hangi bağlantı kanıtlı, hangisi belirsiz veya kopuk onu anlatır.",
    regionIds: ["observability"],
    edgePairs: ["outputs->observability", "generation->observability", "ingestion->observability"]
  }
];

export function overviewEdgePair(edge: Pick<OverviewEdge, "source" | "target">): string {
  return `${edge.source}->${edge.target}`;
}

export const overviewStoryEdgePairs = new Set<string>(overviewStorySteps.flatMap((step) => step.edgePairs));

const overviewOrder: OverviewRegionId[] = [
  "external-sources",
  "manual-inputs",
  "ingestion",
  "processing",
  "short-term-memory",
  "long-term-memory",
  "identity-core-memory",
  "context-assembly",
  "generation",
  "outputs",
  "observability"
];

const overviewPrimaryPairs = new Set<string>([
  "external-sources->ingestion",
  "external-sources->generation",
  "manual-inputs->ingestion",
  "manual-inputs->context-assembly",
  "manual-inputs->generation",
  "ingestion->processing",
  "ingestion->short-term-memory",
  "ingestion->long-term-memory",
  "ingestion->context-assembly",
  "processing->short-term-memory",
  "processing->long-term-memory",
  "processing->context-assembly",
  "processing->generation",
  "processing->outputs",
  "short-term-memory->context-assembly",
  "short-term-memory->generation",
  "short-term-memory->outputs",
  "long-term-memory->context-assembly",
  "long-term-memory->generation",
  "long-term-memory->outputs",
  "identity-core-memory->context-assembly",
  "identity-core-memory->generation",
  "identity-core-memory->outputs",
  "context-assembly->generation",
  "generation->outputs",
  "outputs->observability",
  "ingestion->observability",
  "generation->observability",
  "long-term-memory->observability"
]);

const overviewRegionPositions: Record<OverviewRegionId, { x: number; y: number }> = {
  "external-sources": { x: 56, y: 70 },
  "manual-inputs": { x: 56, y: 300 },
  ingestion: { x: 350, y: 185 },
  processing: { x: 644, y: 185 },
  "short-term-memory": { x: 938, y: 56 },
  "long-term-memory": { x: 938, y: 240 },
  "identity-core-memory": { x: 938, y: 424 },
  "context-assembly": { x: 1232, y: 240 },
  generation: { x: 1526, y: 240 },
  outputs: { x: 1820, y: 150 },
  observability: { x: 1820, y: 370 }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function confidenceIssue(value: number, path: string): AnatomyIssue | null {
  return value >= 0 && value <= 1 ? null : { severity: "error", code: "confidence_out_of_range", message: `Confidence must be between 0 and 1 at ${path}.`, path };
}

function hasNormalizedPath(value: string): boolean {
  return !value.includes("\\") && !value.startsWith("/");
}

export function validateGraphBundle(bundle: AnatomyGraphBundle): AnatomyIssue[] {
  const issues: AnatomyIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const evidenceIds = new Set<string>();

  bundle.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    if (!node.id) issues.push({ severity: "error", code: "node_missing_id", message: `Node is missing id at ${path}.`, path });
    if (nodeIds.has(node.id)) issues.push({ severity: "error", code: "duplicate_node_id", message: `Duplicate node id: ${node.id}.`, path });
    nodeIds.add(node.id);
    if (!anatomyNodeTypes.includes(node.type)) issues.push({ severity: "error", code: "unknown_node_type", message: `Unknown node type: ${node.type}.`, path });
    const confidence = confidenceIssue(node.confidence, `${path}.confidence`);
    if (confidence) issues.push(confidence);
    if (node.file_path && !hasNormalizedPath(node.file_path)) issues.push({ severity: "error", code: "node_path_not_normalized", message: `Node path is not normalized: ${node.file_path}.`, path });
  });

  bundle.evidence.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!item.id) issues.push({ severity: "error", code: "evidence_missing_id", message: `Evidence is missing id at ${path}.`, path });
    if (evidenceIds.has(item.id)) issues.push({ severity: "error", code: "duplicate_evidence_id", message: `Duplicate evidence id: ${item.id}.`, path });
    evidenceIds.add(item.id);
    if (!hasNormalizedPath(item.source_file)) issues.push({ severity: "error", code: "evidence_path_not_normalized", message: `Evidence path is not normalized: ${item.source_file}.`, path });
  });

  bundle.edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (!edge.id) issues.push({ severity: "error", code: "edge_missing_id", message: `Edge is missing id at ${path}.`, path });
    if (edgeIds.has(edge.id)) issues.push({ severity: "error", code: "duplicate_edge_id", message: `Duplicate edge id: ${edge.id}.`, path });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) issues.push({ severity: "error", code: "missing_source", message: `Edge source node not found: ${edge.source}.`, path });
    if (!nodeIds.has(edge.target)) issues.push({ severity: "error", code: "missing_target", message: `Edge target node not found: ${edge.target}.`, path });
    if (!anatomyEdgeStatuses.includes(edge.status)) issues.push({ severity: "error", code: "unknown_edge_status", message: `Unknown edge status: ${edge.status}.`, path });
    const confidence = confidenceIssue(edge.confidence, `${path}.confidence`);
    if (confidence) issues.push(confidence);
    edge.evidence_refs.forEach((ref) => {
      if (!evidenceIds.has(ref)) issues.push({ severity: "error", code: "missing_evidence", message: `Evidence ref not found: ${ref}.`, path });
    });
  });

  bundle.alerts.forEach((alert, index) => {
    const path = `alerts[${index}]`;
    if (!anatomyAlertSeverities.includes(alert.severity)) issues.push({ severity: "error", code: "unknown_alert_severity", message: `Unknown alert severity: ${alert.severity}.`, path });
    alert.evidence_refs.forEach((ref) => {
      if (!evidenceIds.has(ref)) issues.push({ severity: "error", code: "missing_alert_evidence", message: `Alert evidence ref not found: ${ref}.`, path });
    });
  });

  return issues;
}

export function parseGraphBundle(raw: {
  nodes: unknown;
  edges: unknown;
  evidence: unknown;
  alerts: unknown;
  summary: unknown;
}): { bundle: AnatomyGraphBundle | null; issues: AnatomyIssue[] } {
  const issues: AnatomyIssue[] = [];
  if (!Array.isArray(raw.nodes)) issues.push({ severity: "error", code: "nodes_not_array", message: "graph/nodes.json must be an array." });
  if (!Array.isArray(raw.edges)) issues.push({ severity: "error", code: "edges_not_array", message: "graph/edges.json must be an array." });
  if (!Array.isArray(raw.evidence)) issues.push({ severity: "error", code: "evidence_not_array", message: "graph/evidence.json must be an array." });
  if (!Array.isArray(raw.alerts)) issues.push({ severity: "error", code: "alerts_not_array", message: "graph/alerts.json must be an array." });
  if (!isRecord(raw.summary)) issues.push({ severity: "error", code: "summary_not_object", message: "graph/scan-summary.json must be an object." });
  if (issues.some((issue) => issue.severity === "error")) return { bundle: null, issues };

  const nodes = (raw.nodes as unknown[]).filter(isRecord).map((node) => ({
    id: String(node.id ?? ""),
    label: String(node.label ?? node.id ?? ""),
    type: anatomyNodeTypes.includes(node.type as AnatomyNodeType) ? node.type as AnatomyNodeType : "process",
    file_path: node.file_path === null || node.file_path === undefined ? null : String(node.file_path),
    active: Boolean(node.active),
    detection_method: String(node.detection_method ?? "unknown"),
    confidence: isNumber(node.confidence) ? node.confidence : 0,
    metadata: isRecord(node.metadata) ? node.metadata : {}
  }));
  const edges = (raw.edges as unknown[]).filter(isRecord).map((edge) => ({
    id: String(edge.id ?? ""),
    source: String(edge.source ?? ""),
    target: String(edge.target ?? ""),
    relation: String(edge.relation ?? ""),
    status: anatomyEdgeStatuses.includes(edge.status as AnatomyEdgeStatus) ? edge.status as AnatomyEdgeStatus : "broken",
    confidence: isNumber(edge.confidence) ? edge.confidence : 0,
    evidence_refs: isStringArray(edge.evidence_refs) ? edge.evidence_refs : []
  }));
  const evidence = (raw.evidence as unknown[]).filter(isRecord).map((item) => ({
    id: String(item.id ?? ""),
    source_file: String(item.source_file ?? ""),
    line: item.line === null || item.line === undefined ? null : Number(item.line),
    symbol: item.symbol === null || item.symbol === undefined ? null : String(item.symbol),
    snippet: item.snippet === null || item.snippet === undefined ? null : String(item.snippet),
    description: String(item.description ?? "")
  }));
  const alerts = (raw.alerts as unknown[]).filter(isRecord).map((alert) => ({
    id: String(alert.id ?? ""),
    severity: anatomyAlertSeverities.includes(alert.severity as AnatomyAlertSeverity) ? alert.severity as AnatomyAlertSeverity : "warning",
    type: String(alert.type ?? "unknown"),
    title: String(alert.title ?? "Untitled alert"),
    description: String(alert.description ?? ""),
    evidence_refs: isStringArray(alert.evidence_refs) ? alert.evidence_refs : [],
    metadata: isRecord(alert.metadata) ? alert.metadata : {}
  }));
  const summaryRecord = raw.summary as Record<string, unknown>;
  const counts = isRecord(summaryRecord.counts) ? summaryRecord.counts : {};
  const bundle: AnatomyGraphBundle = {
    nodes,
    edges,
    evidence,
    alerts,
    summary: {
      generated_at: summaryRecord.generated_at === null || summaryRecord.generated_at === undefined ? null : String(summaryRecord.generated_at),
      scan_version: isNumber(summaryRecord.scan_version) ? summaryRecord.scan_version : undefined,
      repo_root: isString(summaryRecord.repo_root) ? summaryRecord.repo_root : undefined,
      mode: isString(summaryRecord.mode) ? summaryRecord.mode : undefined,
      outputs: isStringArray(summaryRecord.outputs) ? summaryRecord.outputs : [],
      counts: {
        nodes: Number(counts.nodes ?? nodes.length),
        edges: Number(counts.edges ?? edges.length),
        evidence: Number(counts.evidence ?? evidence.length),
        alerts: Number(counts.alerts ?? alerts.length),
        observed_edges: Number(counts.observed_edges ?? edges.filter((edge) => edge.status === "observed").length),
        inferred_edges: Number(counts.inferred_edges ?? edges.filter((edge) => edge.status === "inferred").length),
        planned_edges: Number(counts.planned_edges ?? edges.filter((edge) => edge.status === "planned").length),
        broken_edges: Number(counts.broken_edges ?? edges.filter((edge) => edge.status === "broken").length),
        orphan_sources: isNumber(counts.orphan_sources) ? counts.orphan_sources : undefined,
        orphan_outputs: isNumber(counts.orphan_outputs) ? counts.orphan_outputs : undefined
      },
      nodes_by_type: isRecord(summaryRecord.nodes_by_type) ? Object.fromEntries(Object.entries(summaryRecord.nodes_by_type).map(([key, value]) => [key, Number(value)])) : {},
      edges_by_relation: isRecord(summaryRecord.edges_by_relation) ? Object.fromEntries(Object.entries(summaryRecord.edges_by_relation).map(([key, value]) => [key, Number(value)])) : {},
      alerts_by_severity: isRecord(summaryRecord.alerts_by_severity) ? Object.fromEntries(Object.entries(summaryRecord.alerts_by_severity).map(([key, value]) => [key, Number(value)])) : {},
      gmail: isRecord(summaryRecord.gmail) ? summaryRecord.gmail : null,
      notes: isStringArray(summaryRecord.notes) ? summaryRecord.notes : []
    }
  };

  return { bundle, issues: validateGraphBundle(bundle) };
}

export function buildAnatomyIndexes(bundle: AnatomyGraphBundle): AnatomyIndexes {
  const nodesById = new Map(bundle.nodes.map((node) => [node.id, node]));
  const edgesById = new Map(bundle.edges.map((edge) => [edge.id, edge]));
  const evidenceById = new Map(bundle.evidence.map((item) => [item.id, item]));
  const alertsById = new Map(bundle.alerts.map((alert) => [alert.id, alert]));
  const incomingByNode = new Map<string, AnatomyEdge[]>();
  const outgoingByNode = new Map<string, AnatomyEdge[]>();
  const alertsByNode = new Map<string, AnatomyAlert[]>();
  const alertsByEdge = new Map<string, AnatomyAlert[]>();

  for (const node of bundle.nodes) {
    incomingByNode.set(node.id, []);
    outgoingByNode.set(node.id, []);
    alertsByNode.set(node.id, []);
  }
  for (const edge of bundle.edges) {
    outgoingByNode.get(edge.source)?.push(edge);
    incomingByNode.get(edge.target)?.push(edge);
  }
  for (const alert of bundle.alerts) {
    const target = alertFocusTarget(alert);
    if (target?.type === "node") alertsByNode.get(target.id)?.push(alert);
    if (target?.type === "edge") alertsByEdge.set(target.id, [...(alertsByEdge.get(target.id) ?? []), alert]);
  }

  return { nodesById, edgesById, evidenceById, alertsById, incomingByNode, outgoingByNode, alertsByNode, alertsByEdge };
}

export function nodeUiKind(node: AnatomyNode): AnatomyUiKind {
  if (node.id === "external:gmail" || node.type === "external_source") return "source";
  if (node.type === "scheduler") return "scheduler";
  if (node.type === "output") return "output";
  if (node.type === "database") return "storage";
  if (node.type === "data_store") {
    if (node.file_path?.startsWith("data/memory")) return "memory";
    if (node.file_path?.includes("state") || node.file_path?.includes("analysis")) return "memory";
    return "storage";
  }
  if (node.type === "script" && (/validate|scan|debug/.test(node.id) || /validate|scan|debug/.test(node.label))) return "observer";
  if (node.type === "process" && /validate|inspect|status|reconcile/i.test(node.label)) return "observer";
  if (node.type === "script" || node.type === "process") return "process";
  return "unknown";
}

export function nodeRuntimeState(node: AnatomyNode, indexes: AnatomyIndexes): AnatomyRuntimeState {
  const relatedEdges = [...(indexes.incomingByNode.get(node.id) ?? []), ...(indexes.outgoingByNode.get(node.id) ?? [])];
  if (relatedEdges.some((edge) => edge.status === "broken")) return "broken";
  if (node.active === false) return "inactive";
  if (node.metadata && "last_run_at" in node.metadata) return "active";
  if (node.active === true) return "defined";
  return "unknown";
}

export function nodeMetrics(node: AnatomyNode, indexes: AnatomyIndexes): AnatomyNodeMetrics {
  const incoming = indexes.incomingByNode.get(node.id) ?? [];
  const outgoing = indexes.outgoingByNode.get(node.id) ?? [];
  const alerts = indexes.alertsByNode.get(node.id) ?? [];
  const touchesMemory = [...incoming, ...outgoing].some((edge) => edge.source.includes("data/memory") || edge.target.includes("data/memory"));
  const orphan = incoming.length + outgoing.length === 0 || alerts.some((alert) => /orphan|not_observed|unused/i.test(alert.type));
  return {
    inputs: incoming.length,
    outputs: outgoing.length,
    links: incoming.length + outgoing.length,
    alerts: alerts.length,
    memoryConnection: touchesMemory ? "observed" : node.id === "external:gmail" || nodeUiKind(node) === "source" ? "none observed" : "not applicable",
    orphan
  };
}

function pathOf(node: AnatomyNode): string {
  return node.file_path ?? node.label ?? node.id;
}

function isUiNode(node: AnatomyNode): boolean {
  const path = pathOf(node);
  return node.id.startsWith("ui-") || path.startsWith("src/app/") || path.startsWith("src/components/");
}

function isPresentationHookNode(node: AnatomyNode): boolean {
  return /^process:use[A-Z]/.test(node.id) || /use(State|Effect|Memo|Callback|Ref)/.test(node.label);
}

function isPresentationFormatterNode(node: AnatomyNode): boolean {
  return /formatMoodSentence|memoryClimateHeadline|memoryClimateDetail/.test(node.id) || /formatMoodSentence|memoryClimateHeadline|memoryClimateDetail/.test(node.label);
}

function isTestOrDemoNode(node: AnatomyNode): boolean {
  const path = pathOf(node).toLocaleLowerCase("tr");
  return /(^|\/)(__tests__|fixtures|demo|examples?)(\/|$)/.test(path) || /\.test\.|\.spec\.|test:|demo/i.test(node.id);
}

function hasDataFlowEvidence(node: AnatomyNode, indexes: AnatomyIndexes): boolean {
  const related = [...(indexes.incomingByNode.get(node.id) ?? []), ...(indexes.outgoingByNode.get(node.id) ?? [])];
  return related.some((edge) => /read|write|database|external_api|collects|fetches|produces|storage|memory/i.test(edge.relation));
}

export function classifyNodeProjection(node: AnatomyNode, indexes: AnatomyIndexes): AnatomyNodeProjection {
  if (isTestOrDemoNode(node)) {
    return {
      layer: "observer",
      systemRelevance: "technical-helper",
      visibleByDefault: false,
      reason: "Test, demo, or example artifact; shown in Technical when broad details are enabled."
    };
  }
  if (isPresentationHookNode(node) || isPresentationFormatterNode(node)) {
    return {
      layer: "presentation",
      systemRelevance: "ui-only",
      visibleByDefault: false,
      reason: "Presentation helper or React hook node without direct system data movement."
    };
  }
  if (isUiNode(node)) {
    if (hasDataFlowEvidence(node, indexes)) {
      return {
        layer: "interface",
        systemRelevance: "data-flow",
        visibleByDefault: true,
        reason: "UI node has observed data-flow evidence such as reads, storage use, or memory access."
      };
    }
    return {
      layer: "presentation",
      systemRelevance: "ui-only",
      visibleByDefault: false,
      reason: "UI node appears to be presentation, styling, layout, or static component code."
    };
  }
  if (nodeUiKind(node) === "observer") {
    return {
      layer: "observer",
      systemRelevance: "technical-helper",
      visibleByDefault: false,
      reason: "Scanner, validation, debug, or inspection helper; kept out of the default Anatomy view."
    };
  }
  return {
    layer: "system",
    systemRelevance: "data-flow",
    visibleByDefault: true,
    reason: "Core scanner node participating in the system data graph."
  };
}

export function nodeVisibleInView(node: AnatomyNode, indexes: AnatomyIndexes, view: AnatomyViewMode, showPresentation: boolean): boolean {
  if (view === "technical") return showPresentation || classifyNodeProjection(node, indexes).systemRelevance !== "ui-only";
  if (view === "anatomy") {
    const projection = classifyNodeProjection(node, indexes);
    return projection.visibleByDefault || (showPresentation && projection.systemRelevance === "ui-only");
  }
  return true;
}

export function isSecondaryTechnicalEdge(edge: AnatomyEdge, indexes: AnatomyIndexes): boolean {
  const source = indexes.nodesById.get(edge.source);
  const target = indexes.nodesById.get(edge.target);
  if (!source || !target) return false;
  if (edge.relation === "calls_process" && (isPresentationHookNode(target) || isPresentationFormatterNode(target))) return true;
  return classifyNodeProjection(source, indexes).visibleByDefault === false || classifyNodeProjection(target, indexes).visibleByDefault === false;
}

export function focusNodeNeighborhood(seedNodeIds: Iterable<string>, indexes: AnatomyIndexes): Set<string> {
  const focused = new Set<string>();
  for (const id of seedNodeIds) {
    focused.add(id);
    for (const edge of indexes.incomingByNode.get(id) ?? []) {
      focused.add(edge.source);
      focused.add(edge.target);
    }
    for (const edge of indexes.outgoingByNode.get(id) ?? []) {
      focused.add(edge.source);
      focused.add(edge.target);
    }
  }
  return focused;
}

function overviewRegionForNode(node: AnatomyNode): OverviewRegionId | null {
  const id = node.id.toLocaleLowerCase("tr");
  const path = pathOf(node).toLocaleLowerCase("tr");
  if (id === "external:gmail" || node.type === "external_source") return "external-sources";
  if (path.startsWith("poems_input") || path.includes("data/settings") || path.includes("rss_sources")) return "manual-inputs";
  if (/sourcecollector|sourcecollect|digestsource|sourcedigest|source_digest|sources/.test(id) || path.includes("source_digests") || path.includes("data/sources")) return "ingestion";
  if (path.includes("data/daily_life") || path.includes("data/state") || /dailylife|state/.test(id)) return "short-term-memory";
  if (path.includes("data/memory") || /memoryarchive|memorytrace|memorygraph|selectmemory/.test(id)) return "long-term-memory";
  if (path.includes("data/world") || path.includes("personality_settings") || /world|personality|identity/.test(id)) return "identity-core-memory";
  if (/context|prompt|selection|repetition|validate.*fragment|sourceinfluence|compactcreative/.test(id)) return "context-assembly";
  if (node.type === "output" || path.startsWith("public/") || id.startsWith("ui-route") || id.startsWith("ui-component")) return "outputs";
  if (node.type === "data_store" && (path.includes("generated_poems") || path.includes("data/dreams") || path.includes("data/visuals"))) return "outputs";
  if (/generate|poemgenerator|dreamengine|visual|openai|imageprovider|brief/.test(id)) return "generation";
  if (/scan|validate|debug|inspect|health|status|reconcile/.test(id)) return "observability";
  if (node.type === "scheduler" || node.type === "script") return "processing";
  if (node.type === "data_store" || node.type === "database") return "processing";
  if (node.type === "process") return "processing";
  return null;
}

function overviewStatus(nodes: AnatomyNode[], indexes: AnatomyIndexes, alerts: AnatomyAlert[]): OverviewNode["status"] {
  if (alerts.some((alert) => alert.severity === "error")) return "broken";
  if (nodes.some((node) => nodeRuntimeState(node, indexes) === "broken")) return "broken";
  if (alerts.some((alert) => alert.severity === "warning")) return "unknown";
  if (nodes.some((node) => nodeRuntimeState(node, indexes) === "active")) return "active";
  if (nodes.some((node) => nodeRuntimeState(node, indexes) === "defined")) return "defined";
  return "ok";
}

function edgeStatusRank(status: AnatomyEdgeStatus): number {
  return status === "broken" ? 4 : status === "planned" ? 3 : status === "inferred" ? 2 : 1;
}

function groupedEdgeStatus(edges: AnatomyEdge[]): AnatomyEdgeStatus {
  return edges.slice().sort((a, b) => edgeStatusRank(b.status) - edgeStatusRank(a.status))[0]?.status ?? "observed";
}

export function buildOverviewGraph(bundle: AnatomyGraphBundle): OverviewGraph {
  const indexes = buildAnatomyIndexes(bundle);
  const membersByRegion = new Map<OverviewRegionId, AnatomyNode[]>();
  const regionByNodeId = new Map<string, OverviewRegionId>();
  for (const region of overviewOrder) membersByRegion.set(region, []);

  for (const node of bundle.nodes) {
    const projection = classifyNodeProjection(node, indexes);
    if (projection.systemRelevance === "ui-only") continue;
    const region = overviewRegionForNode(node);
    if (!region) continue;
    membersByRegion.get(region)?.push(node);
    regionByNodeId.set(node.id, region);
  }

  const edgeBuckets = new Map<string, AnatomyEdge[]>();
  for (const edge of bundle.edges) {
    const rawSourceRegion = regionByNodeId.get(edge.source);
    const rawTargetRegion = regionByNodeId.get(edge.target);
    const inputOperation = ["reads", "collects_from", "fetches_news", "fetches_weather", "calls_external_api"].includes(edge.relation);
    const sourceRegion = inputOperation ? rawTargetRegion : rawSourceRegion;
    const targetRegion = inputOperation ? rawSourceRegion : rawTargetRegion;
    if (!sourceRegion || !targetRegion || sourceRegion === targetRegion) continue;
    const key = `${sourceRegion}->${targetRegion}`;
    if (!overviewPrimaryPairs.has(key)) continue;
    edgeBuckets.set(key, [...(edgeBuckets.get(key) ?? []), edge]);
  }

  const nodeWidth = 260;
  const nodeHeight = 138;
  const nodes = overviewOrder
    .flatMap((region) => {
      const members = membersByRegion.get(region) ?? [];
      return members.length ? [{ region, members }] : [];
    })
    .map(({ region, members }) => {
      const memberIds = new Set(members.map((node) => node.id));
      const alerts = bundle.alerts.filter((alert) => {
        const target = alertFocusTarget(alert);
        return target?.type === "node" && memberIds.has(target.id);
      });
      const connectedCount = members.filter((node) => (indexes.incomingByNode.get(node.id)?.length ?? 0) + (indexes.outgoingByNode.get(node.id)?.length ?? 0) > 0).length;
      const orphanNodes = members.filter((node) => nodeMetrics(node, indexes).orphan);
      const activeConnectionCount = members.reduce((total, node) => total + (indexes.outgoingByNode.get(node.id) ?? []).filter((edge) => edge.status === "observed").length, 0);
      const alertIssue = alerts.find((alert) => /gmail|orphan|unused|missing|visual/i.test(alert.type));
      const gmail = members.find((node) => node.id === "external:gmail");
      const mainIssue = alertIssue?.title
        ?? (gmail ? "Gmail has no observed memory connection" : null)
        ?? (orphanNodes.length ? `${orphanNodes.length} orphan node${orphanNodes.length === 1 ? "" : "s"}` : null);
      return {
        id: region,
        label: overviewLabels[region],
        technicalLabel: overviewTechnicalLabels[region],
        description: overviewDescriptions[region].description,
        entryRule: overviewDescriptions[region].entryRule,
        exitRule: overviewDescriptions[region].exitRule,
        status: overviewStatus(members, indexes, alerts),
        memberNodeIds: members.map((node) => node.id),
        x: overviewRegionPositions[region].x,
        y: overviewRegionPositions[region].y,
        nodeCount: members.length,
        alertCount: alerts.length,
        connectedCount,
        orphanCount: orphanNodes.length,
        activeConnectionCount,
        mainIssue,
        importantNodeLabels: members
          .slice()
          .sort((a, b) => {
            const aDegree = (indexes.incomingByNode.get(a.id)?.length ?? 0) + (indexes.outgoingByNode.get(a.id)?.length ?? 0);
            const bDegree = (indexes.incomingByNode.get(b.id)?.length ?? 0) + (indexes.outgoingByNode.get(b.id)?.length ?? 0);
            return bDegree - aDegree || a.label.localeCompare(b.label, "tr");
          })
          .slice(0, 5)
          .map((node) => node.label),
        summary: `${members.length} nodes / ${connectedCount} connected / ${orphanNodes.length} orphan`
      } satisfies OverviewNode;
    });

  const overviewEdges = [...edgeBuckets.entries()].map(([key, edges]) => {
    const [source, target] = key.split("->") as [OverviewRegionId, OverviewRegionId];
    const relations = [...new Set(edges.map((edge) => edge.relation))].sort();
    const relation = relations.length === 1 ? relations[0] : `${relations[0]} + ${relations.length - 1}`;
    const status = groupedEdgeStatus(edges);
    return {
      id: `overview:${source}->${target}`,
      source,
      target,
      relation,
      status,
      confidence: edges.reduce((sum, edge) => sum + edge.confidence, 0) / edges.length,
      memberEdgeIds: edges.map((edge) => edge.id),
      issueCount: edges.filter((edge) => edge.status !== "observed").length
    } satisfies OverviewEdge;
  }).sort((a, b) => a.id.localeCompare(b.id));

  const maxX = Math.max(...nodes.map((node) => node.x), 0);
  const maxY = Math.max(...nodes.map((node) => node.y), 0);
  return {
    nodes,
    edges: overviewEdges,
    width: maxX + nodeWidth + 90,
    height: maxY + nodeHeight + 90
  };
}

export function edgeCssClass(edge: Pick<AnatomyEdge, "status">): string {
  return `anatomy-edge anatomy-edge-${edge.status}`;
}

export function alertFocusTarget(alert: AnatomyAlert): { type: "node" | "edge"; id: string } | null {
  const nodeId = typeof alert.metadata.node_id === "string" ? alert.metadata.node_id : null;
  const edgeId = typeof alert.metadata.edge_id === "string" ? alert.metadata.edge_id : null;
  if (nodeId) return { type: "node", id: nodeId };
  if (edgeId) return { type: "edge", id: edgeId };
  if (/gmail/i.test(alert.type) || /gmail/i.test(alert.title)) return { type: "node", id: "external:gmail" };
  if (/source_digest/i.test(alert.type)) return { type: "node", id: "data:data/source_digests" };
  if (/visual/i.test(alert.type)) return { type: "node", id: "data:data/visuals" };
  return null;
}

export function searchMatchesNode(node: AnatomyNode, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLocaleLowerCase("tr");
  return [node.id, node.label, node.type, node.file_path ?? "", node.detection_method]
    .some((value) => value.toLocaleLowerCase("tr").includes(q));
}

export function searchMatchesEdge(edge: AnatomyEdge, query: string, indexes: AnatomyIndexes): boolean {
  if (!query.trim()) return true;
  const q = query.toLocaleLowerCase("tr");
  const source = indexes.nodesById.get(edge.source);
  const target = indexes.nodesById.get(edge.target);
  return [edge.id, edge.relation, edge.status, source?.label ?? "", target?.label ?? ""]
    .some((value) => value.toLocaleLowerCase("tr").includes(q));
}

export function buildLayout(bundle: AnatomyGraphBundle, options: { visibleNodeIds?: Set<string> } = {}): AnatomyLayout {
  const indexes = buildAnatomyIndexes(bundle);
  const columns: AnatomyUiKind[] = ["source", "scheduler", "process", "storage", "memory", "output", "observer", "unknown"];
  const byKind = new Map<AnatomyUiKind, AnatomyNode[]>();
  for (const kind of columns) byKind.set(kind, []);
  for (const node of bundle.nodes) {
    if (options.visibleNodeIds && !options.visibleNodeIds.has(node.id)) continue;
    byKind.get(nodeUiKind(node))?.push(node);
  }

  const columnWidth = 280;
  const rowHeight = 134;
  const marginX = 48;
  const marginY = 48;
  const layoutNodes: AnatomyLayoutNode[] = [];

  columns.forEach((kind, columnIndex) => {
    const nodes = (byKind.get(kind) ?? []).slice().sort((a, b) => {
      const orphanDelta = Number(nodeMetrics(b, indexes).orphan) - Number(nodeMetrics(a, indexes).orphan);
      return orphanDelta || a.label.localeCompare(b.label, "tr");
    });
    nodes.forEach((node, rowIndex) => {
      const metrics = nodeMetrics(node, indexes);
      const orphanOffset = metrics.orphan ? 58 : 0;
      layoutNodes.push({
        ...node,
        x: marginX + columnIndex * columnWidth + orphanOffset,
        y: marginY + rowIndex * rowHeight,
        ui_kind: kind,
        runtime_state: nodeRuntimeState(node, indexes),
        metrics
      });
    });
  });

  const maxRows = Math.max(...columns.map((kind) => byKind.get(kind)?.length ?? 0), 1);
  return {
    nodes: layoutNodes,
    width: marginX * 2 + columns.length * columnWidth + 260,
    height: marginY * 2 + maxRows * rowHeight + 140
  };
}

export function gmailSummary(bundle: AnatomyGraphBundle): string[] {
  const gmail = bundle.nodes.find((node) => node.id === "external:gmail");
  const metadata = gmail?.metadata ?? {};
  const summaryGmail = isRecord(bundle.summary.gmail) ? bundle.summary.gmail : {};
  const indexes = buildAnatomyIndexes(bundle);
  const gmailEdges = indexes.outgoingByNode.get("external:gmail") ?? [];
  const observedStorageEdges = gmailEdges.filter((edge) => {
    const target = indexes.nodesById.get(edge.target);
    return edge.status === "observed" && Boolean(target && ["storage", "memory"].includes(nodeUiKind(target)));
  });
  const storageDownstream = observedStorageEdges.flatMap((edge) =>
    (indexes.outgoingByNode.get(edge.target) ?? []).filter((downstream) => downstream.status === "observed")
  );
  const memory = metadata.memory_connection_observed === true || [...gmailEdges, ...storageDownstream].some((edge) => {
    const source = indexes.nodesById.get(edge.source);
    const target = indexes.nodesById.get(edge.target);
    return edge.status === "observed" && Boolean((source && nodeUiKind(source) === "memory") || (target && nodeUiKind(target) === "memory"));
  });
  const observed = metadata.observed_implementation === true || gmailEdges.some((edge) => edge.status === "observed");
  const explicitInfluence = typeof metadata.output_influence === "number"
    ? metadata.output_influence
    : typeof summaryGmail.output_influence === "number"
      ? summaryGmail.output_influence
      : null;
  const influence = explicitInfluence ?? (metadata.memory_connection_observed === false || summaryGmail.memory_connection_observed === false ? 0 : null);
  if (observed) {
    return [
      "Gmail ingestion exists.",
      observedStorageEdges.length ? "Messages reach local storage." : "No observed local storage output was found.",
      storageDownstream.length ? `Observed downstream consumer: ${storageDownstream.map((edge) => indexes.nodesById.get(edge.target)?.label ?? edge.target).join(", ")}.` : "No observed downstream consumer was found.",
      memory ? "An observed memory connection was found." : "No observed memory connection was found."
    ];
  }
  return [
    "No Gmail ingestion implementation was observed in this repo.",
    "No observed local storage output was found.",
    "No observed downstream consumer was found.",
    "No observed memory connection was found.",
    influence === null ? "Output influence: not measured." : `Output influence: ${Math.round(influence * 100)}% by graph evidence.`
  ];
}

export function summarizeEdge(edge: AnatomyEdge, indexes: AnatomyIndexes): string {
  const source = indexes.nodesById.get(edge.source)?.label ?? edge.source;
  const target = indexes.nodesById.get(edge.target)?.label ?? edge.target;
  return `${source} -> ${target} / ${edge.relation} / ${edge.status} / ${Math.round(edge.confidence * 100)}%`;
}
