import { ConsciousnessPanel } from "../components/ConsciousnessPanel";
import { InfluenceSummary } from "../components/InfluenceSummary";
import { LatestPoemView } from "../components/LatestPoemView";
import { MoodPanel } from "../components/MoodPanel";
import { NowPanel } from "../components/NowPanel";
import { PoemTimeline } from "../components/PoemTimeline";
import { UcuBedenHeader } from "../components/UcuBedenHeader";
import { resolvePoemDayView } from "../lib/dayView";
import { getLatestPoem, listGeneratedPoems, readPersonalitySettings, readState } from "../lib/fileStorage";

export default async function HomePage() {
  const [latest, poems, state, personality] = await Promise.all([
    getLatestPoem(),
    listGeneratedPoems(),
    readState(),
    readPersonalitySettings()
  ]);
  const dayView = latest ? await resolvePoemDayView(latest, state, personality, { preferLatestDream: true }) : null;

  return (
    <main className="site-shell home-shell">
      <UcuBedenHeader latest={latest} state={state} />
      {!latest ? (
        <section className="empty-state">
          <p>UCU BEDEN henüz bugün yazmadı.</p>
          <p>İlk şiiri üretmek için <span className="command">npm run generate:today</span> çalıştır.</p>
        </section>
      ) : (
        <div className="home-columns">
          <div className="home-primary">
            <LatestPoemView poem={latest} showTodayTicker />
            <MoodPanel mood={latest.mood} sentence={latest.mood_sentence} />
            <NowPanel dailyLife={latest.daily_life} walkState={latest.walk_state} />
            <InfluenceSummary poem={latest} />
            <PoemTimeline poems={poems.slice(-12)} />
          </div>
          {dayView ? (
            <ConsciousnessPanel
              poem={latest}
              poemVisual={dayView.poemVisual}
              dream={dayView.dream}
              dreamVisual={dayView.dreamVisual}
              dailyLife={dayView.dailyLife}
              historical={dayView.isHistorical}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
