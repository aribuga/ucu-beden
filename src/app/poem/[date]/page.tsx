import { notFound } from "next/navigation";

import { ConsciousnessPanel } from "../../../components/ConsciousnessPanel";
import { InfluenceSummary } from "../../../components/InfluenceSummary";
import { LatestPoemView } from "../../../components/LatestPoemView";
import { MoodPanel } from "../../../components/MoodPanel";
import { NowPanel } from "../../../components/NowPanel";
import { UcuBedenHeader } from "../../../components/UcuBedenHeader";
import { WalkPanel } from "../../../components/WalkPanel";
import { WordMutationPanel } from "../../../components/WordMutationPanel";
import { resolvePoemDayView } from "../../../lib/dayView";
import { getLatestPoem, listGeneratedPoems, readPersonalitySettings, readState } from "../../../lib/fileStorage";

type Props = {
  params: Promise<{ date: string }>;
};

export async function generateStaticParams() {
  const poems = await listGeneratedPoems();
  return poems.map((poem) => ({ date: poem.date }));
}

export default async function PoemDetailPage({ params }: Props) {
  const { date } = await params;
  const [latest, poems, state, personality] = await Promise.all([
    getLatestPoem(),
    listGeneratedPoems(),
    readState(),
    readPersonalitySettings()
  ]);
  const poem = poems.find((item) => item.date === date);
  if (!poem) notFound();
  const dayView = await resolvePoemDayView(poem, state, personality);

  return (
    <main className="site-shell home-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <div className="home-columns">
        <div className="home-primary">
          <LatestPoemView poem={poem} eyebrow="" />
          <MoodPanel mood={poem.mood} sentence={poem.mood_sentence} />
          <NowPanel dailyLife={poem.daily_life} walkState={poem.walk_state} />
          <WalkPanel walkState={poem.walk_state} />
          <InfluenceSummary poem={poem} />
          <section className="section">
            <h2 className="section-title">Çağrılan Hafıza</h2>
            <ul className="tag-list">
              {poem.memory_fragments.map((fragment) => <li key={fragment}>{fragment}</li>)}
            </ul>
          </section>
          <WordMutationPanel mutations={poem.analysis.image_mutations} />
        </div>
        <ConsciousnessPanel
          poem={poem}
          poemVisual={dayView.poemVisual}
          dream={dayView.dream}
          dreamVisual={dayView.dreamVisual}
          dailyLife={dayView.dailyLife}
          historical={dayView.isHistorical}
        />
      </div>
    </main>
  );
}
