import { MemoryPanel } from "../../components/MemoryPanel";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { WordMutationPanel } from "../../components/WordMutationPanel";
import { YearlyReportCard } from "../../components/YearlyReportCard";
import { getLatestPoem, listYearlyReports, readJsonFile, readState, storagePaths } from "../../lib/fileStorage";
import type { ImageMutation } from "../../lib/types";

export default async function MemoryPage() {
  const [latest, state, reports, imageMutations] = await Promise.all([
    getLatestPoem(),
    readState(),
    listYearlyReports(),
    readJsonFile<{ mutations: ImageMutation[] }>(storagePaths.imageMutations, { mutations: [] })
  ]);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <MemoryPanel state={state} />
      <WordMutationPanel mutations={imageMutations.mutations} />
      <section className="section">
        <h2 className="section-title">Yıl Raporları</h2>
        {reports.length === 0 ? <p>Henüz yıl raporu yok.</p> : reports.map((report) => <YearlyReportCard key={report.year} report={report} />)}
      </section>
    </main>
  );
}
