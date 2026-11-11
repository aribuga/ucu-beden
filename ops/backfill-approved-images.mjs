// One-time repair only. This file and its workflow must not be merged to main.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { generateVisualImage } from '../src/lib/openaiImageProvider.ts';
import { inspectVisualImageFile } from '../src/lib/visualFileStatus.ts';

export const MODEL = 'gpt-image-2.5-flare-2026-09-08';
export const MAX_MICRO_USD = 2_000_000;
export const RESERVE_MICRO_USD = 50_000;
const LEDGER = 'ops/visual-backfill-ledger.json';
const MANIFEST = 'ops/visual-backfill-manifest.json';
const IMAGE_KEYS = new Set(['aspect_ratio','generated_at','image_path','provider','model','size','api_size','quality','output_format','prompt_hash','fallback','error','image_status']);
const hash = value => createHash('sha256').update(value).digest('hex');
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)));
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const exists = async file => { try { await access(file); return true; } catch { return false; } };

export function usageCost(usage) {
  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  assert(Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0, 'Missing or invalid API usage; stop');
  assert(!usage.input_tokens_details?.image_tokens, 'Unexpected billed image input');
  // Direct Images API: USD5/1M text-input tokens, USD30/1M image-output tokens.
  return input * 5 + output * 30;
}

export function canRequest(ledger, id) {
  assert.equal(ledger.currency, 'USD');
  assert.equal(ledger.max_micro_usd, MAX_MICRO_USD);
  assert(ledger.entries.every(e => e.status === 'complete' && Number.isSafeInteger(e.cost_micro_usd) && e.cost_micro_usd >= 0 && e.cost_micro_usd <= RESERVE_MICRO_USD), 'Prior incomplete/uncertain request or invalid cost; do not retry');
  assert(!ledger.entries.some(e => e.id === id), 'Target already attempted; no retries');
  assert(ledger.entries.length < 36, 'Request count exhausted');
  const reserved = ledger.entries.reduce((n,e) => n + Math.max(RESERVE_MICRO_USD, e.cost_micro_usd), 0);
  assert(reserved + RESERVE_MICRO_USD <= MAX_MICRO_USD, 'Insufficient remaining budget');
}

async function verifyProtected(manifest) {
  const aggregate = createHash('sha256');
  for (const file of manifest.protected_files) aggregate.update(file + '\0' + hash(await readFile(file)) + '\n');
  assert.equal(aggregate.digest('hex'), manifest.protected_sha256, 'Protected archive/content changed');
  for (const item of manifest.targets) {
    const visual = await readJson(item.visual_file);
    assert.equal(hash(JSON.stringify(without(visual, IMAGE_KEYS))), item.visual_content_sha256, `Saved visual prompt/content changed: ${item.id}`);
    if (item.dream_file) {
      const dream = await readJson(item.dream_file);
      assert.equal(hash(JSON.stringify(without(dream, new Set(['image_path'])))), item.dream_content_sha256, `Dream content changed: ${item.id}`);
    }
  }
}

async function main() {
  const manifest = await readJson(MANIFEST);
  assert.equal(manifest.base_sha, '1298979c7e04780621f275a66527a0d55c6c7fe9');
  assert.equal(manifest.targets.length, 36);
  const approvedIds = [];
  for (let day = new Date('2026-10-24T00:00:00Z'); day <= new Date('2026-11-10T00:00:00Z'); day.setUTCDate(day.getUTCDate()+1)) {
    for (const kind of ['poem','dream']) approvedIds.push(day.toISOString().slice(0,10)+'-'+kind);
  }
  assert.deepEqual(manifest.targets.map(t=>t.id).sort(),approvedIds.sort(),'Target list differs from approved dates/types');
  for (const item of manifest.targets) {
    assert.equal(item.visual_file,`data/visuals/${item.id}.json`);
    assert.equal(item.image_file,`public/generated/visuals/${item.id}.png`);
    assert.equal(item.dream_file,item.id.endsWith('-dream')?`data/dreams/${item.id.slice(0,10)}.json`:undefined);
  }
  await verifyProtected(manifest);
  const mode = process.argv[2] || 'verify';
  if (mode === 'verify-protected') { console.log('Protected archive verified'); return; }
  const ledger = await readJson(LEDGER);
  for (const entry of ledger.entries) {
    assert.equal(entry.status, 'complete', 'Previous request incomplete; stop');
    const item = manifest.targets.find(t => t.id === entry.id);
    assert(item, 'Ledger contains out-of-scope target');
    assert.equal(hash(await readFile(item.image_file)), entry.image_sha256, 'Previously completed image changed');
    const visual = await readJson(item.visual_file);
    assert.equal(visual.image_path,'/'+item.image_file.replace(/^public\//,''));
    assert.equal(visual.image_status,'ready');
    if (item.dream_file) assert.equal((await readJson(item.dream_file)).image_path,visual.image_path);
  }
  if (mode === 'verify') { console.log(JSON.stringify({status:'protected_content_verified',completed:ledger.entries.length,actual_cost_usd:ledger.entries.reduce((n,e)=>n+e.cost_micro_usd,0)/1e6})); return; }
  assert(['sample','remaining'].includes(mode), 'Unsupported mode');
  const claim = await readJson('ops/visual-backfill-claim.json');
  assert.equal(claim.status,'running','An active, persisted phase claim is required');
  assert.equal(claim.mode,mode); assert.equal(claim.run_id,process.env.GITHUB_RUN_ID);
  assert(process.env.OPENAI_API_KEY?.trim(), 'OPENAI_API_KEY unavailable');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT || '1', '1', 'Workflow reruns prohibited to avoid double spending');
  if (mode === 'sample') assert.equal(ledger.entries.length, 0, 'Sample already attempted');
  if (mode === 'remaining') assert.equal(ledger.entries.length, 1, 'Exactly one verified sample is required');
  Object.assign(process.env, {OPENAI_IMAGE_MODEL:MODEL, OPENAI_IMAGE_SIZE:'1024x1536', OPENAI_IMAGE_QUALITY:'low', OPENAI_IMAGE_FORMAT:'png', OPENAI_IMAGE_VALIDATION_ATTEMPTS:'1'});
  const targets = manifest.targets.filter(t => !ledger.entries.some(e => e.id === t.id)).slice(0, mode === 'sample' ? 1 : 35);
  const originalFetch = globalThis.fetch;
  let current;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/images/generations');
    assert.equal(options?.method, 'POST');
    const request = JSON.parse(options.body);
    assert.deepEqual(Object.keys(request).sort(), ['model','n','output_format','prompt','quality','size']);
    assert.equal(request.model, MODEL); assert.equal(request.n, 1);
    assert.equal(request.quality, 'low'); assert.equal(request.size, '1024x1536'); assert.equal(request.output_format, 'png');
    assert(Buffer.byteLength(request.prompt, 'utf8') < 6_000, 'Prompt exceeds conservative cost estimate');
    canRequest(ledger, current.id);
    const entry = {id:current.id, status:'pending', reserved_micro_usd:RESERVE_MICRO_USD, prompt_sha256:hash(request.prompt), requested_at:new Date().toISOString()};
    ledger.entries.push(entry);
    await writeJson(LEDGER, ledger); // Persist before issuing a billable request.
    try {
      const response = await originalFetch(url, {...options, signal:AbortSignal.timeout(300_000)});
      const body = await response.clone().json();
      entry.request_id = response.headers.get('x-request-id');
      entry.http_status = response.status;
      if (!response.ok) throw new Error(`API HTTP ${response.status}: ${body.error?.message || 'request failed'}`);
      entry.usage = body.usage;
      entry.cost_micro_usd = usageCost(body.usage);
      assert(entry.cost_micro_usd <= RESERVE_MICRO_USD, 'Actual request cost exceeded conservative reservation; stop');
      entry.status = 'received';
      await writeJson(LEDGER, ledger);
      return response;
    } catch (error) {
      entry.status = 'uncertain_or_failed';
      entry.error = String(error).replace(/\s+/g,' ').slice(0,240);
      await writeJson(LEDGER, ledger);
      throw error; // Throw rather than return HTTP error, disabling provider retries.
    }
  };
  try {
    for (const item of targets) {
      current = item;
      const stored = await readJson(item.visual_file);
      assert.equal(stored.date,item.id.slice(0,10));
      assert.equal(stored.type,item.id.endsWith('-poem')?'poem':'dream');
      assert.equal(stored.image_path, null, 'Refuse to replace an existing image');
      assert.equal(stored.error, "The model 'gpt-image-1' does not exist.");
      for (const ext of ['png','webp','jpeg','jpg']) assert(!(await exists(`public/generated/visuals/${item.id}.${ext}`)), 'Refuse to overwrite an existing asset');
      const generated = await generateVisualImage(stored, {force:false});
      assert.equal(generated.provider, 'openai', generated.error || 'Image generation failed');
      assert.equal(generated.image_path, '/' + item.image_file.replace(/^public\//,''));
      assert.deepEqual(without(generated,IMAGE_KEYS), without(stored,IMAGE_KEYS), 'Generation altered saved prompt/content');
      assert((await inspectVisualImageFile(item.image_file)).usable, 'Output failed image validation');
      await writeJson(item.visual_file, generated);
      if (item.dream_file) {
        const dream = await readJson(item.dream_file);
        await writeJson(item.dream_file, {...dream,image_path:generated.image_path});
      }
      const entry = ledger.entries.at(-1);
      assert.equal(entry.id,item.id); assert.equal(entry.status,'received');
      entry.image_sha256 = hash(await readFile(item.image_file)); entry.status = 'complete';
      await writeJson(LEDGER,ledger);
      console.log(JSON.stringify({status:'image_complete',id:item.id,cost_usd:entry.cost_micro_usd/1e6,total_usd:ledger.entries.reduce((n,e)=>n+e.cost_micro_usd,0)/1e6}));
    }
  } finally {
    globalThis.fetch = originalFetch;
    await verifyProtected(manifest);
  }
  console.log(JSON.stringify({status:'batch_complete',mode,completed:ledger.entries.length,actual_cost_usd:ledger.entries.reduce((n,e)=>n+e.cost_micro_usd,0)/1e6,max_usd:2}));
}

if (process.argv[1]?.endsWith('backfill-approved-images.mjs')) main().catch(error => { console.error(String(error)); process.exitCode=1; });
