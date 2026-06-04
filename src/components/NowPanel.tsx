import type { DailyLife, WalkState } from "../lib/types";

export function NowPanel({ dailyLife, walkState }: { dailyLife: DailyLife; walkState: WalkState }) {
  return (
    <section className="section">
      <h2 className="section-title">ŞU AN</h2>
      <div className="label-list">
        <div className="label-row">
          <span className="label">ev</span>
          <span>{dailyLife.location}; {dailyLife.posture}. {dailyLife.activity}.</span>
        </div>
        <div className="label-row">
          <span className="label">dikkat</span>
          <span>{dailyLife.attention}. {dailyLife.room_light}.</span>
        </div>
        <div className="label-row">
          <span className="label">beden</span>
          <span>{dailyLife.body_state}; {dailyLife.movement}.</span>
        </div>
        <div className="label-row">
          <span className="label">yürüyüş</span>
          <span>
            {walkState.did_walk ? `${walkState.current_segment}; ${walkState.pace}.` : "Bugün yürüyüş yok."} {walkState.walk_influence}.
          </span>
        </div>
      </div>
    </section>
  );
}
