import type { MoodKey } from "./types";

export const moodLabels: Record<MoodKey, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

export const moodColors: Record<MoodKey, string> = {
  melancholy: "#5b6c8f",
  anger: "#d94a38",
  tenderness: "#f2a6b3",
  fatigue: "#8b8178",
  absurdity: "#b56cff",
  clarity: "#6bb7d6",
  desire: "#ff7a90",
  hope: "#f1c84b"
};

export const moodEmojis: Record<MoodKey, string> = {
  melancholy: "☂",
  anger: "!",
  tenderness: "♡",
  fatigue: "…",
  absurdity: "?",
  clarity: "◇",
  desire: "*",
  hope: "+"
};
