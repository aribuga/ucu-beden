import { ensureDataDirs } from "../lib/fileStorage";
import { analyzeAndSaveInputPoems } from "../lib/inputPoems";

async function main(): Promise<void> {
  await ensureDataDirs();
  const analysis = await analyzeAndSaveInputPoems();
  console.log(
    JSON.stringify(
      {
        status: "ok",
        files: analysis.files.length,
        poem_count: analysis.global.poem_count,
        word_count: analysis.global.word_count,
        dominant_words: analysis.global.dominant_words
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
