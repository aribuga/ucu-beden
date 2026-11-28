import assert from "node:assert/strict";
import { listDreams, listGeneratedPoems, listMemoryTraces, quarantinedTraceIds, readJsonFile, storagePaths } from "../../src/lib/fileStorage";
import { buildMemoryArchive, selectMemoryForGeneration } from "../../src/lib/memoryTraceEngine";
import { providerFailure, retryDelay } from "../../src/lib/providerFailure";
import type { MemoryTraceFile } from "../../src/lib/types";

const date = "2026-11-28";
const poems = await listGeneratedPoems();
const dreams = await listDreams();
assert.equal(poems.at(-1)?.date, "2026-11-20");
assert.equal(dreams.at(-1)?.date, "2026-11-20");
const archive = await buildMemoryArchive();
const visible = await listMemoryTraces();
const ids = new Set(archive.index.trace_ids);
const excluded = new Set<string>();
for (let day = 21; day <= 27; day++) {
  const from = `2026-11-${day}`;
  const file = await readJsonFile<MemoryTraceFile>(`${storagePaths.memoryTraces}/${from}.json`, {version:1,date:from,traces:[]});
  for (const trace of file.traces) {
    if (["poem","dream"].includes(trace.source)) {
      excluded.add(trace.id);
      assert.ok(!ids.has(trace.id));
    } else {
      assert.ok(ids.has(trace.id), trace.id);
    }
  }
  console.log(JSON.stringify({date:from,exclude:file.traces.filter(t=>excluded.has(t.id)).map(t=>t.id),retained:file.traces.filter(t=>ids.has(t.id)).length}));
  for (const mode of ["poem","dream"] as const) {
    const selection = await selectMemoryForGeneration({date,mode,mood:poems.at(-1)!.mood,traces:file.traces,repetition:poems.at(-1)!.repetition_pressure!});
    for (const id of [...selection.direct_trace_ids,...selection.indirect_trace_ids]) assert.ok(!quarantinedTraceIds.has(id));
  }
}
assert.deepEqual(excluded,quarantinedTraceIds);
assert.ok(!visible.some(t=>excluded.has(t.id) || t.linked_traces.some(id=>excluded.has(id))));
assert.equal(providerFailure(429,{}),"unclassified_429");
assert.equal(providerFailure(400,{error:{message:"You have no credits remaining."}}),"quota");
const response = new Response(null,{status:429,headers:{"Retry-After":"2"}});
assert.ok(retryDelay(response,"rate_limit",1)! >= 2000);
assert.equal(retryDelay(response,"quota",1),null);
assert.equal(retryDelay(response,"rate_limit",3),null);
assert.equal(retryDelay(new Response(null,{headers:{"Retry-After":"15"}}),"rate_limit",1),null);
console.log("Archive dry-run and retry policy passed.");
