import { listGeneratedPoems } from "../lib/fileStorage";
import { formatMoodSentence } from "../lib/moodSentence";

async function main(): Promise<void> {
  const poems = await listGeneratedPoems();
  const grouped = new Map<string, string[]>();

  if (poems.length === 0) {
    console.log("Henüz üretilmiş şiir yok.");
    return;
  }

  for (const poem of poems) {
    const sentence = formatMoodSentence(poem.mood_sentence);
    console.log(`${poem.date} — ${poem.title} — ${sentence || "(mood_sentence boş)"}`);

    const dates = grouped.get(sentence) ?? [];
    dates.push(poem.date);
    grouped.set(sentence, dates);
  }

  const duplicates = Array.from(grouped.entries()).filter(([sentence, dates]) => sentence && dates.length > 1);
  if (duplicates.length === 0) {
    console.log("\nTekrarlanan mood cümlesi bulunmadı.");
    return;
  }

  console.log("\nTekrarlanan mood cümleleri:");
  for (const [sentence, dates] of duplicates) {
    console.log(`- ${dates.join(", ")} — ${sentence}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
