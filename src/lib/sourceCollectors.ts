import type { ArtSource, NewsSource, SourceBundle, WeatherSource } from "./types";

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
  const [weatherResult, newsResult, artResult] = await Promise.all([
    collectWeather(date),
    collectTurkeyNews(date),
    collectArtWorld(date)
  ]);

  return {
    date,
    collected_at: new Date().toISOString(),
    fallback_used: weatherResult.fallback || newsResult.fallback || artResult.fallback,
    weather: weatherResult.weather,
    turkey_news: newsResult.news,
    art_world: artResult.art,
    notes: [weatherResult.note, newsResult.note, artResult.note].filter((note): note is string => Boolean(note))
  };
}
