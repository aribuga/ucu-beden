import { clamp, seededNumber } from "./random";
import type { InputPoemsAnalysis, Mood, SourceBundle, UcuBedenState } from "./types";

const defaultMood: Mood = {
  melancholy: 42,
  anger: 18,
  tenderness: 46,
  fatigue: 52,
  absurdity: 44,
  clarity: 32,
  desire: 30,
  hope: 34
};

const moodLabels: Record<keyof Mood, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

function drift(previous: number, target: number, weight = 0.35): number {
  return previous * (1 - weight) + target * weight;
}

export function calculateMood(params: {
  date: string;
  state: UcuBedenState;
  sources: SourceBundle;
  inputAnalysis: InputPoemsAnalysis;
}): { mood: Mood; sentence: string } {
  const previous = params.state.last_mood ?? defaultMood;
  const weather = params.sources.weather;
  const newsWeight = params.sources.turkey_news.emotional_weight;
  const artCuriosity = params.sources.art_world.curiosity;
  const rssScores = params.sources.rss?.dailyMoodSummary.moodScores;
  const geneticTone = params.inputAnalysis.global.tone;
  const age = params.state.age_months;
  const random = seededNumber(`${params.date}:mood`);
  const humidity = weather.humidity_percent ?? 60;
  const wind = weather.wind_kmh ?? 10;
  const memoryDensity = params.state.memory_density;

  const target: Mood = {
    melancholy: 38 + newsWeight * 0.25 + humidity * 0.15 + memoryDensity * 0.2,
    anger: 10 + newsWeight * 0.2 + (geneticTone.includes("panic-comic") ? 8 : 0),
    tenderness: 34 + (geneticTone.includes("bedensel") ? 9 : 0) + Math.min(age, 48) * 0.18,
    fatigue: 42 + humidity * 0.24 + newsWeight * 0.15 + Math.max(0, 20 - wind) * 0.4,
    absurdity: 34 + (geneticTone.includes("absürt") ? 16 : 8) + random * 16,
    clarity: 42 + wind * 0.45 - newsWeight * 0.12 - humidity * 0.08,
    desire: 24 + artCuriosity * 0.2 + (geneticTone.includes("yemekle bozulan") ? 7 : 0),
    hope: 26 + artCuriosity * 0.25 + wind * 0.22 - newsWeight * 0.08
  };

  if (rssScores) {
    target.melancholy += rssScores.melancholy * 1.8;
    target.anger += rssScores.anger * 2;
    target.tenderness += rssScores.tenderness * 1.6;
    target.fatigue += rssScores.fatigue * 2;
    target.absurdity += rssScores.absurdity * 1.8;
    target.clarity += rssScores.clarity * 1.6;
    target.desire += rssScores.desire * 1.7;
    target.hope += rssScores.hope * 1.5;
  }

  const mood: Mood = {
    melancholy: clamp(drift(previous.melancholy, target.melancholy)),
    anger: clamp(drift(previous.anger, target.anger)),
    tenderness: clamp(drift(previous.tenderness, target.tenderness)),
    fatigue: clamp(drift(previous.fatigue, target.fatigue)),
    absurdity: clamp(drift(previous.absurdity, target.absurdity)),
    clarity: clamp(drift(previous.clarity, target.clarity)),
    desire: clamp(drift(previous.desire, target.desire)),
    hope: clamp(drift(previous.hope, target.hope))
  };

  return { mood, sentence: moodSentence(mood, params.sources) };
}

export function moodSentence(mood: Mood, sources: SourceBundle): string {
  const body = mood.fatigue > 65 ? "gövdesi ağır" : mood.clarity > 45 ? "yüzü biraz açılmış" : "dili paslı";
  const news = sources.turkey_news.emotional_weight > 60 ? "haberlerden sonra içi kalabalık" : "haberleri yarım bırakmış";
  const tenderness = mood.tenderness > 55 ? "yine de koltuğa şefkatli bakıyor" : "eşyalarla az konuşuyor";
  const rss = sources.rss ? `${moodLabels[sources.rss.dailyMoodSummary.dominantMood]} noktaları çevresinde dönüyor` : "cümleleri sessizce daralıyor";
  const absurd = mood.absurdity > 55 ? "aklında komik görünen küçük bir panik var" : rss;

  return `Bugünkü hali: ${body}, ${news}, ${tenderness}; ${absurd}.`;
}
