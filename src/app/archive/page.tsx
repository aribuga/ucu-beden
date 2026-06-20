import { ArchiveList } from "../../components/ArchiveList";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, listGeneratedPoems, readState } from "../../lib/fileStorage";

export default async function ArchivePage() {
  const [latest, poems, state] = await Promise.all([getLatestPoem(), listGeneratedPoems(), readState()]);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section">
        <h2 className="section-title">Arşiv</h2>
        {poems.length === 0 ? (
          <p>Henüz arşivlenmiş şiir yok.</p>
        ) : (
          <>
            <ArchiveList poems={poems} />
          </>
        )}
      </section>
    </main>
  );
}
