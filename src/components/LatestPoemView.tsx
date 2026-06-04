import type { DailyPoem } from "../lib/types";

export function LatestPoemView({ poem, eyebrow = "SON ŞİİR" }: { poem: DailyPoem; eyebrow?: string }) {
  return (
    <section className="section">
      {eyebrow ? <p className="poem-eyebrow">{eyebrow}</p> : null}
      <p className="meta">{poem.date} / {poem.age_display}</p>
      <h2 className="poem-title">{poem.title}</h2>
      <pre className="poem-text">{poem.poem_text}</pre>
      <p className="poem-signature">Ucu Beden</p>
    </section>
  );
}
