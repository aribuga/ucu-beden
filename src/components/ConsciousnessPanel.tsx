import type { DailyLifeRecord, DailyPoem, DreamRecord, VisualMetadata } from "../lib/types";
import { CurrentStatePanel } from "./CurrentStatePanel";
import { DayCyclePanel } from "./DayCyclePanel";
import { VisualField } from "./VisualField";

export function ConsciousnessPanel({
  poem,
  poemVisual,
  dream,
  dreamVisual,
  dailyLife,
  historical = false
}: {
  poem: DailyPoem;
  poemVisual: VisualMetadata;
  dream: DreamRecord | null;
  dreamVisual: VisualMetadata | null;
  dailyLife: DailyLifeRecord;
  historical?: boolean;
}) {
  return (
    <aside className="consciousness-panel" aria-label="UCU BEDEN görsel bilinç alanı">
      <CurrentStatePanel dailyLife={dailyLife} historical={historical} />
      <DayCyclePanel historical={historical} recordedTime={dailyLife.generated_at || dailyLife.wake_time} />

      <section className="consciousness-module poem-feeling-module">
        <div className="consciousness-heading">
          <h2>{historical ? "o günkü şiirin hissi" : "bugünkü şiirin hissi"}</h2>
          <span>{poem.date}</span>
        </div>
        <VisualField visual={poemVisual} kind="poem" />
        <p className="consciousness-title">{poem.title}</p>
      </section>

      <section className="consciousness-module dream-module">
        <div className="consciousness-heading">
          <h2>{historical ? "o güne ait rüya" : "son rüya"}</h2>
          <span>{dream ? "02:00 kaydı" : "henüz yok"}</span>
        </div>
        {dream && dreamVisual ? (
          <>
            <VisualField visual={dreamVisual} kind="dream" />
            <p className="consciousness-title">{dream.title}</p>
            <p className="dream-snippet">{dream.dream_text.split(/\r?\n/).slice(0, 2).join(" ")}</p>
          </>
        ) : (
          <div className="dream-empty">gece henüz dosyasını bırakmadı.</div>
        )}
      </section>
    </aside>
  );
}
