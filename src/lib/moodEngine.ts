import { clamp, seededNumber, seededPick } from "./random";
import type { InputPoemsAnalysis, Mood, MoodEvent, MoodGenerationMetadata, MoodKey, SourceBundle, UcuBedenState } from "./types";

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

const moodKeys: MoodKey[] = ["melancholy", "anger", "tenderness", "fatigue", "absurdity", "clarity", "desire", "hope"];

const moodLabels: Record<MoodKey, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

type MoodEventCandidate = MoodEvent & {
  effects: Partial<Record<MoodKey, number>>;
};

function bounded(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function drift(previous: number, target: number): number {
  const distance = Math.abs(target - previous);
  const releaseHighPlateau = previous > 70 && target < previous;
  const weight = releaseHighPlateau ? 0.62 : distance < 4 ? 0.46 : 0.54;
  return previous * (1 - weight) + target * weight;
}

function dominantAxis(mood: Mood): MoodKey {
  return (moodKeys.map((key) => [key, mood[key]] as const).sort((a, b) => b[1] - a[1])[0][0]);
}

function moodDistance(a: Mood, b: Mood): number {
  return moodKeys.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0) / moodKeys.length;
}

function moodDelta(current: Mood, previous: Mood): Record<MoodKey, number> {
  return moodKeys.reduce((delta, key) => {
    delta[key] = current[key] - previous[key];
    return delta;
  }, {} as Record<MoodKey, number>);
}

function dailyVariation(date: string): Record<MoodKey, number> {
  return moodKeys.reduce((variation, key) => {
    const raw = (seededNumber(`${date}:mood:variation:${key}`) - 0.5) * 10;
    const pushed = Math.abs(raw) < 1.5 ? (raw < 0 ? -1.5 : 1.5) : raw;
    variation[key] = rounded(pushed);
    return variation;
  }, {} as Record<MoodKey, number>);
}

function chooseMoodEvent(params: {
  date: string;
  newsWeight: number;
  artCuriosity: number;
  humidity: number;
  wind: number;
  memoryPressure: number;
}): MoodEventCandidate {
  const intensity = rounded(0.75 + seededNumber(`${params.date}:mood:event:intensity`) * 0.65);
  const candidates: MoodEventCandidate[] = [];

  if (params.newsWeight >= 42) {
    candidates.push({
      type: "source_pressure",
      primary_axis: "anger",
      secondary_axis: "fatigue",
      intensity,
      description: "kaynak basıncı içeri giriyor ama bütün odayı ele geçirmiyor",
      effects: {
        anger: 4 + params.newsWeight * 0.04,
        fatigue: 3 + params.newsWeight * 0.03,
        clarity: -3,
        hope: -2
      }
    });
  }

  if (params.wind >= 12 || params.humidity <= 55) {
    candidates.push({
      type: "weather_lift",
      primary_axis: "clarity",
      secondary_axis: "hope",
      intensity,
      description: "hava kısa bir açıklık bırakıyor",
      effects: {
        clarity: 6 + params.wind * 0.16,
        hope: 4,
        fatigue: -4,
        melancholy: -2
      }
    });
  }

  if (params.humidity >= 62) {
    candidates.push({
      type: "heavy_air",
      primary_axis: "fatigue",
      secondary_axis: "tenderness",
      intensity,
      description: "nem bedeni yavaşlatıyor, ama sesi tek renge boyamıyor",
      effects: {
        fatigue: 5 + (params.humidity - 60) * 0.08,
        tenderness: 3,
        anger: -2,
        desire: -2
      }
    });
  }

  if (params.artCuriosity >= 25) {
    candidates.push({
      type: "aesthetic_spark",
      primary_axis: "desire",
      secondary_axis: "clarity",
      intensity,
      description: "görsel merak küçük bir kıvılcım bırakıyor",
      effects: {
        desire: 5 + params.artCuriosity * 0.05,
        clarity: 4,
        hope: 3,
        fatigue: -2
      }
    });
  }

  if (params.memoryPressure >= 0.45) {
    candidates.push({
      type: "memory_echo",
      primary_axis: "tenderness",
      secondary_axis: "absurdity",
      intensity,
      description: "hafıza baskısı doğrudan melankoliye değil, eşyanın tuhaflığına sızıyor",
      effects: {
        tenderness: 4 + params.memoryPressure * 4,
        absurdity: 3 + params.memoryPressure * 3,
        melancholy: (seededNumber(`${params.date}:mood:memory:melancholy`) - 0.5) * 5,
        clarity: -2
      }
    });
  }

  if (params.memoryPressure >= 0.72) {
    candidates.push({
      type: "memory_reordering",
      primary_axis: "clarity",
      secondary_axis: "desire",
      intensity,
      description: "yoğun hafıza bugün biraz düzen arıyor",
      effects: {
        clarity: 5,
        desire: 3,
        melancholy: -3,
        fatigue: -2
      }
    });
  }

  candidates.push(
    {
      type: "domestic_tenderness",
      primary_axis: "tenderness",
      secondary_axis: "hope",
      intensity,
      description: "ev içi ayrıntı şefkati sessizce öne çıkarıyor",
      effects: { tenderness: 6, hope: 3, anger: -3, melancholy: -1 }
    },
    {
      type: "comic_misalignment",
      primary_axis: "absurdity",
      secondary_axis: "anger",
      intensity,
      description: "günün mantığı biraz yamuk basıyor",
      effects: { absurdity: 6, anger: 2, clarity: -2, desire: 2 }
    }
  );

  const selected = seededPick(candidates, `${params.date}:mood:event`);
  return {
    ...selected,
    effects: Object.fromEntries(
      Object.entries(selected.effects).map(([key, value]) => [key, rounded((value ?? 0) * selected.intensity)])
    ) as Partial<Record<MoodKey, number>>
  };
}

function applyEffects(target: Mood, effects: Partial<Record<MoodKey, number>>): Mood {
  return moodKeys.reduce((next, key) => {
    next[key] = target[key] + (effects[key] ?? 0);
    return next;
  }, { ...target });
}

function recentFlatness(state: UcuBedenState, candidate: Mood): { flat: boolean; reason: string | null; lowVarianceAxes: MoodKey[] } {
  const recent = state.mood_history.slice(-5).map((entry) => entry.mood);
  if (recent.length < 5) return { flat: false, reason: null, lowVarianceAxes: [] };

  const pairDistances = recent.slice(1).map((mood, index) => moodDistance(recent[index], mood));
  const averageDistance = pairDistances.reduce((sum, value) => sum + value, 0) / pairDistances.length;
  const candidateDistance = moodDistance(recent.at(-1) ?? candidate, candidate);
  const dominantRepeatCount = new Set(recent.map(dominantAxis)).size;
  const axisRanges = moodKeys
    .map((key) => {
      const values = recent.map((mood) => mood[key]);
      return { key, range: Math.max(...values) - Math.min(...values) };
    })
    .sort((a, b) => a.range - b.range);
  const lowVarianceAxes = axisRanges.slice(0, 4).map((entry) => entry.key);

  if (averageDistance < 3.25 && candidateDistance < 4.25) {
    return { flat: true, reason: "recent_mood_distance_low", lowVarianceAxes };
  }

  if (dominantRepeatCount <= 1 && candidateDistance < 5.5) {
    return { flat: true, reason: "dominant_axis_repeated", lowVarianceAxes };
  }

  return { flat: false, reason: null, lowVarianceAxes };
}

function applyAntiFlatness(params: { date: string; state: UcuBedenState; mood: Mood }): {
  mood: Mood;
  antiFlatness: MoodGenerationMetadata["anti_flatness"];
} {
  const flatness = recentFlatness(params.state, params.mood);
  if (!flatness.flat || flatness.lowVarianceAxes.length === 0) {
    return { mood: params.mood, antiFlatness: { applied: false, reason: null, adjusted_axes: [] } };
  }

  const primary = seededPick(flatness.lowVarianceAxes, `${params.date}:mood:anti-flatness:primary`);
  const secondary = seededPick(moodKeys.filter((key) => key !== primary), `${params.date}:mood:anti-flatness:secondary`);
  const direction = params.mood[primary] > 72 ? -1 : params.mood[primary] < 28 ? 1 : seededNumber(`${params.date}:mood:anti-flatness:direction`) >= 0.5 ? 1 : -1;
  const amount = 8 + Math.round(seededNumber(`${params.date}:mood:anti-flatness:amount`) * 4);
  const next = { ...params.mood };
  next[primary] = clamp(next[primary] + direction * amount);
  next[secondary] = clamp(next[secondary] - direction * Math.round(amount * 0.55));

  return {
    mood: next,
    antiFlatness: {
      applied: true,
      reason: flatness.reason,
      adjusted_axes: [primary, secondary]
    }
  };
}

function strongestChanges(delta: Record<MoodKey, number>): Array<[MoodKey, number]> {
  return moodKeys.map((key) => [key, delta[key]] as [MoodKey, number]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

function changeClause(key: MoodKey, value: number): string {
  const label = moodLabels[key];
  if (value >= 6) return `${label} belirgin biçimde yükselmiş`;
  if (value >= 3) return `${label} hafifçe yukarı kıpırdamış`;
  if (value <= -6) return `${label} gözle görülür biçimde geri çekilmiş`;
  if (value <= -3) return `${label} biraz azalmış`;
  return `${label} küçük bir açı değiştirmiş`;
}

export function calculateMood(params: {
  date: string;
  state: UcuBedenState;
  sources: SourceBundle;
  inputAnalysis: InputPoemsAnalysis;
}): { mood: Mood; sentence: string; metadata: MoodGenerationMetadata } {
  const previous = params.state.last_mood ?? defaultMood;
  const weather = params.sources.weather;
  const newsWeight = params.sources.turkey_news.emotional_weight;
  const artCuriosity = params.sources.art_world.curiosity;
  const rssScores = params.sources.rss?.dailyMoodSummary.moodScores;
  const geneticTone = params.inputAnalysis.global.tone;
  const age = params.state.age_months;
  const humidity = weather.humidity_percent ?? 60;
  const wind = weather.wind_kmh ?? 10;
  const memoryDensity = params.state.memory_density;
  const memoryPressure = rounded(bounded(memoryDensity / 100));
  const variation = dailyVariation(params.date);
  const event = chooseMoodEvent({ date: params.date, newsWeight, artCuriosity, humidity, wind, memoryPressure });

  let target: Mood = {
    melancholy: 38 + newsWeight * 0.12 + humidity * 0.05 + (seededNumber(`${params.date}:mood:memory:tilt`) - 0.5) * memoryPressure * 6,
    anger: 10 + newsWeight * 0.14 + (geneticTone.includes("panic-comic") ? 8 : 0),
    tenderness: 34 + (geneticTone.includes("bedensel") ? 9 : 0) + Math.min(age, 48) * 0.18 + memoryPressure * 5,
    fatigue: 38 + humidity * 0.12 + newsWeight * 0.08 + Math.max(0, 18 - wind) * 0.22,
    absurdity: 36 + (geneticTone.includes("absürt") ? 13 : 7),
    clarity: 42 + wind * 0.38 - newsWeight * 0.08 - humidity * 0.04 + (0.5 - memoryPressure) * 3,
    desire: 24 + artCuriosity * 0.18 + (geneticTone.includes("yemekle bozulan") ? 7 : 0) + (1 - Math.abs(memoryPressure - 0.5) * 2) * 2,
    hope: 28 + artCuriosity * 0.2 + wind * 0.18 - newsWeight * 0.05
  };

  if (rssScores) {
    target.melancholy += rssScores.melancholy * 0.9;
    target.anger += rssScores.anger * 1.15;
    target.tenderness += rssScores.tenderness * 1.05;
    target.fatigue += rssScores.fatigue * 1.0;
    target.absurdity += rssScores.absurdity * 1.1;
    target.clarity += rssScores.clarity * 1.0;
    target.desire += rssScores.desire * 1.1;
    target.hope += rssScores.hope * 1.0;
  }

  target = applyEffects(target, event.effects);
  target = moodKeys.reduce((next, key) => {
    next[key] = clamp(target[key] + variation[key]);
    return next;
  }, {} as Mood);

  const drifted: Mood = moodKeys.reduce((next, key) => {
    next[key] = clamp(drift(previous[key], target[key]));
    return next;
  }, {} as Mood);

  const antiFlatnessResult = applyAntiFlatness({ date: params.date, state: params.state, mood: drifted });
  const mood = antiFlatnessResult.mood;
  const delta = moodDelta(mood, previous);
  const metadata: MoodGenerationMetadata = {
    memory_density: memoryDensity,
    memory_pressure: memoryPressure,
    source_pressure: newsWeight,
    weather: {
      humidity_percent: weather.humidity_percent,
      wind_kmh: weather.wind_kmh
    },
    daily_event: {
      type: event.type,
      primary_axis: event.primary_axis,
      secondary_axis: event.secondary_axis,
      intensity: event.intensity,
      description: event.description
    },
    daily_variation: variation,
    target_mood: target,
    previous_mood: params.state.last_mood,
    delta_from_previous: delta,
    anti_flatness: antiFlatnessResult.antiFlatness
  };

  return { mood, sentence: moodSentence(params.date, mood, params.sources, metadata), metadata };
}

export function moodSentence(date: string, mood: Mood, sources: SourceBundle, metadata?: MoodGenerationMetadata): string {
  const previous = metadata?.previous_mood ?? defaultMood;
  const delta = metadata?.delta_from_previous ?? moodDelta(mood, previous);
  const [primaryChange, secondaryChange] = strongestChanges(delta);
  const seed = `${date}:${sources.date}:${primaryChange[0]}:${primaryChange[1]}:${metadata?.daily_event.type ?? "no-event"}`;
  const motion = changeClause(primaryChange[0], primaryChange[1]);
  const secondMotion = Math.abs(secondaryChange[1]) >= 3 ? changeClause(secondaryChange[0], secondaryChange[1]) : null;
  const eventText = metadata?.daily_event.description ?? "günün küçük olayı ruh halini hafifçe yerinden oynatıyor";
  const body = seededPick(
    primaryChange[0] === "fatigue" && primaryChange[1] < 0
      ? ["omuzları dün bıraktığı ağırlığın bir kısmını yerde unutmuş", "bedeni aynı odada ama daha az çökmüş", "gövdesi günün yükünü biraz geç fark etmiş"]
      : primaryChange[0] === "clarity" && primaryChange[1] > 0
        ? ["aklı pencereyi azıcık aralamış", "dili havanın temiz bir köşesine dokunmuş", "yüzü cümleyi daha net tutmuş"]
        : primaryChange[0] === "absurdity" && primaryChange[1] > 0
          ? ["günün yamuk tarafına fazla ciddi bakmış", "içindeki küçük yanlışlık sandalyeye oturmuş", "mantığı bugün biraz komşu evden gelmiş"]
          : ["bedeni eski alışkanlığını bozacak kadar kıpırdamış", "dili aynı yerden değil, biraz kenardan başlamış", "yüzü odanın ışığıyla yeniden pazarlık etmiş"],
    `${seed}:body`
  );
  const world = seededPick(
    sources.turkey_news.emotional_weight > 60
      ? ["dış dünya içeri sızmış ama sesi kısılmış", "haberlerin ağırlığı ev ölçüsüne çekilmiş", "ekranın ciddiyeti masanın kenarında bekletilmiş"]
      : ["dışarıdaki sesler bugün daha küçük parçalara ayrılmış", "haberleri yarım bırakınca oda biraz yer açmış", "dünya kendini açıklamadan kenarda durmuş"],
    `${seed}:world`
  );
  const memory = metadata
    ? metadata.memory_pressure > 0.75
      ? "hafıza basıncı ayrı bir yerde duruyor, ruh halini tek renge kilitlemiyor"
      : "hafıza bugün dipte küçük bir işaret olarak kalıyor"
    : "hafıza bugün sessiz bir dip not gibi duruyor";
  const antiFlatness = metadata?.anti_flatness.applied
    ? seededPick(
        [
          "son günlerin düz çizgisi küçük bir yerinden kırılmış",
          "aynılaşan ritim bugün kendine yan yol bulmuş",
          "tekrar eden hava hafifçe yön değiştirmiş"
        ],
        `${seed}:flat`
      )
    : null;
  const learnedImage = sources.rss?.dailyMoodSummary.externalKnowledgeFragments?.[0]?.transformedImage;
  const external = learnedImage
    ? seededPick([learnedImage, sources.rss?.dailyMoodSummary.externalKnowledgeFragments?.[0]?.humanMisreading ?? learnedImage, eventText], `${seed}:external`)
    : eventText;

  return `Bugünkü hali: ${motion}${secondMotion ? `, ${secondMotion}` : ""}; ${body}, ${world}; ${external}; ${memory}${antiFlatness ? `; ${antiFlatness}` : ""}.`;
}
