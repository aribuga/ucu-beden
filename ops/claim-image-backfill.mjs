import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const file='ops/visual-backfill-claim.json';
const request=await read('ops/visual-backfill-request.json');
const ledger=await read('ops/visual-backfill-ledger.json');
const runId=process.env.GITHUB_RUN_ID;
assert(runId && /^\d+$/.test(runId),'GitHub run ID required');
assert(['sample','remaining'].includes(request.mode));
let previous=null;
try { previous=await read(file); } catch(error) { if(error.code!=='ENOENT')throw error; }
if(process.argv[2]==='start') {
  if(request.mode==='sample') { assert.equal(previous,null,'Prior sample claim exists; reconcile before retry'); assert.equal(ledger.entries.length,0); }
  else { assert.equal(previous?.status,'complete'); assert.equal(previous?.mode,'sample'); assert.equal(ledger.entries.length,1); assert.equal(ledger.entries[0].status,'complete'); }
  await writeFile(file,JSON.stringify({mode:request.mode,status:'running',run_id:runId,started_at:new Date().toISOString()},null,2)+'\n');
} else {
  assert.equal(process.argv[2],'finish'); assert.equal(previous?.run_id,runId); assert.equal(previous?.status,'running');
  const complete=process.argv[3]==='success';
  if(complete) { assert.equal(ledger.entries.length,request.mode==='sample'?1:36); assert(ledger.entries.every(e=>e.status==='complete')); }
  await writeFile(file,JSON.stringify({...previous,status:complete?'complete':'failed',finished_at:new Date().toISOString()},null,2)+'\n');
}
