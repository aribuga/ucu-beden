import type { UcuBedenState } from "../lib/types";

export function MemoryPanel({ state }: { state: UcuBedenState }) {
  return (
    <section className="section">
      <h2 className="section-title">Hafıza</h2>
      <div className="label-list">
        <div className="label-row">
          <span className="label">baskın</span>
          <span>{state.dominant_words.join(", ") || "henüz yok"}</span>
        </div>
        <div className="label-row">
          <span className="label">takıntılar</span>
          <span>{state.obsessions.join(", ") || "henüz yok"}</span>
        </div>
        <div className="label-row">
          <span className="label">kaçındığı</span>
          <span>{state.avoided_words.join(", ") || "henüz yok"}</span>
        </div>
        <div className="label-row">
          <span className="label">dönüp duran</span>
          <span>{state.poetic_drift.things_it_keeps_returning_to.join(", ") || "henüz yok"}</span>
        </div>
        <div className="label-row">
          <span className="label">unuttuğu</span>
          <span>{state.poetic_drift.things_it_is_forgetting.join(", ") || "henüz yok"}</span>
        </div>
      </div>
    </section>
  );
}
