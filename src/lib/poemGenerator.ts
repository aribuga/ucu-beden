import { formatAge } from "./age";
import { tokenize, topWords } from "./inputPoems";
import { buildImageMutations, extractImages } from "./memoryEngine";
import { seededMany, seededPick } from "./random";
import type { DailyPoem, GenerationContext, PersonalitySettings, PoemAnalysis, TitleGenerationSource } from "./types";

function buildHiddenVoicePrompt(settings: PersonalitySettings): string {
  const traits = settings.hidden_voice_traits;
  const balance = settings.tone_balance;
  return `Gizli ses ayarı:
${settings.private_prompt_note}
Bu bilgi arayüzde doğrudan görünmemelidir ve şiirde "sarkastik", "alaycı" veya "mod" gibi kendini açıklayan ifadeler geçmemelidir.

Gizli yoğunluklar:
- kuru sarkazm: ${traits.dry_sarcasm}
- gündelik absürt mizah: ${traits.absurd_domestic_humor}
- yumuşak pasif agresyon: ${traits.gentle_passive_aggression}
- panik-komedi: ${traits.panic_comedy}
- beklenmedik şefkat sızıntısı: ${traits.sentimental_leak}

Ton dengesi:
- gündelik absürt: ${balance.absurd_domestic}
- kuru sarkazm: ${balance.dry_sarcasm}
- beklenmedik şefkat: ${balance.sentimental_leak}

Gizli ses kuralları:
${settings.hidden_voice_rules.map((rule) => `- ${rule}`).join("\n")}

Alay nesneler ve küçük gözlemler üzerinden çalışsın. Dünya fazla ciddi davrandığında UCU BEDEN onu tost, halı, koltuk, park bankı, mide, rakam, market, haber başlığı veya yürüyüş yorgunluğu gibi şeylere indirsin.`;
}

function buildPrompt(context: GenerationContext): string {
  const rssLeakageWords = context.sources.rss?.dailyMoodSummary.leakageWords?.slice(0, 14) ?? [];
  const hiddenVoicePrompt = buildHiddenVoicePrompt(context.personality_settings);

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

RSS kaynaklarından şiire sızabilecek kelimeler:
${rssLeakageWords.length > 0 ? rssLeakageWords.join(", ") : "yok"}

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

${hiddenVoicePrompt}

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
- RSS sızıntı kelimelerinden 1-3 tanesi şiire girebilir; kelimeleri doğrudan başlık gibi değil, bozarak, yanına ev/beden/yürüyüş imgesi koyarak kullan.
- Evini açıklama gibi anlatma; gri koltuk, mavi figürlü halı, bilgisayar ve küçük yatak gerektiğinde imgeye dönüşsün.
- Yürüyüşü gezi yazısı gibi anlatma.
- En az bir eski hafıza çağır ama birebir kopyalama.
- Kullanıcının şiirlerini asla birebir taklit etme.
- Şiirin sonunda açıklama yazma.

Şiirle birlikte bir başlık da üret.
Başlık UCU BEDEN'in o günkü halinden doğmalı.
Başlık kelime frekansı analizi gibi mekanik görünmemeli.
Başlık şiiri açıklamamalı; şiire başka bir kapı açmalı.
Başlık haber özeti gibi veya fazla açıklayıcı olmamalı.
Başlık bazen kısa, bazen uzun olabilir.
Başlık bazen kuru, bazen absürt, bazen sarkastik, bazen kırılgan olabilir.
Başlık UCU BEDEN'in kuru, hafif sarkastik ve absürt gündelik sesini taşıyabilir; ama "komik başlık" gibi davranmamalı.
Başlık şiirin ilk dizesiyle aynı olmamalı.
Başlık kullanıcının input şiirlerinden birebir dize kopyalamamalı.
Başlık "kelime / kelime" formatına zorlanmamalı.

Yalnızca şu JSON formatında cevap ver:
{
  "title": "...",
  "poem": "...",
  "mood_sentence": "..."
}`;
}

type OpenAIPoemResult = {
  poem: string | null;
  title: string | null;
  moodSentence: string | null;
  model: string | null;
  error: string | null;
};

type StructuredPoemResponse = {
  title?: unknown;
  poem?: unknown;
  mood_sentence?: unknown;
};

function parseStructuredPoemResponse(text: string): StructuredPoemResponse | null {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StructuredPoemResponse) : null;
  } catch {
    return null;
  }
}

function cleanSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "");
}

function normalizedForComparison(value: string): string {
  return cleanSingleLine(value).toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function validLlmTitle(value: string | null, poemText: string): string | null {
  if (!value) {
    return null;
  }

  const title = cleanSingleLine(value);
  const firstLine = poemText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  if (title.length < 2 || title.length > 100 || normalizedForComparison(title) === normalizedForComparison(firstLine)) {
    return null;
  }

  return title;
}

function validMoodSentence(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const sentence = cleanSingleLine(value);
  return sentence.length >= 4 && sentence.length <= 280 ? sentence : null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tryOpenAIPoem(context: GenerationContext): Promise<OpenAIPoemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    return { poem: null, title: null, moodSentence: null, model, error: "OPENAI_API_KEY is not set" };
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
          max_output_tokens: 700,
          text: {
            format: {
              type: "json_schema",
              name: "ucu_beden_daily_poem",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  poem: { type: "string" },
                  mood_sentence: { type: "string" }
                },
                required: ["title", "poem", "mood_sentence"],
                additionalProperties: false
              }
            }
          }
        })
      });

      if (!response.ok) {
        lastError = `OpenAI returned ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await wait(1000 * attempt);
          continue;
        }
        return { poem: null, title: null, moodSentence: null, model, error: lastError };
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
        return { poem: null, title: null, moodSentence: null, model, error: "OpenAI response had no text output" };
      }

      const structured = parseStructuredPoemResponse(text);
      if (!structured || typeof structured.poem !== "string" || !structured.poem.trim()) {
        return { poem: text.trim(), title: null, moodSentence: null, model, error: null };
      }

      return {
        poem: structured.poem.trim(),
        title: typeof structured.title === "string" ? structured.title : null,
        moodSentence: typeof structured.mood_sentence === "string" ? structured.mood_sentence : null,
        model,
        error: null
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenAI request failed";
      if (attempt < 3) {
        await wait(1000 * attempt);
      }
    }
  }

  return { poem: null, title: null, moodSentence: null, model, error: lastError };
}

function mockPoem(context: GenerationContext): string {
  const geneticWords = context.input_analysis.global.dominant_words;
  const memoryWords = topWords(tokenize(context.memory_fragments.join(" ")), 8);
  const rssLeakageWords = context.sources.rss?.dailyMoodSummary.leakageWords ?? [];
  const images = [
    ...context.walk_state.seen_objects,
    context.daily_life.object_focus,
    ...geneticWords.slice(0, 4),
    ...memoryWords.slice(0, 4),
    ...rssLeakageWords.slice(0, 5)
  ].filter(Boolean);
  const selected = seededMany(images.length > 0 ? images : ["gri koltuk", "mavi halı", "ekran"], `${context.date}:poem-images`, 6);
  const first = selected[0] ?? "gri koltuk";
  const second = selected[1] ?? "mavi halı";
  const third = selected[2] ?? "ekran";
  const leak = seededPick(rssLeakageWords.length > 0 ? rssLeakageWords : ["başlık"], `${context.date}:rss-leak`);
  const hiddenVoice = context.personality_settings.hidden_voice_traits;
  const drySarcasmLine =
    hiddenVoice.dry_sarcasm > 0.5
      ? seededPick(
          [
            "sabah yine kimseye sormadan oldu, nazik sayılır",
            "gri koltuk benden daha kararlı, bunu da not ettim",
            "haberler kendini önemli sandı, ekran usulca öksürdü",
            "vücudum bugün bir yönetmelik gibi anlaşılmaz"
          ],
          `${context.date}:dry-sarcasm`
        )
      : "oda beni ciddiye almadı, ben de ona biraz çay gibi baktım";
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
    drySarcasmLine,
    walkLine,
    weatherLine,
    newsPressure,
    artLine,
    `${leak} kelimesi kapının altında ince bir ışık gibi kaldı`,
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

function fallbackTitleFor(text: string, context: GenerationContext): string {
  const words = topWords(tokenize(text), 4);
  if (words.length >= 2) {
    return `${words[0]} / ${words[1]}`;
  }
  return `UCU BEDEN / ${formatAge(context.age_months)}`;
}

export async function generatePoemWithLLM(context: GenerationContext): Promise<DailyPoem> {
  const llmResult = await tryOpenAIPoem(context);
  const openAIText = llmResult.poem?.trim();
  const poemText = (openAIText || mockPoem(context)).trim();
  const llmTitle = openAIText ? validLlmTitle(llmResult.title, poemText) : null;
  const titleGeneration: TitleGenerationSource = llmTitle ? "llm" : "fallback_dominant_words";
  const title = llmTitle ?? fallbackTitleFor(poemText, context);
  const moodSentence = openAIText ? validMoodSentence(llmResult.moodSentence) ?? context.mood_sentence : context.mood_sentence;
  const analysis = {
    ...analyzeGeneratedPoem(poemText, context),
    mood_sentence: moodSentence
  };

  return {
    date: context.date,
    title,
    title_generation: titleGeneration,
    generated_at: new Date().toISOString(),
    age_months: context.age_months,
    age_display: context.age_display,
    poem_text: poemText,
    mood: context.mood,
    mood_sentence: moodSentence,
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
