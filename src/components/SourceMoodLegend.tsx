import type { CSSProperties } from "react";

import { moodColors, moodEmojis, moodLabels } from "../lib/moodVisuals";
import type { MoodKey } from "../lib/types";

const moodOrder: MoodKey[] = ["melancholy", "anger", "tenderness", "fatigue", "absurdity", "clarity", "desire", "hope"];

export function SourceMoodLegend() {
  return (
    <section className="section">
      <h2 className="section-title">Mood Renkleri</h2>
      <ul className="mood-legend">
        {moodOrder.map((mood) => (
          <li key={mood}>
            <span className="legend-swatch" style={{ "--swatch": moodColors[mood] } as CSSProperties} />
            <span>{moodEmojis[mood]} {moodLabels[mood]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
