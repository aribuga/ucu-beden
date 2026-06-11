import Link from "next/link";
import { notFound } from "next/navigation";

import { UcuBedenHeader } from "../../../components/UcuBedenHeader";
import { VisualField } from "../../../components/VisualField";
import { getLatestPoem, listDreams, listGeneratedPoems, readState, readVisual } from "../../../lib/fileStorage";
import { createDreamVisual } from "../../../lib/visualEngine";

type Props = { params: Promise<{ date: string }> };

export async function generateStaticParams() {
  const dreams = await listDreams();
  return dreams.length ? dreams.map((dream) => ({ date: dream.date })) : [{ date: "__empty__" }];
}

export default async function DreamDetailPage({ params }: Props) {
  const { date } = await params;
  const [latest, dreams, poems, state] = await Promise.all([getLatestPoem(), listDreams(), listGeneratedPoems(), readState()]);
  const dream = dreams.find((item) => item.date === date);
  if (!dream) notFound();
  const visual = (await readVisual(dream.date, "dream")) ?? createDreamVisual(dream);
  const linkedPoem = poems.find((poem) => poem.date === dream.source_date);

  return (
    <main className="site-shell dream-detail-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <div className="dream-detail-grid">
        <section className="section">
          <p className="poem-eyebrow">{dream.date} / gece kaydı</p>
          <h1 className="poem-title">{dream.title}</h1>
          <pre className="poem-text">{dream.dream_text}</pre>
          <p className="tiny">uyanınca: {dream.mood_after}</p>
          <ul className="tag-list">{dream.symbols.map((symbol) => <li key={symbol}>{symbol}</li>)}</ul>
          <p className="tiny">üretildi: {dream.generated_at}</p>
          {linkedPoem ? <Link href={`/poem/${linkedPoem.date}`}>bağlı olduğu şiire git</Link> : null}
        </section>
        <section className="consciousness-module">
          <div className="consciousness-heading"><h2>rüya görüntüsü</h2><span>4:5</span></div>
          <VisualField visual={visual} kind="dream" />
        </section>
      </div>
    </main>
  );
}
