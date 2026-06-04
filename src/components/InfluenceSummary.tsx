import type { DailyPoem } from "../lib/types";

export function InfluenceSummary({ poem }: { poem: DailyPoem }) {
  return (
    <section className="section">
      <h2 className="section-title">Etkiler</h2>
      <ul className="tag-list">
        {poem.influences.slice(0, 8).map((influence) => (
          <li key={influence}>{influence}</li>
        ))}
      </ul>
    </section>
  );
}
