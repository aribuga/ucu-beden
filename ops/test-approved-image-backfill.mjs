import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, symlink, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { usageCost, canRequest } from './backfill-approved-images.mjs';

assert.equal(usageCost({input_tokens:1200,output_tokens:158,input_tokens_details:{image_tokens:0,text_tokens:1200}}),10740);
for (const usage of [undefined,{}, {input_tokens:1,output_tokens:-1},{input_tokens:NaN,output_tokens:1},{input_tokens:1,output_tokens:1,input_tokens_details:{image_tokens:1}}]) assert.throws(()=>usageCost(usage));
const ledger={currency:'USD',max_micro_usd:2_000_000,entries:[]};
canRequest(ledger,'first');
assert.throws(()=>canRequest({...ledger,entries:[{id:'first',status:'pending'}]},'second'));
assert.throws(()=>canRequest({...ledger,entries:[{id:'first',status:'complete',cost_micro_usd:1}]},'first'));
assert.throws(()=>canRequest({...ledger,entries:[{id:'first',status:'complete',cost_micro_usd:1_990_000}]},'second'));
assert.throws(()=>canRequest({...ledger,entries:Array.from({length:36},(_,i)=>({id:String(i),status:'complete',cost_micro_usd:1}))},'last'));

const source=process.cwd();
const fixture=await mkdtemp(path.join(tmpdir(),'ucu-image-backfill-test-'));
const sha=x=>createHash('sha256').update(x).digest('hex');
try {
  for(const dir of ['ops','data/visuals','data/dreams','data/memory','poems_input']) await mkdir(path.join(fixture,dir),{recursive:true});
  await symlink(path.join(source,'src'),path.join(fixture,'src'));
  await symlink(path.join(source,'node_modules'),path.join(fixture,'node_modules'));
  await cp(path.join(source,'ops/backfill-approved-images.mjs'),path.join(fixture,'ops/backfill-approved-images.mjs'));
  await cp(path.join(source,'ops/claim-image-backfill.mjs'),path.join(fixture,'ops/claim-image-backfill.mjs'));
  const manifest=JSON.parse(await readFile('ops/visual-backfill-manifest.json','utf8'));
  for(const item of manifest.targets) {
    await cp(path.join(source,item.visual_file),path.join(fixture,item.visual_file));
    if(item.dream_file) await cp(path.join(source,item.dream_file),path.join(fixture,item.dream_file));
  }
  await writeFile(path.join(fixture,'data/memory/guard.json'),'{"memory":"untouched"}\n');
  await writeFile(path.join(fixture,'poems_input/guard.txt'),'Do not change this poem.\n');
  manifest.protected_files=['data/memory/guard.json','poems_input/guard.txt'];
  const h=createHash('sha256');
  for(const file of manifest.protected_files)h.update(file+'\0'+sha(await readFile(path.join(fixture,file)))+'\n');
  manifest.protected_sha256=h.digest('hex');
  await writeFile(path.join(fixture,'ops/visual-backfill-manifest.json'),JSON.stringify(manifest));
  await writeFile(path.join(fixture,'ops/visual-backfill-ledger.json'),JSON.stringify(ledger));
  await writeFile(path.join(fixture,'ops/mock-fetch.mjs'),`
import sharp from 'sharp';
import {appendFile} from 'node:fs/promises';
const pixels=Buffer.alloc(1024*1536*3);
for(let y=0;y<1536;y++)for(let x=0;x<1024;x++)for(let c=0;c<3;c++)pixels[(y*1024+x)*3+c]=(((x>>5)*31+(y>>5)*17+c*53)%256);
const png=await sharp(pixels,{raw:{width:1024,height:1536,channels:3}}).png().toBuffer();
globalThis.fetch=async()=>{
 await appendFile('mock-calls.txt','request\\n');
 const mode=process.env.MOCK_FAILURE;
 if(['429','500'].includes(mode))return new Response(JSON.stringify({error:{message:'mock failure'}}),{status:Number(mode)});
 const image=mode==='blank'?await sharp({create:{width:1024,height:1536,channels:3,background:'#000000'}}).png().toBuffer():png;
 const usage=mode==='usage_missing'?undefined:mode==='usage_invalid'?{input_tokens:-1,output_tokens:158}:{input_tokens:1200,output_tokens:158,input_tokens_details:{text_tokens:1200,image_tokens:0}};
 return new Response(JSON.stringify({data:[{b64_json:image.toString('base64')}],usage}),{status:200,headers:{'content-type':'application/json','x-request-id':'mock-only'}});
};
`);
  const run=(mode,overrides={})=>spawnSync(process.execPath,['--preserve-symlinks','--import',path.join(source,'node_modules/tsx/dist/loader.mjs'),'--import',path.join(fixture,'ops/mock-fetch.mjs'),path.join(fixture,'ops/backfill-approved-images.mjs'),mode],{cwd:fixture,encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'fixture-not-a-key',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',...overrides},maxBuffer:2e6});
  const claim=(action,outcome)=>spawnSync(process.execPath,['ops/claim-image-backfill.mjs',action,...(outcome?[outcome]:[])],{cwd:fixture,encoding:'utf8',env:{...process.env,GITHUB_RUN_ID:'123'}});
  await writeFile(path.join(fixture,'ops/visual-backfill-request.json'),JSON.stringify({mode:'sample'}));
  assert.equal(claim('start').status,0);
  assert.notEqual(claim('start').status,0,'Active claim must prevent a second run');
  let result=run('sample');
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  let measured=JSON.parse(await readFile(path.join(fixture,'ops/visual-backfill-ledger.json'),'utf8'));
  assert.equal(measured.entries.length,1);assert.equal(measured.entries[0].cost_micro_usd,10740);
  assert.notEqual(run('sample').status,0,'Sample cannot run twice');
  assert.notEqual(run('remaining',{GITHUB_RUN_ATTEMPT:'2'}).status,0,'Workflow rerun must stop');
  assert.equal(claim('finish','success').status,0);
  await writeFile(path.join(fixture,'ops/visual-backfill-request.json'),JSON.stringify({mode:'remaining'}));
  assert.equal(claim('start').status,0);
  result=run('remaining');assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  measured=JSON.parse(await readFile(path.join(fixture,'ops/visual-backfill-ledger.json'),'utf8'));
  assert.equal(measured.entries.length,36);assert.equal(measured.entries.reduce((n,e)=>n+e.cost_micro_usd,0),386640);
  assert.equal(run('verify').status,0);
  const sample=manifest.targets[0];
  for(const mode of ['429','500','usage_missing','usage_invalid','blank']) {
    await cp(path.join(source,sample.visual_file),path.join(fixture,sample.visual_file));
    await rm(path.join(fixture,sample.image_file),{force:true});
    await writeFile(path.join(fixture,'ops/visual-backfill-ledger.json'),JSON.stringify(ledger));
    await writeFile(path.join(fixture,'ops/visual-backfill-request.json'),JSON.stringify({mode:'sample'}));
    await rm(path.join(fixture,'ops/visual-backfill-claim.json'),{force:true});
    await writeFile(path.join(fixture,'mock-calls.txt'),'');
    assert.equal(claim('start').status,0);
    assert.notEqual(run('sample',{MOCK_FAILURE:mode}).status,0,`${mode} must stop`);
    assert.equal((await readFile(path.join(fixture,'mock-calls.txt'),'utf8')).trim().split('\n').length,1,`${mode} must not retry`);
    assert.notEqual(claim('start').status,0,`${mode} claim prevents replay`);
    assert.notEqual(run('sample').status,0,`${mode} ledger prevents replay`);
  }
  await writeFile(path.join(fixture,'data/memory/guard.json'),'changed');
  assert.notEqual(run('verify').status,0,'Memory mutation must be detected');
  console.log('Budget guards, sample, 35 remaining images, durable phase claims, idempotence, HTTP/usage/validation failure paths, and preservation checks passed using mocked API only. No billable requests.');
} finally { await rm(fixture,{recursive:true,force:true}); }
