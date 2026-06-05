import Link from "next/link";

import { SourceInfluencePanel } from "../../components/SourceInfluencePanel";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, listSources, readState } from "../../lib/fileStorage";

export default async function SourcesPage() {
  const [latest, state, sources] = await Promise.all([getLatestPoem(), readState(), listSources()]);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section">
        <h2 className="section-title">Kaynak Günlüğü</h2>
        <p>
          <Link href="/mood-map">Mood-map sayfasına git</Link>
          {" / "}
          <Link href="/sources/health">Kaynak sağlığı</Link>
        </p>
        {sources.length === 0 ? (
          <p>Henüz kaynak günlüğü yok.</p>
        ) : (
          sources.slice().reverse().map((source) => <SourceInfluencePanel key={source.date} source={source} />)
        )}
      </section>
    </main>
  );
}
