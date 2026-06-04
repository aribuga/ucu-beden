import type { ImageMutation } from "../lib/types";

export function WordMutationPanel({ mutations }: { mutations: ImageMutation[] }) {
  return (
    <section className="section">
      <h2 className="section-title">İmge Mutasyonları</h2>
      {mutations.length === 0 ? (
        <p>Henüz mutasyon yok.</p>
      ) : (
        <div className="label-list">
          {mutations.map((mutation) => (
            <div className="label-row" key={`${mutation.from}-${mutation.to}`}>
              <span className="label">{mutation.from}</span>
              <span>{mutation.to}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
