import type { YearlyReport } from "../lib/types";

export function YearlyReportCard({ report }: { report: YearlyReport }) {
  return (
    <article className="report-row">
      <div className="timeline-title">
        <strong>{report.year}. yıl</strong>
        <span className="tiny">{report.completed_at}</span>
      </div>
      <p>{report.summary}</p>
      <p className="tiny">{report.comparison_to_previous_year}</p>
    </article>
  );
}
