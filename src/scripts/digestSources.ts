import { ensureDataDirs, readJsonFile, storagePaths } from "../lib/fileStorage";
import { todayInIstanbul } from "../lib/scheduler";
import { ensureSourceDigest } from "../lib/sourceDigestService";
import type { SourceBundle } from "../lib/types";

function parseArgs(args: string[]): { date: string; force: boolean } {
  const inline = args.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  const position = args.indexOf("--date");
  const date = inline ?? (position >= 0 ? args[position + 1] : undefined) ?? todayInIstanbul();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid --date value: ${date}`);
  return { date, force: args.includes("--force") || args.includes("-f") };
}

async function main(): Promise<void> {
  await ensureDataDirs();
  const args = parseArgs(process.argv.slice(2));
  const source = await readJsonFile<SourceBundle | null>(`${storagePaths.sources}/${args.date}.json`, null);
  if (!source) throw new Error(`Source digestion needs data/sources/${args.date}.json`);
  const result = await ensureSourceDigest({ source, force: args.force });
  console.log(
    JSON.stringify(
      {
        status: result.status,
        date: result.digest.date,
        provider: result.digest.provider,
        model: result.digest.model,
        fallback_reason: result.digest.fallback_reason,
        source_count: result.digest.private_factual_digest.items.length,
        source_influence_packet_count: result.digest.source_influence_packet.length,
        public_digest_safe: result.digest.safety.valid,
        repeated_abstract_terms: result.digest.public_poetic_digest.repeated_abstract_terms
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
