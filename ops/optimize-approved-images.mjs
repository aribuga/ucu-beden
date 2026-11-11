// Web-delivery copies only; original PNGs are preserved on this repair branch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import sharp from 'sharp';
import { inspectVisualImageFile } from '../src/lib/visualFileStatus.ts';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const write=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const hash=x=>createHash('sha256').update(x).digest('hex');
const manifest=await read('ops/visual-backfill-manifest.json');
const ledger=await read('ops/visual-backfill-ledger.json');
assert.equal(manifest.targets.length,36);assert.equal(ledger.entries.length,36);
assert(ledger.entries.every(e=>e.status==='complete'));
assert.equal((await read('ops/visual-backfill-claim.json')).status,'complete');
const report={format:'webp',quality:95,effort:6,smartSubsample:true,originals_preserved:true,images:[]};
for(const item of manifest.targets){
  const png=await readFile(item.image_file);
  const entry=ledger.entries.find(e=>e.id===item.id);assert(entry);
  assert.equal(hash(png),entry.image_sha256,'Original generated PNG changed');
  const dest=item.image_file.replace(/\.png$/,'.webp');
  let exists=true;try{await access(dest);}catch{exists=false;}assert(!exists,'Refuse to overwrite delivery asset');
  const original=await read(item.visual_file);
  assert.equal(original.image_path,'/'+item.image_file.replace(/^public\//,''));
  await sharp(png).webp({quality:95,effort:6,smartSubsample:true}).toFile(dest);
  const a=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(dest).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(a.info.width,b.info.width);assert.equal(a.info.height,b.info.height);assert.equal(a.data.length,b.data.length);
  let squared=0;for(let i=0;i<a.data.length;i++)squared+=(a.data[i]-b.data[i])**2;
  const psnr=10*Math.log10(255**2/(squared/a.data.length));
  assert(psnr>=35,'Unexpectedly large compression error');
  assert((await inspectVisualImageFile(dest)).usable,'Compressed image failed visibility checks');
  const delivery=await readFile(dest);
  const imagePath='/'+dest.replace(/^public\//,'');
  await write(item.visual_file,{...original,image_path:imagePath,output_format:'webp'});
  if(item.dream_file){const dream=await read(item.dream_file);await write(item.dream_file,{...dream,image_path:imagePath});}
  report.images.push({id:item.id,original_sha256:entry.image_sha256,delivery_sha256:hash(delivery),png_bytes:png.length,webp_bytes:delivery.length,PSNR_dB:psnr});
  console.log(JSON.stringify({id:item.id,webp_bytes:delivery.length,PSNR_dB:psnr}));
}
report.png_total_bytes=report.images.reduce((s,i)=>s+i.png_bytes,0);
report.webp_total_bytes=report.images.reduce((s,i)=>s+i.webp_bytes,0);
assert(report.webp_total_bytes<30_000_000,'New web copies exceed publication size budget');
await write('ops/visual-delivery-report.json',report);
console.log(JSON.stringify({status:'delivery_copies_verified',count:36,quality:95,png_bytes:report.png_total_bytes,webp_bytes:report.webp_total_bytes,min_PSNR_dB:Math.min(...report.images.map(i=>i.PSNR_dB))}));
