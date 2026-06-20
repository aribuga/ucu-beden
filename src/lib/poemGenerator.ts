import { buildCompactPoemPrompt, buildOrganicFallbackTitle } from "./compactCreativePrompt";
import {
  buildGenerationContextPacket,
  filterGenerationSurfaceTerms,
  formatLivedContextPacket,
  formatSurfacePolicyPacket,
  formatTitlePolicyPacket,
  generationFallbackTerms,
  type GenerationContextPacketInput
} from "./generationContextPacket";
import { listGeneratedPoems } from "./fileStorage";
import { tokenize, topWords } from "./inputPoems";
import { buildImageMutations, extractImages } from "./memoryEngine";
import { formatMoodSentence } from "./moodSentence";
import { analyzeGeneratedPoemLanguage, formatLanguagePolicy, formatLanguageRetryConstraints, languageMetadata } from "./languageValidator";
import { seededMany } from "./random";
import {
  analyzeGeneratedPoemSurface,
  formatStrictSurfaceRetryConstraints,
  stripGeneratedSignature,
  surfaceMetadata
} from "./surfaceValidator";
import type { DailyPoem, GenerationContext, LanguageValidationReport, MemorySelection, Mood, PersonalitySettings, PoemAnalysis, RepetitionPressure, SurfaceValidationReport, TitleGenerationSource } from "./types";
import { buildUcuBedenVoicePrompt } from "./ucuBedenVoicePrompt";

type OpenAIPoemResult = { poem: string | null; moodSentence: string | null; model: string | null; error: string | null };
type OpenAITitleResult = { title: string | null; model: string | null; error: string | null };
type StructuredPoemResponse = { poem?: unknown; mood_sentence?: unknown };
type StructuredTitleResponse = { title?: unknown };

export type GenerateTitleForPoemWithLLMInput = {
  poemText: string;
  moodSentence: string;
  date: string;
  mood: Mood;
  recentTitles: string[];
  repetition_pressure: RepetitionPressure;
  memory_selection: MemorySelection;
};

const turkishMoodLabels: Record<string, string> = {
  melancholy: "melankoli",
  anger: "öfke",
  tenderness: "şefkat",
  fatigue: "yorgunluk",
  absurdity: "absürtlük",
  clarity: "açıklık",
  desire: "arzu",
  hope: "umut"
};

function packetInput(context: GenerationContext): GenerationContextPacketInput {
  return {
    mode: "poem",
    date: context.date,
    mood: context.mood,
    sources: context.sources,
    source_digest: context.source_digest,
    daily_life: context.daily_life,
    walk_state: context.walk_state,
    memory_selection: context.memory_selection,
    repetition_pressure: context.repetition_pressure,
    state: context.state,
    genetic_style_note: context.input_analysis.global.style_notes
  };
}

function buildHiddenVoicePrompt(settings: PersonalitySettings): string {
  const traits = settings.hidden_voice_traits;
  const balance = settings.tone_balance;
  return [
    "Gizli ses dengesi:",
    `kuru sarkazm: ${traits.dry_sarcasm}`,
    `absürtlük: ${traits.absurd_domestic_humor}`,
    `ince pasif agresyon: ${traits.gentle_passive_aggression}`,
    `duygusal sızıntı: ${traits.sentimental_leak}`,
    `ton dengesi: absürt ${balance.absurd_domestic}, kuru ${balance.dry_sarcasm}, şefkatli ${balance.sentimental_leak}`,
    "Kuru dikkati varsayılan nesne imgeleriyle değil, ritim ve ilişkilerle çalıştır.",
    "Bu ayarları açıklama."
  ].join("\n");
}

export function buildPoemPromptSections(context: GenerationContext, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport) {
  const voice = buildUcuBedenVoicePrompt({ mode: "poem" });
  const packet = buildGenerationContextPacket(packetInput(context));
  return {
    language_policy: formatLanguagePolicy(),
    voice_persona: `${voice.prompt}\n\n${buildHiddenVoicePrompt(context.personality_settings)}`,
    strict_surface_policy: formatSurfacePolicyPacket(packet),
    digested_generation_context: formatLivedContextPacket(packet),
    allowed_memory_traces: packet.memory_trace_packet.fragments.length > 0
      ? packet.memory_trace_packet.fragments.map((fragment) => `- ${fragment}`).join("\n")
      : "- seçilmiş hafıza izi yok",
    source_influence_packet: packet.source_influence_packet.map((fragment) => `- ${fragment}`).join("\n"),
    title_policy_packet: formatTitlePolicyPacket(packet),
    strict_surface_retry: retryReport ? formatStrictSurfaceRetryConstraints(retryReport, "poem") : null,
    language_retry: languageRetryReport?.severe ? formatLanguageRetryConstraints(languageRetryReport) : null,
    openai_compact_prompt: buildCompactPoemPrompt(context, { surface: retryReport, language: languageRetryReport }),
    prompt_comparison_note: "Yukarıdaki teknik bölümler debug içindir; OpenAI şiir çağrısına yalnızca openai_compact_prompt gönderilir.",
    output_format: [
      formatLanguagePolicy(),
      "Bir Türkçe şiir ve kısa bir günlük ruh hali cümlesi yaz.",
      "Dış etki ritmi, dikkati, kelime öğrenmeyi, kavramsal kaymayı veya çağrışım alanını değiştirebilir; onu raporlama veya özetleme.",
      "İzin verilen hafıza izlerinden en az birini dolaylı çağır; hafıza verilerini listeleme.",
      'Ruh hali cümlesi "Bugünkü hali:" ile başlamalı.',
      "Yalnızca JSON döndür:",
      '{"poem":"...","mood_sentence":"..."}'
    ].join("\n")
  };
}

export function buildPoemPrompt(context: GenerationContext, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport): string {
  return buildCompactPoemPrompt(context, { surface: retryReport, language: languageRetryReport });
}

function parseStructuredPoemResponse(text: string): StructuredPoemResponse | null {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  try {
    const parsed = JSON.parse(start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as StructuredPoemResponse : null;
  } catch {
    return null;
  }
}

function parseStructuredTitleResponse(text: string): StructuredTitleResponse | null {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  try {
    const parsed = JSON.parse(start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as StructuredTitleResponse : null;
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

const forbiddenTitlePatterns = [/(ile|ve).+arasında/iu, /arasında/iu];

function forbiddenTitlePattern(value: string): boolean {
  return forbiddenTitlePatterns.some((pattern) => pattern.test(value));
}

function validLlmTitle(value: string | null, poemText: string, context: GenerationContext): string | null {
  if (!value) return null;
  const title = cleanSingleLine(value);
  const firstLine = poemText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const titleTerms = tokenize(title);
  const surfaceSafe = filterGenerationSurfaceTerms(titleTerms, packetInput(context)).length === titleTerms.length;
  return title.length < 2 ||
    title.length > 100 ||
    forbiddenTitlePattern(title) ||
    normalizedForComparison(title) === normalizedForComparison(firstLine) ||
    !surfaceSafe
    ? null
    : title;
}

function validMoodSentence(value: string | null): string | null {
  if (!value) return null;
  const sentence = cleanSingleLine(value);
  return sentence.length >= 4 && sentence.length <= 280 ? formatMoodSentence(sentence) : null;
}

function buildFallbackMoodSentence(context: GenerationContext): string {
  const packet = buildGenerationContextPacket(packetInput(context));
  return formatMoodSentence(`${packet.persona_safe_lived_context.lived_context_effect}; ${packet.persona_safe_lived_context.body_attention_effect}.`);
}

function uniqueMoodSentence(context: GenerationContext, candidate: string | null): string {
  const previous = new Set(context.state.mood_history.map((entry) => normalizedForComparison(entry.sentence)));
  if (candidate && !previous.has(normalizedForComparison(candidate))) return candidate;
  return buildFallbackMoodSentence(context);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dominantMoodWords(mood: Mood, limit = 3): string[] {
  return (Object.entries(mood) as Array<[keyof Mood, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => turkishMoodLabels[key] ?? key);
}

function firstPoemLine(poemText: string): string {
  return poemText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
}

function shortMemoryTitleTraces(selection: MemorySelection): string[] {
  return selection.memory_prompt_fragments
    .map(cleanSingleLine)
    .filter((fragment) => fragment.length > 0)
    .map((fragment) => fragment.split(/\s+/).slice(0, 9).join(" "))
    .slice(0, 4);
}

function titleRejectedByPattern(title: string, poemText: string): string | null {
  if (title.length < 2 || title.length > 100) return "başlık uzunluğu uygun değil";
  if (forbiddenTitlePattern(title)) return "başlık yasaklı 'arasında' kalıbını kullanıyor";
  if (normalizedForComparison(title) === normalizedForComparison(firstPoemLine(poemText))) {
    return "başlık şiirin ilk dizesini tekrar ediyor";
  }
  return null;
}

function buildTitlePrompt(params: GenerateTitleForPoemWithLLMInput, rejectedTitles: string[]): string {
  const recentTitles = params.recentTitles.slice(-20).map((title) => `- ${title}`);
  const memoryTraces = shortMemoryTitleTraces(params.memory_selection).map((trace) => `- ${trace}`);
  const repeatedShapes = params.repetition_pressure.repeated_title_shapes.slice(0, 6).map((shape) => `- ${shape}`);
  return [
    "Aşağıdaki şiire, şiiri açıklamayan kısa bir Türkçe başlık ver.",
    "Başlık şiirin içinden sonradan bulunmuş gibi dursun.",
    "İnsan gibi adlandır; özetleme, sloganlaştırma, fazla şiirselleştirme.",
    "",
    "Yasaklar",
    '- "X ile Y arasında" kullanma.',
    '- "arasında" kelimesini kullanma.',
    "- Son 20 başlığın sözdizimini tekrar etme.",
    "- Şiirin ilk dizesini başlık yapma.",
    "- Başlık nesne listesi gibi durmasın.",
    "- Aşırı düzgün edebi başlık kurma.",
    "",
    `Tarih: ${params.date}`,
    `Ruh hali: ${dominantMoodWords(params.mood).join(", ")}`,
    `Ruh hali cümlesi: ${params.moodSentence}`,
    "",
    "Son 20 başlık",
    ...(recentTitles.length > 0 ? recentTitles : ["- yok"]),
    "",
    "Tekrar eden başlık biçimleri",
    ...(repeatedShapes.length > 0 ? repeatedShapes : ["- belirgin tekrar yok"]),
    "",
    "Kısa güvenli hafıza izleri",
    ...(memoryTraces.length > 0 ? memoryTraces : ["- belirgin iz yok"]),
    "",
    ...(rejectedTitles.length > 0
      ? ["Önceki başlık adayları reddedildi; aynı biçimi tekrar etme.", ...rejectedTitles.map((title) => `- ${title}`), ""]
      : []),
    "Şiir",
    params.poemText,
    "",
    'Yalnızca JSON döndür: {"title":"..."}'
  ].join("\n");
}

async function tryOpenAIPoem(context: GenerationContext, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport): Promise<OpenAIPoemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) return { poem: null, moodSentence: null, model, error: "OPENAI_API_KEY is not set" };
  let lastError = "OpenAI request failed";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          input: buildCompactPoemPrompt(context, { surface: retryReport, language: languageRetryReport }),
          temperature: 0.85,
          max_output_tokens: 700,
          text: {
            format: {
              type: "json_schema",
              name: "ucu_beden_daily_poem",
              strict: true,
              schema: {
                type: "object",
                properties: { poem: { type: "string" }, mood_sentence: { type: "string" } },
                required: ["poem", "mood_sentence"],
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
        return { poem: null, moodSentence: null, model, error: lastError };
      }
      const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? null;
      if (!text?.trim()) return { poem: null, moodSentence: null, model, error: "OpenAI response had no text output" };
      const structured = parseStructuredPoemResponse(text);
      if (!structured || typeof structured.poem !== "string" || !structured.poem.trim()) {
        return { poem: text.trim(), moodSentence: null, model, error: null };
      }
      return {
        poem: structured.poem.trim(),
        moodSentence: typeof structured.mood_sentence === "string" ? structured.mood_sentence : null,
        model,
        error: null
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenAI request failed";
      if (attempt < 3) await wait(1000 * attempt);
    }
  }
  return { poem: null, moodSentence: null, model, error: lastError };
}

export async function generateTitleForPoemWithLLM(params: GenerateTitleForPoemWithLLMInput): Promise<OpenAITitleResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TITLE_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) return { title: null, model, error: "OPENAI_API_KEY is not set" };

  let lastError = "OpenAI title request failed";
  const rejectedTitles: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          input: buildTitlePrompt(params, rejectedTitles),
          temperature: 0.9,
          max_output_tokens: 80,
          text: {
            format: {
              type: "json_schema",
              name: "ucu_beden_poem_title",
              strict: true,
              schema: {
                type: "object",
                properties: { title: { type: "string" } },
                required: ["title"],
                additionalProperties: false
              }
            }
          }
        })
      });
      if (!response.ok) {
        lastError = `OpenAI title returned ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await wait(1000 * attempt);
          continue;
        }
        return { title: null, model, error: lastError };
      }

      const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? null;
      if (!text?.trim()) {
        lastError = "OpenAI title response had no text output";
        continue;
      }

      const structured = parseStructuredTitleResponse(text);
      const title = typeof structured?.title === "string" ? cleanSingleLine(structured.title) : null;
      if (!title) {
        lastError = "OpenAI response had no valid title payload";
        continue;
      }

      const rejectionReason = titleRejectedByPattern(title, params.poemText);
      if (rejectionReason) {
        rejectedTitles.push(`${title} (${rejectionReason})`);
        lastError = rejectionReason;
        continue;
      }

      return { title, model, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "OpenAI title request failed";
      if (attempt < 3) await wait(1000 * attempt);
    }
  }

  return { title: null, model, error: lastError };
}

function mockPoem(context: GenerationContext): string {
  const input = packetInput(context);
  const packet = buildGenerationContextPacket(input);
  const moods = Object.entries(context.mood).sort((a, b) => b[1] - a[1]).map(([key]) => turkishMoodLabels[key] ?? key);
  const pool = generationFallbackTerms(input, 12);
  const selected = seededMany(pool.length > 0 ? pool : moods, `${context.date}:poem-fallback`, 5);
  return [
    `${selected[0] ?? moods[0]} bugünün ritmini değiştirdi`,
    `${selected[1] ?? moods[1]} dikkat alanında kısa süre kaldı`,
    `${packet.persona_safe_lived_context.walk_pressure_effect}`,
    `${selected[2] ?? moods[2]} doğrudan görünmeden basıncı değiştirdi`,
    `hafıza ${selected[3] ?? moods[0]} ile eksik bir bağ kurdu`,
    `${packet.persona_safe_lived_context.outside_openness}`
  ].join("\n");
}

export function analyzeGeneratedPoem(text: string, context: GenerationContext): PoemAnalysis {
  const words = tokenize(text);
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const recurringWords = Array.from(counts.entries()).filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word]) => word);
  const images = Array.from(new Set(extractImages(text))).slice(0, 12);
  return {
    word_count: words.length,
    dominant_words: topWords(words, 14),
    recurring_words: recurringWords,
    new_images: images,
    image_mutations: buildImageMutations(images, context.date),
    mood_sentence: context.mood_sentence
  };
}

function fallbackTitleFor(text: string, context: GenerationContext, strict = false): string {
  return buildOrganicFallbackTitle(packetInput(context), text, `${context.date}:poem-title:${strict ? "strict" : "default"}`);
}

export async function generatePoemWithLLM(context: GenerationContext): Promise<DailyPoem> {
  let llmResult = await tryOpenAIPoem(context);
  let openAIText = llmResult.poem?.trim();
  let retryCount = 0;
  let languageRetryCount = 0;
  let candidateReport: SurfaceValidationReport | null = null;
  let candidateLanguageReport: LanguageValidationReport | null = null;
  while (openAIText) {
    const candidatePoemText = stripGeneratedSignature(openAIText);
    candidateReport = await analyzeGeneratedPoemSurface(
      { title: "", poem_text: candidatePoemText },
      { mode: "poem", world: context.world, repetition: context.repetition_pressure }
    );
    candidateLanguageReport = analyzeGeneratedPoemLanguage({
      title: "",
      poem_text: candidatePoemText,
      mood_sentence: llmResult.moodSentence ?? ""
    });
    if ((!candidateReport.severe && !candidateLanguageReport.severe) || retryCount >= 2) break;
    retryCount += 1;
    if (candidateLanguageReport.severe) languageRetryCount += 1;
    llmResult = await tryOpenAIPoem(
      context,
      candidateReport.severe ? candidateReport : undefined,
      candidateLanguageReport.severe ? candidateLanguageReport : undefined
    );
    openAIText = llmResult.poem?.trim();
  }
  if (openAIText && candidateLanguageReport?.severe) {
    llmResult = { ...llmResult, poem: null, error: "OpenAI output was rejected because it was not Turkish" };
    openAIText = undefined;
  }
  const poemText = stripGeneratedSignature(openAIText || mockPoem(context));
  const moodSentence = uniqueMoodSentence(context, openAIText ? validMoodSentence(llmResult.moodSentence) : null);
  const recentTitles = (await listGeneratedPoems())
    .filter((poem) => poem.date !== context.date)
    .slice(-20)
    .map((poem) => poem.title);
  const titleResult = await generateTitleForPoemWithLLM({
    poemText,
    moodSentence,
    date: context.date,
    mood: context.mood,
    recentTitles,
    repetition_pressure: context.repetition_pressure,
    memory_selection: context.memory_selection
  });
  const llmTitle = validLlmTitle(titleResult.title, poemText, context);
  const titleGeneration: TitleGenerationSource = llmTitle ? "llm_after_poem" : "fallback_dominant_words";
  const title = llmTitle ?? fallbackTitleFor(poemText, context);
  const packet = buildGenerationContextPacket(packetInput(context));
  const surfaceReport = await analyzeGeneratedPoemSurface(
    { title, poem_text: poemText },
    { mode: "poem", world: context.world, repetition: context.repetition_pressure }
  );
  const languageReport = analyzeGeneratedPoemLanguage({ title, poem_text: poemText, mood_sentence: moodSentence });
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
    memory_selection: context.memory_selection,
    influences: [
      ...packet.source_influence_packet,
      packet.persona_safe_lived_context.lived_context_effect
    ],
    generation: {
      provider: openAIText ? "openai" : "mock",
      model: llmResult.model,
      fallback_reason: openAIText ? null : llmResult.error,
      ...surfaceMetadata(surfaceReport, retryCount),
      ...languageMetadata(languageReport, languageRetryCount)
    },
    analysis: { ...analyzeGeneratedPoem(poemText, context), mood_sentence: moodSentence },
    repetition_pressure: context.repetition_pressure
  };
}
