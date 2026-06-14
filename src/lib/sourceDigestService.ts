import {
  listGeneratedPoems,
  listSourceDigests,
  pathExists,
  readSourceDigest,
  storagePaths,
  writeJsonFile
} from "./fileStorage";
import { digestSourcesWithOpenAI } from "./sourceDigestion";
import type { SourceBundle, SourceDigestRecord } from "./types";

export async function ensureSourceDigest(params: {
  source: SourceBundle;
  force?: boolean;
}): Promise<{ digest: SourceDigestRecord; status: "generated" | "existing" }> {
  const path = `${storagePaths.sourceDigests}/${params.source.date}.json`;
  if (!params.force && (await pathExists(path))) {
    const existing = await readSourceDigest(params.source.date);
    if (existing) return { digest: existing, status: "existing" };
  }
  const [history, poems] = await Promise.all([listSourceDigests(), listGeneratedPoems()]);
  const digest = await digestSourcesWithOpenAI({
    source: params.source,
    history: history.filter((item) => item.date < params.source.date),
    recentPoems: poems.filter((poem) => poem.date < params.source.date)
  });
  await writeJsonFile(path, digest);
  return { digest, status: "generated" };
}
