import type { DailyPoem, UcuBedenState } from "../lib/types";

export function AgePanel({ latest, state }: { latest: DailyPoem | null; state: UcuBedenState }) {
  return (
    <section className="section">
      <h2 className="section-title">Yaş</h2>
      <div className="label-list">
        <div className="label-row">
          <span className="label">görünen</span>
          <span>{latest?.age_display ?? `${state.age_months} ay`}</span>
        </div>
        <div className="label-row">
          <span className="label">ay</span>
          <span>{state.age_months}</span>
        </div>
        <div className="label-row">
          <span className="label">kural</span>
          <span>Her üretilen gün 1 ay. 12 gün 1 yıl. Evre hardcode edilmez.</span>
        </div>
      </div>
    </section>
  );
}
