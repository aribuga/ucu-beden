import { DreamArchiveCard } from "../../components/DreamArchiveCard";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, listDreams, readState, readVisual } from "../../lib/fileStorage";
import { createDreamVisual } from "../../lib/visualEngine";

export default async function DreamsPage() {
  const [latest, dreams, state] = await Promise.all([getLatestPoem(), listDreams(), readState()]);
  const records = await Promise.all(
    dreams.slice().reverse().map(async (dream) => ({
      dream,
      visual: (await readVisual(dream.date, "dream")) ?? createDreamVisual(dream)
    }))
  );

  return (
    <main className="site-shell dreams-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section dream-archive-section">
        <h1 className="section-title">Rüyalar</h1>
        {records.length ? (
          <div className="dream-archive-grid">
            {records.map(({ dream, visual }) => <DreamArchiveCard key={dream.date} dream={dream} visual={visual} />)}
          </div>
        ) : (
          <p>Gece henüz arşive bir şey bırakmadı.</p>
        )}
      </section>
    </main>
  );
}
