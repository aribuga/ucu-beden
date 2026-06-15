import Link from "next/link";

import { MemoryPanel } from "../../components/MemoryPanel";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { WordMutationPanel } from "../../components/WordMutationPanel";
import { YearlyReportCard } from "../../components/YearlyReportCard";
import { getLatestPoem, listMemoryTraces, listYearlyReports, readJsonFile, readMemoryReport, readState, storagePaths } from "../../lib/fileStorage";
import type { ImageMutation } from "../../lib/types";

export default async function MemoryPage() {
  const [latest, state, reports, imageMutations, memoryReport, memoryTraces] = await Promise.all([
    getLatestPoem(),
    readState(),
    listYearlyReports(),
    readJsonFile<{ mutations: ImageMutation[] }>(storagePaths.imageMutations, { mutations: [] }),
    readMemoryReport(),
    listMemoryTraces()
  ]);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <nav className="memory-section-nav" aria-label="Hafıza görünümleri">
        <Link className="is-active" aria-current="page" href="/memory">hafıza raporu</Link>
        <Link href="/memory/mutations">mutasyon grafiği</Link>
        <Link href="/memory-map">memory map</Link>
      </nav>
      <MemoryPanel state={state} report={memoryReport} traces={memoryTraces} />
      <WordMutationPanel mutations={imageMutations.mutations} />
      <section className="section">
        <h2 className="section-title">Yıl Raporları</h2>
        {reports.length === 0 ? <p>Henüz yıl raporu yok.</p> : reports.map((report) => <YearlyReportCard key={report.year} report={report} />)}
      </section>
    </main>
  );
}
