import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { UcuPhone, type PhoneGalleryItem, type PhoneNote, type UcuPhoneData } from "../../components/UcuPhone";
import {
  getLatestPoem,
  listDreams,
  listGeneratedPoems,
  readMemoryReport,
  readState,
  readVisual
} from "../../lib/fileStorage";
import { memoryClimateDetail, memoryClimateHeadline } from "../../lib/memoryPresentation";

export default async function PhonePage() {
  const [latest, poems, dreams, state, report] = await Promise.all([
    getLatestPoem(),
    listGeneratedPoems(),
    listDreams(),
    readState(),
    readMemoryReport()
  ]);

  const visualRecords = await Promise.all([
    ...poems.map((poem) => readVisual(poem.date, "poem")),
    ...dreams.map((dream) => readVisual(dream.date, "dream"))
  ]);

  const gallery: PhoneGalleryItem[] = visualRecords
    .filter((visual) => visual?.image_path)
    .map((visual) => ({
      id: `${visual!.date}-${visual!.type}`,
      date: visual!.date,
      type: visual!.type,
      title: visual!.title,
      imagePath: visual!.image_path!,
      altText: visual!.alt_text
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 24);

  const notes: PhoneNote[] = poems
    .slice()
    .reverse()
    .slice(0, 24)
    .map((poem) => ({
      date: poem.date,
      title: poem.title,
      text: poem.poem_text,
      moodSentence: poem.mood_sentence
    }));

  const data: UcuPhoneData = {
    date: latest?.date ?? state.last_generated_date,
    ageDisplay: latest?.age_display ?? `${state.age_months} ay`,
    dayCount: state.generated_days,
    moodSentence: latest?.mood_sentence ?? null,
    gallery,
    notes,
    weather: latest
      ? {
          summary: latest.sources.weather.summary,
          temperature: latest.sources.weather.temperature_c,
          humidity: latest.sources.weather.humidity_percent,
          wind: latest.sources.weather.wind_kmh,
          bodyEffect: latest.sources.weather.body_effect
        }
      : null,
    memory: {
      headline: memoryClimateHeadline(report),
      detail: report ? memoryClimateDetail(report) : "Henüz hafıza raporu yok.",
      traceCount: report?.trace_count ?? 0,
      recalledCount: report?.easily_recalled.length ?? 0,
      suppressedCount: report?.suppressed.length ?? 0,
      dreamReturnCount: report?.dream_returns.length ?? 0,
      indirectCount: report?.indirect_only.length ?? 0
    }
  };

  return (
    <main className="phone-page-shell">
      <div className="phone-page-header">
        <UcuBedenHeader latest={latest} state={state} />
      </div>
      <UcuPhone data={data} />
    </main>
  );
}
