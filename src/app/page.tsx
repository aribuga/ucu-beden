import { InfluenceSummary } from "../components/InfluenceSummary";
import { LatestPoemView } from "../components/LatestPoemView";
import { MoodPanel } from "../components/MoodPanel";
import { NowPanel } from "../components/NowPanel";
import { PoemTimeline } from "../components/PoemTimeline";
import { UcuBedenHeader } from "../components/UcuBedenHeader";
import { getLatestPoem, listGeneratedPoems, readState } from "../lib/fileStorage";

export default async function HomePage() {
  const [latest, poems, state] = await Promise.all([getLatestPoem(), listGeneratedPoems(), readState()]);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      {!latest ? (
        <section className="empty-state">
          <p>UCU BEDEN henüz bugün yazmadı.</p>
          <p>
            İlk şiiri üretmek için <span className="command">npm run generate:today</span> çalıştır.
          </p>
        </section>
      ) : (
        <>
          <LatestPoemView poem={latest} showTodayTicker />
          <MoodPanel mood={latest.mood} sentence={latest.mood_sentence} />
          <NowPanel dailyLife={latest.daily_life} walkState={latest.walk_state} />
          <InfluenceSummary poem={latest} />
          <PoemTimeline poems={poems.slice(-12)} />
        </>
      )}
    </main>
  );
}
