import type { Mood } from "../lib/types";

const labels: Array<[keyof Mood, string]> = [
  ["melancholy", "melankoli"],
  ["anger", "öfke"],
  ["tenderness", "şefkat"],
  ["fatigue", "yorgunluk"],
  ["absurdity", "absürtlük"],
  ["clarity", "açıklık"],
  ["desire", "arzu"],
  ["hope", "umut"]
];

export function MoodPanel({ mood, sentence }: { mood: Mood; sentence: string }) {
  return (
    <section className="section">
      <h2 className="section-title">Ruh Hali</h2>
      <p>{sentence}</p>
      <div className="mood-grid">
        {labels.map(([key, label]) => (
          <div className="mood-row" key={key}>
            <span className="label">{label}</span>
            <span className="bar" aria-label={`${label}: ${mood[key]}`}>
              <span style={{ width: `${mood[key]}%` }} />
            </span>
            <span className="tiny">{mood[key]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
