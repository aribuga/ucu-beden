import type { CSSProperties } from "react";

import { moodColors, moodEmojis, moodLabels } from "../lib/moodVisuals";
import type { MoodKey, MoodTaggedSourceItem } from "../lib/types";

function scoreIntensity(item: MoodTaggedSourceItem): number {
  return Object.values(item.moodScores).reduce((sum, value) => sum + value, 0);
}

export function MoodDot({ item, index }: { item: MoodTaggedSourceItem; index: number }) {
  const dominant = item.moodTags[0] ?? ("clarity" as MoodKey);
  const size = 18 + Math.min(34, scoreIntensity(item));
  const style = {
    "--dot-x": `${8 + ((index * 37) % 84)}%`,
    "--dot-y": `${12 + ((index * 53) % 76)}%`,
    "--dot-size": `${size}px`,
    "--dot-color": moodColors[dominant]
  } as CSSProperties;
  const content = (
    <>
      <span aria-hidden="true">{moodEmojis[dominant]}</span>
      <span className="mood-tooltip">
        <strong>{item.title}</strong>
        <br />
        {item.source} / {moodLabels[dominant]}
        <br />
        {item.shortAtmosphere}
      </span>
    </>
  );

  if (item.url) {
    return (
      <a className="mood-dot" href={item.url} style={style} title={`${item.source}: ${item.title}`}>
        {content}
      </a>
    );
  }

  return (
    <span className="mood-dot" style={style} title={`${item.source}: ${item.title}`}>
      {content}
    </span>
  );
}
