import { seededMany, seededPick, seededNumber } from "./random";
import type { DailyLife, Mood, SourceBundle, WalkState, World } from "./types";

const seenObjects = [
  "ıslak bank",
  "köpek tasması",
  "ağaç gölgesi",
  "sabah vapuru sesi",
  "market poşeti",
  "kırmızı ışıkta bekleyen biri",
  "uzaktan deniz",
  "nemli kaldırım",
  "parkta unutulmuş bardak"
];

export function createWalkState(params: {
  date: string;
  world: World;
  mood: Mood;
  sources: SourceBundle;
  dailyLife: DailyLife;
}): WalkState {
  const route = params.world.walking_routes[0];
  const weather = params.sources.weather;
  const newsWeight = params.sources.turkey_news.emotional_weight;
  const energy = 100 - params.mood.fatigue + params.mood.hope * 0.35 + params.mood.clarity * 0.25;
  const weatherPenalty = weather.humidity_percent && weather.humidity_percent > 78 ? 18 : 0;
  const random = seededNumber(`${params.date}:walk`);
  const walkScore = energy - weatherPenalty - newsWeight * 0.12 + random * 22;
  const didWalk = walkScore > 38;

  if (!route || !didWalk) {
    return {
      did_walk: false,
      route_name: route?.name ?? null,
      current_segment: "ev içi",
      pace: "hareketsiz",
      weather_on_body: weather.body_effect,
      seen_objects: [params.dailyLife.object_focus, "ekran ışığı", "kapı eşiği"],
      line_written_while_walking: "",
      walk_influence: "şiir daha kapalı, oda içi, koltuk/yatak etkili olsun"
    };
  }

  const segmentPool =
    walkScore > 72
      ? route.segments
      : walkScore > 55
        ? route.segments.slice(0, Math.max(3, route.segments.length - 2))
        : route.segments.slice(0, 3);
  const currentSegment = seededPick(segmentPool, `${params.date}:segment`);
  const pace = params.mood.fatigue > 62 ? "yavaş" : params.mood.clarity > 48 ? "açılan" : "kesik";
  const objects = seededMany(seenObjects, `${params.date}:objects:${currentSegment}`, 4);

  return {
    did_walk: true,
    route_name: route.name,
    current_segment: currentSegment,
    pace,
    weather_on_body: weather.body_effect,
    seen_objects: objects,
    line_written_while_walking:
      currentSegment.includes("Kalamış")
        ? "deniz bugün konuşmadı ama ağzını açık bıraktı"
        : currentSegment.includes("Yoğurtçu")
          ? "park ağzını içime doğru açtı"
          : "apartmanlar sabahı küçük küçük çiğnedi",
    walk_influence:
      currentSegment.includes("Kalamış")
        ? "şiir daha nefesli, rüzgarlı ve uzun cümleli olsun"
        : currentSegment.includes("Yoğurtçu")
          ? "şiir hafızalı, ağaçlı ve içe dönen bir ritimde olsun"
          : "şiir şehir kırıntılı, adımlı ve kesik olsun"
  };
}
