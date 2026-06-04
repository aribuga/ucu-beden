import type { DailyPoem } from "../lib/types";

function buildTodayTicker(poem: DailyPoem) {
  const fragments = [
    poem.mood_sentence,
    `${poem.daily_life.location}; ${poem.daily_life.posture}; ${poem.daily_life.activity}.`,
    `${poem.daily_life.attention}; ${poem.daily_life.room_light}.`,
    poem.walk_state.did_walk
      ? `${poem.walk_state.route_name}: ${poem.walk_state.current_segment}; ${poem.walk_state.weather_on_body}.`
      : poem.walk_state.line_written_while_walking,
  ].filter(Boolean);

  return fragments.join(" /// ");
}

export function LatestPoemView({
  poem,
  eyebrow = "SON ŞİİR",
  showTodayTicker = false,
}: {
  poem: DailyPoem;
  eyebrow?: string;
  showTodayTicker?: boolean;
}) {
  const todayTicker = showTodayTicker ? buildTodayTicker(poem) : "";

  return (
    <section className="section">
      {eyebrow ? <p className="poem-eyebrow">{eyebrow}</p> : null}
      {todayTicker ? (
        <div className="poem-ticker" aria-label={todayTicker}>
          <span className="poem-ticker-track">{todayTicker}</span>
        </div>
      ) : null}
      <p className="meta">{poem.date} / {poem.age_display}</p>
      <h2 className="poem-title">{poem.title}</h2>
      <pre className="poem-text">{poem.poem_text}</pre>
      <p className="poem-signature">Ucu Beden</p>
    </section>
  );
}
