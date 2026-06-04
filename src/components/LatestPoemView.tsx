import type { DailyPoem } from "../lib/types";

export function LatestPoemView({ poem }: { poem: DailyPoem }) {
  return (
    <section className="section">
      <p className="meta">{poem.date} / {poem.age_display}</p>
      <h2 className="poem-title">{poem.title}</h2>
      <pre className="poem-text">{poem.poem_text}</pre>
    </section>
  );
}
