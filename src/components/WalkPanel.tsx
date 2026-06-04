import type { WalkState } from "../lib/types";

export function WalkPanel({ walkState }: { walkState: WalkState }) {
  return (
    <section className="section">
      <h2 className="section-title">Yürüyüş</h2>
      <div className="label-list">
        <div className="label-row">
          <span className="label">rota</span>
          <span>{walkState.did_walk ? walkState.route_name ?? "adı olmayan rota" : "Bugün yürüyüş yok."}</span>
        </div>
        <div className="label-row">
          <span className="label">parça</span>
          <span>{walkState.current_segment}</span>
        </div>
        <div className="label-row">
          <span className="label">beden</span>
          <span>{walkState.weather_on_body}; {walkState.pace} tempo.</span>
        </div>
        <div className="label-row">
          <span className="label">görülen</span>
          <span>{walkState.seen_objects.join(", ")}</span>
        </div>
      </div>
    </section>
  );
}
