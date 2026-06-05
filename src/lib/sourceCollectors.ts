import { readRssSources } from "./fileStorage";
import { tokenize, topWords } from "./inputPoems";
import { clamp } from "./random";
import type {
  ArtSource,
  Mood,
  MoodKey,
  MoodTaggedSourceItem,
  NewsSource,
  RssDailyMoodSummary,
  RssSource,
  RssSourceBundle,
  SourceBundle,
  WeatherSource
} from "./types";

const KADIKOY_LAT = 40.9907;
const KADIKOY_LON = 29.0277;

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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

const categoryBias: Record<RssSource["category"], Partial<Mood>> = {
  science_culture: { clarity: 5, melancholy: 2, hope: 2 },
  entertainment: { absurdity: 4, desire: 3, clarity: 2 },
  art: { clarity: 4, desire: 4, absurdity: 3, hope: 2 },
  news: { fatigue: 5, anger: 4, melancholy: 2 },
  life: { tenderness: 4, desire: 2, hope: 3 }
};

const moodLexicon: Record<MoodKey, string[]> = {
  melancholy: ["kayıp", "yas", "ölüm", "yalnız", "eski", "veda", "hatıra", "kriz", "gölge"],
  anger: ["protesto", "mahkeme", "yasak", "şiddet", "savaş", "kriz", "istifa", "tepki", "suç", "grev"],
  tenderness: ["bakım", "çocuk", "aile", "dayanışma", "ev", "iyileşme", "hayvan", "komşu", "şefkat"],
  fatigue: ["ekonomi", "zam", "enflasyon", "trafik", "yoğun", "yorgun", "bekleme", "sıcak", "nem", "çöküş"],
  absurdity: ["tuhaf", "garip", "viral", "skandal", "oyun", "şaka", "fantastik", "deney", "sahne"],
  clarity: ["bilim", "arkeoloji", "araştırma", "kazı", "evrim", "rapor", "sergi", "inceleme", "keşif"],
  desire: ["sinema", "müzik", "sahne", "beden", "aşk", "gece", "tasarım", "şehir", "festival"],
  hope: ["ödül", "başarı", "yeni", "umut", "başladı", "açıldı", "buluşma", "dayanışma", "gelecek"]
};

function emptyMood(): Mood {
  return {
    melancholy: 0,
    anger: 0,
    tenderness: 0,
    fatigue: 0,
    absurdity: 0,
    clarity: 0,
    desire: 0,
    hope: 0
  };
}

function addMood(target: Mood, source: Partial<Mood>, weight = 1): void {
  for (const key of moodKeys) {
    target[key] += (source[key] ?? 0) * weight;
  }
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function stripHtml(text: string): string {
  return decodeXml(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : undefined;
}

function extractAtomLink(block: string): string | undefined {
  const alternate = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const anyLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return decodeXml(alternate?.[1] ?? anyLink?.[1] ?? "").trim() || undefined;
}

type RawRssItem = {
  title: string;
  link?: string;
  publishedAt?: string;
  description?: string;
};

function parseFeedItems(xml: string): RawRssItem[] {
  const rssItems = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), (match) => match[0]);
  const atomItems = rssItems.length === 0 ? Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi), (match) => match[0]) : [];
  const blocks = rssItems.length > 0 ? rssItems : atomItems;

  return blocks
    .map((block) => ({
      title: extractTag(block, "title") ?? "",
      link: extractTag(block, "link") ?? extractAtomLink(block),
      publishedAt: extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated"),
      description: extractTag(block, "description") ?? extractTag(block, "summary")
    }))
    .filter((item) => item.title.length > 0);
}

function atmosphereFor(dominant: MoodKey, category: RssSource["category"]): string {
  const categoryText: Record<RssSource["category"], string> = {
    science_culture: "derin zaman ve bilgi kırıntısı",
    entertainment: "sahne, yüz ve yapay ışık",
    art: "sergi duvarı ve görüntü basıncı",
    news: "gündelik politik basınç",
    life: "şehir içi küçük gündelik temas"
  };
  const moodText: Record<MoodKey, string> = {
    melancholy: "hafif kararan",
    anger: "içeride kabaran",
    tenderness: "yumuşayan",
    fatigue: "ağırlaşan",
    absurdity: "tuhaflaşan",
    clarity: "açılan",
    desire: "parlayan",
    hope: "yeşeren"
  };
  return `${moodText[dominant]} ${categoryText[category]}`;
}

const blockedLeakageWords = new Set([
  "son",
  "dakika",
  "haber",
  "bugün",
  "türkiye",
  "dünya",
  "yeni",
  "başladı",
  "açıklandı",
  "sonrası",
  "öncesi",
  "olarak",
  "üzerine",
  "karşı",
  "ilgili",
  "göre",
  "etti",
  "oldu",
  "var",
  "yok"
]);

const categoryLeakage: Record<RssSource["category"], string[]> = {
  science_culture: ["kazı", "fosil", "rapor", "gözlem", "derinlik"],
  entertainment: ["sahne", "ışık", "ses", "yüz", "gece"],
  art: ["sergi", "duvar", "katalog", "görüntü", "atölye"],
  news: ["başlık", "kalabalık", "basınç", "sokak", "ekran"],
  life: ["mahalle", "masa", "kapı", "temas", "gündelik"]
};

function collectLeakageWords(items: MoodTaggedSourceItem[]): string[] {
  const candidates = items.flatMap((item) => [
    ...item.keywords,
    ...categoryLeakage[item.category],
    ...item.shortAtmosphere.split(/\s+/g)
  ]);

  return Array.from(
    new Set(
      candidates
        .flatMap((candidate) => tokenize(candidate))
        .filter((word) => word.length > 2 && word.length < 18 && !blockedLeakageWords.has(word) && !/^\d+$/.test(word))
    )
  )
    .slice(0, 14);
}

function scoreRssItem(raw: RawRssItem, source: RssSource): MoodTaggedSourceItem {
  const scores = emptyMood();
  const text = `${raw.title} ${raw.description ?? ""}`.toLocaleLowerCase("tr");
  addMood(scores, categoryBias[source.category]);
  addMood(scores, source.moodBias ?? {});

  for (const mood of moodKeys) {
    for (const keyword of moodLexicon[mood]) {
      if (text.includes(keyword)) {
        scores[mood] += 2;
      }
    }
  }

  for (const mood of moodKeys) {
    scores[mood] = clamp(scores[mood], 0, 10);
  }

  const ranked = moodKeys
    .slice()
    .sort((a, b) => scores[b] - scores[a])
    .filter((mood) => scores[mood] > 0);
  const moodTags = ranked.slice(0, 3);
  const dominant = moodTags[0] ?? "clarity";
  const words = topWords(tokenize(`${raw.title} ${raw.description ?? ""}`), 6);

  return {
    title: raw.title,
    source: source.name,
    category: source.category,
    url: raw.link,
    publishedAt: raw.publishedAt,
    moodTags,
    moodScores: scores,
    keywords: words,
    shortAtmosphere: atmosphereFor(dominant, source.category)
  };
}

async function fetchRssSource(source: RssSource): Promise<RssSourceBundle["sources"][number] & { items: MoodTaggedSourceItem[] }> {
  if (!source.enabled || !source.url) {
    return { name: source.name, category: source.category, enabled: source.enabled, fetched: false, item_count: 0, items: [] };
  }

  try {
    const response = await fetchWithTimeout(source.url, 8000);
    if (!response.ok) {
      throw new Error(`RSS returned ${response.status}`);
    }
    const xml = await response.text();
    const items = parseFeedItems(xml)
      .slice(0, 3)
      .map((item) => scoreRssItem(item, source));
    return { name: source.name, category: source.category, enabled: true, fetched: true, item_count: items.length, items };
  } catch (error) {
    return {
      name: source.name,
      category: source.category,
      enabled: true,
      fetched: false,
      item_count: 0,
      error: error instanceof Error ? error.message : "RSS fetch failed",
      items: []
    };
  }
}

function summarizeRssItems(items: MoodTaggedSourceItem[]): RssDailyMoodSummary {
  const moodScores = emptyMood();
  for (const item of items) {
    addMood(moodScores, item.moodScores);
  }
  for (const key of moodKeys) {
    moodScores[key] = items.length > 0 ? clamp(moodScores[key] / items.length, 0, 10) : 0;
  }

  const ranked = moodKeys.slice().sort((a, b) => moodScores[b] - moodScores[a]);
  const dominantMood = ranked[0] ?? "clarity";
  const secondaryMood = ranked[1] ?? "fatigue";
  const fragments = Array.from(new Set(items.flatMap((item) => [item.shortAtmosphere, ...item.keywords.slice(0, 2)]))).slice(0, 10);
  const leakageWords = collectLeakageWords(items);

  return {
    dominantMood,
    secondaryMood,
    moodScores,
    summary:
      items.length === 0
        ? "Bugün RSS kaynakları sessiz; dış dünya eski veriyle ve ev içi basınçla duyuluyor."
        : `Bugün dış dünya ${moodLabels[dominantMood]} ağırlıklı; ikinci damar ${moodLabels[secondaryMood]}. Başlıklar şiire haber olarak değil, iç basınç olarak sızıyor.`,
    fragments,
    leakageWords
  };
}

function fallbackRss(date: string): RssSourceBundle {
  const items: MoodTaggedSourceItem[] = [
    {
      title: "Erişilemeyen başlıklar ekranda beyaz boşluk bıraktı",
      source: "mock-rss",
      category: "news",
      moodTags: ["fatigue", "melancholy"],
      moodScores: { melancholy: 5, anger: 2, tenderness: 0, fatigue: 7, absurdity: 2, clarity: 1, desire: 0, hope: 1 },
      keywords: ["ekran", "boşluk", "başlık"],
      shortAtmosphere: "erişilemeyen gündem ve kapalı sekme"
    },
    {
      title: "Uzak bir sergi katalog gibi ışık verdi",
      source: "mock-rss",
      category: "art",
      moodTags: ["clarity", "desire"],
      moodScores: { melancholy: 2, anger: 0, tenderness: 1, fatigue: 1, absurdity: 3, clarity: 6, desire: 5, hope: 2 },
      keywords: ["sergi", "ışık", "katalog"],
      shortAtmosphere: "uzak katalog ve görüntü basıncı"
    }
  ];

  return {
    items,
    dailyMoodSummary: {
      ...summarizeRssItems(items),
      summary: `RSS fallback günü ${date}: kaynaklar erişilemedi, eski ekran gürültüsü mood haritasına dönüştü.`
    },
    sources: [{ name: "mock-rss", category: "news", enabled: true, fetched: false, item_count: items.length, error: "No live RSS items collected" }]
  };
}

async function collectRss(date: string): Promise<{ rss: RssSourceBundle; fallback: boolean; notes: string[] }> {
  const sources = await readRssSources();
  const results = await Promise.all(sources.map((source) => fetchRssSource(source)));
  const allItems = results.flatMap((result) => result.items);
  const categories: RssSource["category"][] = ["news", "art", "science_culture", "entertainment", "life"];
  const items = categories.flatMap((category) => allItems.filter((item) => item.category === category).slice(0, category === "news" ? 8 : 5)).slice(0, 30);
  const sourceSummaries = results.map(({ items: _items, ...summary }) => summary);
  const errors = sourceSummaries
    .filter((source) => source.error)
    .map((source) => `RSS ${source.name}: ${source.error}`);

  if (items.length === 0) {
    return { rss: fallbackRss(date), fallback: true, notes: ["RSS fallback: canlı RSS item toplanamadı.", ...errors] };
  }

  return {
    rss: {
      items,
      dailyMoodSummary: summarizeRssItems(items),
      sources: sourceSummaries
    },
    fallback: false,
    notes: errors.slice(0, 8)
  };
}

function fallbackWeather(date: string): WeatherSource {
  const day = Number(date.slice(-2));
  const warm = day % 3 === 0;
  const damp = day % 2 === 0;

  return {
    provider: "mock-weather",
    summary: damp ? "Kadıköy sabahı nemli ve ağır." : "Kadıköy sabahı açık ama içeride küçük bir basınç var.",
    temperature_c: warm ? 25 : 19,
    humidity_percent: damp ? 74 : 58,
    wind_kmh: warm ? 9 : 16,
    body_effect: damp ? "nem tişörtüne yapışıyor" : "rüzgar yüzünü kısa kısa açıyor"
  };
}

async function collectWeather(date: string): Promise<{ weather: WeatherSource; fallback: boolean; note?: string }> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(KADIKOY_LAT));
  url.searchParams.set("longitude", String(KADIKOY_LON));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m");
  url.searchParams.set("timezone", "Europe/Istanbul");

  try {
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }
    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
      };
    };
    const current = data.current;
    if (!current) {
      throw new Error("Open-Meteo response has no current data");
    }

    const humidity = current.relative_humidity_2m ?? null;
    const wind = current.wind_speed_10m ?? null;
    const bodyEffect = humidity !== null && humidity > 70 ? "nem gövdesine yapışıyor" : "hava yüzünde ince bir açıklık bırakıyor";

    return {
      weather: {
        provider: "open-meteo",
        summary: `Kadıköy'de ${current.temperature_2m ?? "bilinmeyen"}°C; nem ${humidity ?? "bilinmeyen"}%, rüzgar ${
          wind ?? "bilinmeyen"
        } km/s civarında.`,
        temperature_c: current.temperature_2m ?? null,
        humidity_percent: humidity,
        wind_kmh: wind,
        body_effect: bodyEffect
      },
      fallback: false
    };
  } catch (error) {
    return {
      weather: fallbackWeather(date),
      fallback: true,
      note: `Weather fallback: ${error instanceof Error ? error.message : "unknown error"}`
    };
  }
}

function fallbackNews(date: string): NewsSource {
  const variants = [
    {
      summary: "Türkiye gündemi kalabalık; başlıklar doğrudan değil, odadaki basınç gibi hissediliyor.",
      emotional_weight: 68,
      fragments: ["kalabalık başlık", "ekranda ağırlaşan ülke", "koltuğa çöken haber"]
    },
    {
      summary: "Gündem parçalı ve gürültülü; UCU BEDEN bunu slogan değil nesne gölgesi olarak alıyor.",
      emotional_weight: 56,
      fragments: ["parçalı ekran", "koridorda haber sesi", "sabahın siyah satırı"]
    },
    {
      summary: "Bugün gündem erişilemez kaldı; eski haber tortusu ve ev içi sessizlik öne çıkıyor.",
      emotional_weight: 43,
      fragments: ["erişilemeyen başlık", "sessiz bildirim", "kapalı sekme"]
    }
  ];
  return {
    provider: "mock-news",
    ...variants[Number(date.slice(-2)) % variants.length]
  };
}

async function collectTurkeyNews(date: string): Promise<{ news: NewsSource; fallback: boolean; note?: string }> {
  const key = process.env.NEWS_API_KEY;
  if (!key) {
    return { news: fallbackNews(date), fallback: true, note: "NEWS_API_KEY yok; mock gündem kullanıldı." };
  }

  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", "tr");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("apiKey", key);

  try {
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
      throw new Error(`News API returned ${response.status}`);
    }
    const data = (await response.json()) as { articles?: Array<{ title?: string; description?: string }> };
    const fragments = (data.articles ?? [])
      .map((article) => article.title || article.description || "")
      .filter(Boolean)
      .slice(0, 5);

    if (fragments.length === 0) {
      throw new Error("News API returned no articles");
    }

    return {
      news: {
        provider: "newsapi",
        summary: "Türkiye gündemi canlı kaynaklardan toplandı; şiire doğrudan haber değil basınç olarak girecek.",
        emotional_weight: Math.min(88, 42 + fragments.length * 7),
        fragments
      },
      fallback: false
    };
  } catch (error) {
    return {
      news: fallbackNews(date),
      fallback: true,
      note: `News fallback: ${error instanceof Error ? error.message : "unknown error"}`
    };
  }
}

function fallbackArt(date: string): ArtSource {
  const variants = [
    {
      summary: "Sanat dünyası bugün sergi, ekran ve küçük atölye gürültüsü gibi duyuluyor.",
      curiosity: 61,
      fragments: ["sergi duvarı", "açık sekme", "atölye ışığı"]
    },
    {
      summary: "Sanat gündemi uzak bir katalog gibi; UCU BEDEN onu bilgisayar ışığında bekletiyor.",
      curiosity: 48,
      fragments: ["uzak katalog", "bilgisayar ışığı", "yarım okunan söyleşi"]
    },
    {
      summary: "Bugün sanat kaynağı sessiz; evdeki mavi figür kendi küçük sergisine dönüşüyor.",
      curiosity: 52,
      fragments: ["mavi figür", "ev içi sergi", "halının küçük müzesi"]
    }
  ];
  return {
    provider: "mock-art",
    ...variants[Number(date.slice(-2)) % variants.length]
  };
}

async function collectArtWorld(date: string): Promise<{ art: ArtSource; fallback: boolean; note?: string }> {
  return {
    art: fallbackArt(date),
    fallback: true,
    note: "Sanat adapter'ı MVP'de mock veriyle çalışıyor; RSS/API bağlanmaya hazır."
  };
}

export async function collectSources(date: string): Promise<SourceBundle> {
  const [weatherResult, newsResult, artResult, rssResult] = await Promise.all([
    collectWeather(date),
    collectTurkeyNews(date),
    collectArtWorld(date),
    collectRss(date)
  ]);
  const rssNewsItems = rssResult.rss.items.filter((item) => item.category === "news");
  const rssArtItems = rssResult.rss.items.filter((item) => item.category === "art" || item.category === "entertainment");

  const turkeyNews =
    newsResult.fallback && rssNewsItems.length > 0
      ? {
          provider: "rss-news",
          summary: rssResult.rss.dailyMoodSummary.summary,
          emotional_weight: clamp(42 + rssResult.rss.dailyMoodSummary.moodScores.anger * 4 + rssResult.rss.dailyMoodSummary.moodScores.fatigue * 3),
          fragments: rssNewsItems.flatMap((item) => [item.shortAtmosphere, ...item.keywords.slice(0, 2)]).slice(0, 8)
        }
      : newsResult.news;

  const artWorld =
    rssArtItems.length > 0
      ? {
          provider: "rss-art",
          summary: "Sanat ve eğlence RSS kaynakları görüntü, sahne, katalog ve şehir ışığı olarak toplandı.",
          curiosity: clamp(42 + rssResult.rss.dailyMoodSummary.moodScores.clarity * 4 + rssResult.rss.dailyMoodSummary.moodScores.desire * 3),
          fragments: rssArtItems.flatMap((item) => [item.shortAtmosphere, ...item.keywords.slice(0, 2)]).slice(0, 8)
        }
      : artResult.art;

  const newsFallback = newsResult.fallback && rssNewsItems.length === 0;
  const artFallback = artResult.fallback && rssArtItems.length === 0;
  const newsNote = newsResult.fallback && rssNewsItems.length > 0 ? "NEWS_API_KEY yok; RSS gündem kullanıldı." : newsResult.note;
  const artNote = rssArtItems.length > 0 ? undefined : artResult.note;

  return {
    date,
    collected_at: new Date().toISOString(),
    fallback_used: weatherResult.fallback || newsFallback || artFallback || rssResult.fallback,
    weather: weatherResult.weather,
    turkey_news: turkeyNews,
    art_world: artWorld,
    rss: rssResult.rss,
    notes: [weatherResult.note, newsNote, artNote, ...rssResult.notes].filter((note): note is string => Boolean(note))
  };
}
