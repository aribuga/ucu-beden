import Link from "next/link";

import { MemoryMutationGraph } from "../../../components/MemoryMutationGraph";
import { UcuBedenHeader } from "../../../components/UcuBedenHeader";
import {
  getLatestPoem,
  listDreams,
  listGeneratedPoems,
  listMemoryTraces,
  listSources,
  readMemoryIndex,
  readMemoryReport,
  readState
} from "../../../lib/fileStorage";
import { buildMemoryGraphData } from "../../../lib/memoryGraph";

export default async function MemoryMutationsPage() {
  const [latest, state, report, index, traces, poems, dreams, sources] = await Promise.all([
    getLatestPoem(),
    readState(),
    readMemoryReport(),
    readMemoryIndex(),
    listMemoryTraces(),
    listGeneratedPoems(),
    listDreams(),
    listSources()
  ]);
  const graph = report && index && traces.length > 0
    ? await buildMemoryGraphData({ traces, report, index, poems, dreams, sources })
    : null;

  return (
    <main className="site-shell mutation-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <nav className="memory-section-nav" aria-label="Hafıza görünümleri">
        <Link href="/memory">hafıza raporu</Link>
        <Link className="is-active" aria-current="page" href="/memory/mutations">mutasyon grafiği</Link>
      </nav>
      {!graph || graph.nodes.length === 0 ? (
        <section className="empty-state">
          <p>Görselleştirilecek public-safe hafıza bağlantısı yok.</p>
        </section>
      ) : (
        <MemoryMutationGraph data={graph} />
      )}
    </main>
  );
}
