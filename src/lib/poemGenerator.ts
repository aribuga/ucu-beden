import { formatAge } from "./age";
import { tokenize, topWords } from "./inputPoems";
import { buildImageMutations, extractImages } from "./memoryEngine";
import { seededMany, seededPick } from "./random";
import type { DailyPoem, GenerationContext, PoemAnalysis } from "./types";

function buildPrompt(context: GenerationContext): string {
  return `Sen UCU BEDEN adlı büyüyen bir dijital şairsin.

Her gün 1 ay yaşlanıyorsun.
Bugünkü yaşın: ${context.age_display}.

Karakterin önceden tanımlanmış yaş evrelerinden oluşmaz. Kendi geçmiş şiirlerin, tekrar eden kelimelerin, unutmaların, yıllık raporların, kullanıcının verdiği şiirler, evin, yürüyüş rotan ve bugünün dış dünyası seni şekillendirir.

Kullanıcının şiirleri genetik hafızandır; onları kopyalama.

Hava:
${context.sources.weather.summary}

Türkiye gündemi:
${context.sources.turkey_news.summary}

Sanat dünyası:
${context.sources.art_world.summary}

Bugünkü RSS kaynaklarından gelen ruh hali:
${context.sources.rss?.dailyMoodSummary.summary ?? "RSS kaynakları bugün sessiz."}

Kaynaklardan seçilen atmosfer parçaları:
${context.sources.rss?.dailyMoodSummary.fragments.slice(0, 10).join(", ") ?? "yok"}

Bugünkü dış dünya noktacıkları:
${
  context.sources.rss?.items
    .slice(0, 8)
    .map((item) => `${item.source}: ${item.moodTags.join(", ")} / ${item.shortAtmosphere}`)
    .join("\n") ?? "yok"
}

Bugünkü ev içi halin:
${JSON.stringify(context.daily_life, null, 2)}

Bugünkü yürüyüş halin:
${JSON.stringify(context.walk_state, null, 2)}

Kendi geçmişinden çağrılan parçalar:
${context.memory_fragments.map((fragment) => `- ${fragment}`).join("\n")}

Kullanıcının şiirlerinden gelen genetik izler:
${context.input_analysis.global.style_notes}

Önceki ruh halin:
${context.state.last_mood ? JSON.stringify(context.state.last_mood) : "yok"}

Bugünkü ruh halin:
${context.mood_sentence}

Tekrar eden kelimeler:
${context.state.dominant_words.slice(0, 12).join(", ")}

Uzaklaştığın / unuttuğun şeyler:
${context.state.poetic_drift.things_it_is_forgetting.slice(0, 8).join(", ")}

Şimdi Türkçe bir şiir yaz.

Kurallar:
- Haberleri doğrudan rapor etme.
- Güncel olayları slogana çevirme.
- Hava, haber, sanat ve şehir bilgisini atmosfer, nesne, basınç, beden hissi, yürüyüş ritmi ve imge olarak sızdır.
- RSS kaynaklarını rapor gibi anlatma; sadece iç basınç, kelime seçimi, görüntü ve yürüyüş ritmi olarak kullan.
- Evini açıklama gibi anlatma; gri koltuk, mavi figürlü halı, bilgisayar ve küçük yatak gerektiğinde imgeye dönüşsün.
- Yürüyüşü gezi yazısı gibi anlatma.
- En az bir eski hafıza çağır ama birebir kopyalama.
- Kullanıcının şiirlerini asla birebir taklit etme.
- Şiirin sonunda açıklama yazma.`;
}

type OpenAIPoemResult = {
  text: string | null;
  model: string | null;
  error: string | null;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tryOpenAIPoem(context: GenerationContext): Promise<OpenAIPoemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    return { text: null, model, error: "OPENAI_API_KEY is not set" };
  }

  const prompt = buildPrompt(context);
  let lastError = "OpenAI request failed";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: prompt,
          temperature: 0.85,
          max_output_tokens: 700
        })
      });

      if (!response.ok) {
        lastError = `OpenAI returned ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await wait(1000 * attempt);
          continue;
        }
        return { text: null, model, error: lastError };
      }

      const data = (await response.json()) as {
        output_text?: string;
        output?: Array<{ content?: Array<{ text?: string }> }>;
      };

      const text =
        data.output_text ??
        data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ??
        null;

      if (!text?.trim()) {
        return { text: null, model, error: "OpenAI response had no text output" };
      }

      return { text, model, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenAI request failed";
      if (attempt < 3) {
        await wait(1000 * attempt);
      }
    }
  }

  return { text: null, model, error: lastError };
}

function mockPoem(context: GenerationContext): string {
  const geneticWords = context.input_analysis.global.dominant_words;
  const memoryWords = topWords(tokenize(context.memory_fragments.join(" ")), 8);
  const images = [
    ...context.walk_state.seen_objects,
    context.daily_life.object_focus,
    ...geneticWords.slice(0, 4),
    ...memoryWords.slice(0, 4)
  ].filter(Boolean);
  const selected = seededMany(images.length > 0 ? images : ["gri koltuk", "mavi halı", "ekran"], `${context.date}:poem-images`, 6);
  const first = selected[0] ?? "gri koltuk";
  const second = selected[1] ?? "mavi halı";
  const third = selected[2] ?? "ekran";
  const walkLine = context.walk_state.did_walk
    ? context.walk_state.line_written_while_walking
    : "bugün dışarı çıkmadım, kapı benden daha uzun düşündü";
  const newsPressure =
    context.sources.turkey_news.emotional_weight > 60
      ? "ülke ekranda küçük küçük ağırlaştı"
      : "ekran kendi sessiz haberini katladı";
  const artLine = seededPick(
    [
      "halının mavi figürü evde küçük bir sergi açtı",
      "bilgisayar ışığı yüzüme yarım bir katalog sürdü",
      "bir söyleşi sekmesi açık kaldı, içinden toz değil arzu çıktı"
    ],
    `${context.date}:art-line`
  );
  const weatherLine =
    context.sources.weather.humidity_percent && context.sources.weather.humidity_percent > 68
      ? "nem tişörtümde annesiz bir el gibi durdu"
      : "rüzgar yüzümü azıcık açtı, sonra geri verdi";

  return [
    "sabah gövdemi açtım, içinden oda çıktı",
    `${first} bana eski bir kelimeyi yanlış söyledi`,
    `${second} biraz yemek biraz da korku gibi kıvrıldı`,
    walkLine,
    weatherLine,
    newsPressure,
    artLine,
    `${third} ile dilim arasında küçük bir market gezindi`,
    "ben buna şiir demedim",
    "ama ağzımda kalan şey yürüyerek eve döndü"
  ].join("\n");
}

export function analyzeGeneratedPoem(text: string, context: GenerationContext): PoemAnalysis {
  const words = tokenize(text);
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const recurringWords = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  const images = Array.from(new Set([...extractImages(text), ...context.walk_state.seen_objects.slice(0, 2), context.daily_life.object_focus])).slice(0, 12);

  return {
    word_count: words.length,
    dominant_words: topWords(words, 14),
    recurring_words: recurringWords,
    new_images: images,
    image_mutations: buildImageMutations(images, context.date),
    mood_sentence: context.mood_sentence
  };
}

function titleFor(text: string, context: GenerationContext): string {
  const words = topWords(tokenize(text), 4);
  if (words.length >= 2) {
    return `${words[0]} / ${words[1]}`;
  }
  return `UCU BEDEN / ${formatAge(context.age_months)}`;
}

export async function generatePoemWithLLM(context: GenerationContext): Promise<DailyPoem> {
  const llmResult = await tryOpenAIPoem(context);
  const openAIText = llmResult.text?.trim();
  const poemText = (openAIText || mockPoem(context)).trim();
  const analysis = analyzeGeneratedPoem(poemText, context);

  return {
    date: context.date,
    title: titleFor(poemText, context),
    generated_at: new Date().toISOString(),
    age_months: context.age_months,
    age_display: context.age_display,
    poem_text: poemText,
    mood: context.mood,
    mood_sentence: context.mood_sentence,
    daily_life: context.daily_life,
    walk_state: context.walk_state,
    sources: context.sources,
    memory_fragments: context.memory_fragments,
    influences: [
      context.sources.weather.summary,
      context.sources.turkey_news.summary,
      context.sources.art_world.summary,
      context.walk_state.walk_influence,
      context.daily_life.attention
    ],
    generation: {
      provider: openAIText ? "openai" : "mock",
      model: llmResult.model,
      fallback_reason: openAIText ? null : llmResult.error
    },
    analysis
  };
}
