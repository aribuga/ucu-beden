import { promises as fs } from "node:fs";
import path from "node:path";

import { parseGraphBundle, type AnatomyGraphBundle, type AnatomyIssue } from "./anatomyGraphTypes";

const graphFiles = {
  nodes: "graph/nodes.json",
  edges: "graph/edges.json",
  evidence: "graph/evidence.json",
  alerts: "graph/alerts.json",
  summary: "graph/scan-summary.json"
} as const;

async function readJson(relativePath: string): Promise<unknown> {
  const absolutePath = path.join(process.cwd(), relativePath);
  const text = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(text) as unknown;
}

export async function readAnatomyGraphBundle(): Promise<{ bundle: AnatomyGraphBundle | null; issues: AnatomyIssue[] }> {
  const entries: Array<readonly [string, unknown, AnatomyIssue | null]> = await Promise.all(
    Object.entries(graphFiles).map(async ([key, relativePath]) => {
      try {
        return [key, await readJson(relativePath), null] as const;
      } catch (error) {
        const message = error instanceof SyntaxError
          ? `JSON parse failed for ${relativePath}: ${error.message}`
          : `Could not read ${relativePath}. Has the scanner been run?`;
        return [
          key,
          null,
          {
            severity: "error",
            code: error instanceof SyntaxError ? "json_parse_failed" : "graph_file_missing",
            message,
            path: relativePath
          } satisfies AnatomyIssue
        ] as const;
      }
    })
  );
  const fileIssues = entries.flatMap((entry) => entry[2] ? [entry[2]] : []);
  if (fileIssues.length > 0) return { bundle: null, issues: fileIssues };

  const raw = Object.fromEntries(entries.map(([key, value]) => [key, value])) as {
    nodes: unknown;
    edges: unknown;
    evidence: unknown;
    alerts: unknown;
    summary: unknown;
  };
  return parseGraphBundle(raw);
}
