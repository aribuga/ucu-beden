import { seededPick } from "./random";
import type { DailyLife, Mood, SourceBundle, World } from "./types";

const locations = [
  "salondaki gri koltuk",
  "bilgisayarın önü",
  "mavi figürlü halının kenarı",
  "küçük mutfak alanı",
  "yatak odasının dar yanı",
  "kapının eşiği"
];

const postures = ["uzanmış", "yarı oturmuş", "dönüp durmuş", "öne eğilmiş", "ayakta bekliyor"];
const lights = [
  "sabah ışığı mutfak tarafından geliyor",
  "perde aralığından ince bir çizgi düşüyor",
  "ekran ışığı salonda küçük bir açıklık yapıyor",
  "oda ışığı eşyaları biraz düzleştiriyor"
];

export function createDailyLife(params: { date: string; world: World; mood: Mood; sources: SourceBundle }): DailyLife {
  const seed = `${params.date}:daily-life:${params.mood.fatigue}:${params.sources.turkey_news.emotional_weight}`;
  const tired = params.mood.fatigue > 60;
  const location = tired ? "salondaki gri koltuk" : seededPick(locations, seed);
  const objectFocus = seededPick(
    [
      "mavi figürlü halı",
      "bilgisayar ekranı",
      "küçük mutfak tezgahı",
      "kapının metal sesi",
      "dar yatak",
      "gri koltuğun çöküğü"
    ],
    `${seed}:object`
  );

  return {
    location,
    posture: tired ? "uzanmış" : seededPick(postures, `${seed}:posture`),
    activity:
      params.sources.turkey_news.emotional_weight > 60
        ? "haberleri yarım okuyup bilgisayarı açık bırakmış"
        : "ekranla oda arasında kısa kısa gidip geliyor",
    attention: `${objectFocus} üzerinde oyalanıyor`,
    body_state:
      params.sources.weather.humidity_percent && params.sources.weather.humidity_percent > 70
        ? "dili kuru, gövdesi nemli ve ağır"
        : "bacakları uykudan yeni çıkmış gibi sıcak",
    room_light: seededPick(lights, `${seed}:light`),
    object_focus: objectFocus,
    movement: tired ? "az hareket ediyor" : "odanın içinde kısa ve kararsız adımlar atıyor"
  };
}
