import { notFound } from "next/navigation";

import { InfluenceSummary } from "../../../components/InfluenceSummary";
import { LatestPoemView } from "../../../components/LatestPoemView";
import { MoodPanel } from "../../../components/MoodPanel";
import { NowPanel } from "../../../components/NowPanel";
import { UcuBedenHeader } from "../../../components/UcuBedenHeader";
import { getLatestPoem, listGeneratedPoems, readState } from "../../../lib/fileStorage";

type Props = {
  params: Promise<{ date: string }>;
};

export async function generateStaticParams() {
  const poems = await listGeneratedPoems();
  return poems.map((poem) => ({ date: poem.date }));
}

export default async function PoemDetailPage({ params }: Props) {
  const { date } = await params;
  const [latest, poems, state] = await Promise.all([getLatestPoem(), listGeneratedPoems(), readState()]);
  const poem = poems.find((item) => item.date === date);

  if (!poem) {
    notFound();
  }

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <MoodPanel mood={poem.mood} sentence={poem.mood_sentence} />
      <NowPanel dailyLife={poem.daily_life} walkState={poem.walk_state} />
      <LatestPoemView poem={poem} />
      <InfluenceSummary poem={poem} />
      <section className="section">
        <h2 className="section-title">Çağrılan Hafıza</h2>
        <ul className="tag-list">
          {poem.memory_fragments.map((fragment) => (
            <li key={fragment}>{fragment}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
