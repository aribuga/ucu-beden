import Link from "next/link";

import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { VisualMemoryMap } from "../../components/VisualMemoryMap";
import {
  getLatestPoem,
  listDreams,
  listGeneratedPoems,
  listMemoryTraces,
  listSources,
  readMemoryIndex,
  readMemoryReport,
  readState
} from "../../lib/fileStorage";
import { buildMemoryGraphData } from "../../lib/memoryGraph";
import { buildVisualMemoryMapData } from "../../lib/visualMemoryMap";

export default async function MemoryMapPage() {
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
  const latestDream = dreams.at(-1) ?? null;
  const graph = report && index && traces.length > 0
    ? await buildMemoryGraphData({ traces, report, index, poems, dreams, sources })
    : null;
  const map = graph
    ? await buildVisualMemoryMapData({ graph, latestPoem: latest, latestDream, sources })
    : null;

  return (
    <main className="site-shell memory-map-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <nav className="memory-section-nav" aria-label="Hafıza görünümleri">
        <Link href="/memory">hafıza raporu</Link>
        <Link href="/memory/mutations">mutasyon grafiği</Link>
        <Link className="is-active" aria-current="page" href="/memory-map">memory map</Link>
      </nav>
      {!map || map.nodes.length === 0 ? (
        <section className="empty-state">
          <p>Yakın hafıza alanını kuracak public-safe iz yok.</p>
        </section>
      ) : (
        <VisualMemoryMap data={map} />
      )}
    </main>
  );
}
