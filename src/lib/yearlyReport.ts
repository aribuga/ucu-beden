import { listGeneratedPoems, readJsonFile, storagePaths, writeJsonFile } from "./fileStorage";
import { tokenize, topWords } from "./inputPoems";
import { extractImages } from "./memoryEngine";
import type { DailyPoem, YearlyReport } from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function maybeCreateYearlyReport(poem: DailyPoem): Promise<YearlyReport | null> {
  if (poem.age_months === 0 || poem.age_months % 12 !== 0) {
    return null;
  }

  const year = poem.age_months / 12;
  const fileName = `${storagePaths.yearlyReports}/year_${String(year).padStart(2, "0")}.json`;
  const existing = await readJsonFile<YearlyReport | null>(fileName, null);
  if (existing) {
    return existing;
  }

  const poems = await listGeneratedPoems();
  const currentYearPoems = poems.slice(-12);
  const previousYearPoems = poems.slice(-24, -12);
  const currentWords = currentYearPoems.flatMap((item) => tokenize(item.poem_text));
  const previousAvg = average(previousYearPoems.map((item) => item.analysis.word_count));
  const currentAvg = average(currentYearPoems.map((item) => item.analysis.word_count));
  const recurringImages = Array.from(new Set(currentYearPoems.flatMap((item) => item.analysis.new_images.length ? item.analysis.new_images : extractImages(item.poem_text)))).slice(0, 12);
  const dominantWords = topWords(currentWords, 12);
  const walkSegments = Array.from(new Set(currentYearPoems.map((item) => item.walk_state.current_segment))).slice(0, 6);
  const homeObjects = Array.from(new Set(currentYearPoems.map((item) => item.daily_life.object_focus))).slice(0, 6);

  const comparison =
    previousYearPoems.length === 0
      ? "İlk yıl olduğu için önceki yılla karşılaştırma yok."
      : currentAvg < previousAvg
        ? "Önceki yıla göre daha kısa ve sıkışık şiirler yazdı."
        : currentAvg > previousAvg
          ? "Önceki yıla göre cümleleri biraz uzadı."
          : "Önceki yıla yakın uzunlukta şiirler yazdı.";

  const summary = `UCU BEDEN ${year} yaşını doldurdu. Bu yıl ${dominantWords
    .slice(0, 6)
    .join(", ")} kelimelerine döndü; ${walkSegments.slice(0, 2).join(" ve ")} arasında hafızası değişti.`;

  const report: YearlyReport = {
    year,
    age_months: poem.age_months,
    completed_at: poem.date,
    poem_count: currentYearPoems.length,
    dominant_words: dominantWords,
    recurring_images: recurringImages,
    average_word_count: currentAvg,
    comparison_to_previous_year: comparison,
    home_observations: homeObjects.map((object) => `${object} şiirde ev içi bir işaret olarak döndü.`),
    walk_observations: walkSegments.map((segment) => `${segment} yürüyüş ritmini etkiledi.`),
    memory_observations: [
      "Haberleri doğrudan söylemek yerine nesnelere saklamaya çalıştı.",
      recurringImages.length > 0
        ? `${recurringImages[0]} imgesi yanlış/eksik hatırlanarak geri dönebilir.`
        : "İmgeler henüz belirgin bir yıl izi bırakmadı."
    ],
    summary
  };

  await writeJsonFile(fileName, report);
  return report;
}
