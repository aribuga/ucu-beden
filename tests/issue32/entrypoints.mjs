import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const cwd = mkdtempSync(path.join(tmpdir(), "ucu-offline-"));
const date = "2026-11-28";
const fixtureImage = await sharp(randomBytes(96*120*3),{raw:{width:96,height:120,channels:3}}).png().toBuffer();
const read = file => JSON.parse(readFileSync(path.join(cwd, file)));
function run(script, mode, args = [`--date=${date}`], expected = 0) {
  const result = spawnSync(process.execPath, ["--import", path.join(root,"tests/issue32/provider.mjs"), "--import", path.join(root,"node_modules/tsx/dist/loader.mjs"), path.join(root,"src/scripts",script+".ts"), ...args], {
    cwd, encoding:"utf8", env:{PATH:process.env.PATH, OPENAI_API_KEY:"fixture", FIXTURE_MODE:mode, FIXTURE_IMAGE:fixtureImage.toString("base64")}
  });
  const log = result.stdout + result.stderr;
  assert.equal(result.status, expected, log);
  return log;
}
try {
  for (const dir of ["world","settings","external_intake"]) cpSync(path.join(root,"data",dir), path.join(cwd,"data",dir), {recursive:true});
  for (const mode of ["quota","invalid","severe"]) {
    const log = run("generateDailyPoem",mode,undefined,1);
    assert.equal(log.match(/fixture:poem/g)?.length,mode==="severe"?3:1,log);
    assert.match(log,mode==="quota"?/HTTP 429 quota/:mode==="severe"?/validation_failed/:/invalid_payload/);
    assert.ok(!existsSync(path.join(cwd,`data/generated_poems/${date}.json`)));
    assert.ok(!existsSync(path.join(cwd,"data/memory/index.json")));
    assert.ok(existsSync(path.join(cwd,`data/sources/${date}.json`)));
  }
  assert.match(run("generateDream","quota",undefined,1),/needs a completed poem/);
  const morning = run("generateDailyPoem","temporary");
  assert.equal(morning.match(/fixture:poem/g)?.length,2,morning);
  assert.equal(morning.match(/fixture:image/g)?.length,1,morning);
  assert.match(run("generateDream","quota",undefined,1),/HTTP 429 quota/);
  assert.ok(!existsSync(path.join(cwd,`data/dreams/${date}.json`)));
  run("generateDream","valid");
  const index = read("data/memory/index.json");
  for (const kind of ["poem","dream"]) {
    const visual = read(`data/visuals/${date}-${kind}.json`);
    assert.equal(visual.image_path,null);
    assert.match(visual.error,/HTTP 429 quota/);
    const log = run("backfillVisuals","quota",["--dry-run",`--kind=${kind}`,`--from=${date}`,`--to=${date}`]);
    assert.equal(log.match(/would_generate/g)?.length,1);
    assert.ok(!log.includes("fixture:"));
  }
  const imageArgs = ["--kind=dream",`--from=${date}`,`--to=${date}`];
  assert.match(run("backfillVisuals","image_ok",imageArgs),/fixture:image/);
  const mediaPath = read(`data/visuals/${date}-dream.json`).image_path;
  assert.ok(mediaPath);
  const imageHash = () => createHash("sha256").update(readFileSync(path.join(cwd,"public",mediaPath))).digest("hex");
  const originalHash = imageHash();
  for (const extra of [[],["--dry-run"]]) {
    const log = run("backfillVisuals","quota",[...imageArgs,...extra]);
    assert.ok(!log.includes("fixture:") && !log.includes("would_generate"),log);
    assert.equal(imageHash(),originalHash);
  }
  for (const script of ["generateDailyPoem","generateDream"]) assert.match(run(script,"valid"),/skipped/);
  assert.deepEqual(read("data/memory/index.json"),index);
  console.log("Offline daily, dream, quota, transient, validation, image, retry and backfill checks passed.");
} finally { rmSync(cwd,{recursive:true,force:true}); }
