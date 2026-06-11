import { ConsciousnessPanel } from "../components/ConsciousnessPanel";
import { CurrentStatePanel } from "../components/CurrentStatePanel";
import { InfluenceSummary } from "../components/InfluenceSummary";
import { LatestPoemView } from "../components/LatestPoemView";
import { MoodPanel } from "../components/MoodPanel";
import { NowPanel } from "../components/NowPanel";
import { PoemTimeline } from "../components/PoemTimeline";
import { UcuBedenHeader } from "../components/UcuBedenHeader";
import { createDailyLifeRecord } from "../lib/dayStateEngine";
import { getLatestDream, getLatestPoem, listGeneratedPoems, readDailyLife, readPersonalitySettings, readState, readVisual } from "../lib/fileStorage";
import { createDreamVisual, createPoemVisual } from "../lib/visualEngine";

export default async function HomePage() {
  const [latest, poems, state, latestDream, personality] = await Promise.all([
    getLatestPoem(),
    listGeneratedPoems(),
    readState(),
    getLatestDream(),
    readPersonalitySettings()
  ]);
  const [storedDailyLife, storedPoemVisual, storedDreamVisual] = latest
    ? await Promise.all([
        readDailyLife(latest.date),
        readVisual(latest.date, "poem"),
        latestDream ? readVisual(latestDream.date, "dream") : Promise.resolve(null)
      ])
    : [null, null, null];
  const dailyLife = latest
    ? storedDailyLife ??
      createDailyLifeRecord({
        date: latest.date,
        base: latest.daily_life,
        mood: latest.mood,
        sources: latest.sources,
        state,
        personality
      })
    : null;

  return (
    <main className="site-shell home-shell">
      <UcuBedenHeader latest={latest} state={state} />
      {!latest ? (
        <section className="empty-state">
          <p>UCU BEDEN henüz bugün yazmadı.</p>
          <p>
            İlk şiiri üretmek için <span className="command">npm run generate:today</span> çalıştır.
          </p>
        </section>
      ) : (
        <div className="home-columns">
          <div className="home-primary">
            <LatestPoemView poem={latest} showTodayTicker />
            <MoodPanel mood={latest.mood} sentence={latest.mood_sentence} />
            <NowPanel dailyLife={latest.daily_life} walkState={latest.walk_state} />
            <InfluenceSummary poem={latest} />
            <PoemTimeline poems={poems.slice(-12)} />
            {dailyLife ? <CurrentStatePanel dailyLife={dailyLife} /> : null}
          </div>
          {dailyLife ? (
            <ConsciousnessPanel
              poem={latest}
              poemVisual={storedPoemVisual ?? createPoemVisual(latest)}
              dream={latestDream}
              dreamVisual={latestDream ? storedDreamVisual ?? createDreamVisual(latestDream) : null}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
