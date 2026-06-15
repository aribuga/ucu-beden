import {
  buildGenerationContextPacket,
  filterGenerationSurfaceTerms,
  formatLivedContextPacket,
  formatSurfacePolicyPacket,
  formatTitlePolicyPacket,
  generationFallbackTerms,
  type GenerationContextPacketInput
} from "./generationContextPacket";
import { buildCompactDreamPrompt, buildOrganicFallbackTitle } from "./compactCreativePrompt";
import { tokenize } from "./inputPoems";
import { analyzeGeneratedDreamLanguage, formatLanguagePolicy, formatLanguageRetryConstraints, languageMetadata } from "./languageValidator";
import { seededMany } from "./random";
import {
  analyzeGeneratedDreamSurface,
  formatStrictSurfaceRetryConstraints,
  surfaceMetadata
} from "./surfaceValidator";
import type { DailyLifeRecord, DailyPoem, DreamRecord, LanguageValidationReport, MemorySelection, RepetitionPressure, SourceDigestRecord, SurfaceValidationReport, UcuBedenState } from "./types";
import { buildUcuBedenVoicePrompt } from "./ucuBedenVoicePrompt";

type DreamParams = {
  date: string;
  poem: DailyPoem;
  dailyLife: DailyLifeRecord;
  state: UcuBedenState;
  repetition: RepetitionPressure;
  memorySelection: MemorySelection;
  sourceDigest?: SourceDigestRecord | null;
};

type DreamPayload = { title?: unknown; dream_text?: unknown; symbols?: unknown; mood_after?: unknown; memory_mutations?: unknown };

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

function packetInput(params: DreamParams): GenerationContextPacketInput {
  return {
    mode: "dream",
    date: params.date,
    mood: params.poem.mood,
    sources: params.poem.sources,
    source_digest: params.sourceDigest,
    daily_life: params.dailyLife,
    walk_state: params.poem.walk_state,
    memory_selection: params.memorySelection,
    repetition_pressure: params.repetition,
    state: params.state,
    poem: params.poem
  };
}

function cleanJson(text: string): DreamPayload | null {
  const value = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 && end > start ? value.slice(start, end + 1) : value) as DreamPayload;
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function buildDreamPromptSections(params: DreamParams, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport) {
  const voice = buildUcuBedenVoicePrompt({ mode: "dream" });
  const packet = buildGenerationContextPacket(packetInput(params));
  return {
    language_policy: formatLanguagePolicy(),
    voice_persona: voice.prompt,
    strict_surface_policy: [
      formatSurfacePolicyPacket(packet),
      "Kaynak şiir yalnızca kalıntı olarak temsil edilir. Onu yeniden kurma veya yüzey terimlerini doğrudan kullanma."
    ].join("\n"),
    digested_generation_context: formatLivedContextPacket(packet),
    allowed_memory_traces: packet.memory_trace_packet.fragments.length > 0
      ? packet.memory_trace_packet.fragments.map((fragment) => `- ${fragment}`).join("\n")
      : "- seçilmiş hafıza izi yok",
    source_influence_packet: packet.source_influence_packet.map((fragment) => `- ${fragment}`).join("\n"),
    title_policy_packet: formatTitlePolicyPacket(packet),
    strict_surface_retry: retryReport ? formatStrictSurfaceRetryConstraints(retryReport, "dream") : null,
    language_retry: languageRetryReport?.severe ? formatLanguageRetryConstraints(languageRetryReport) : null,
    output_format: [
      formatLanguagePolicy(),
      "Şiirle duygusal bağı olan ama şiirin ikinci sürümü olmayan kırık ve simgesel bir Türkçe rüya üret.",
      "Bastırılmış izler kopyalanmış yüzeylerle değil, değişmiş çağrışımlarla geri dönsün.",
      "3-7 simge ve 1-4 hafıza mutasyonu oluştur.",
      "Yalnızca JSON döndür:",
      '{"title":"...","dream_text":"...","symbols":["..."],"mood_after":"...","memory_mutations":["..."]}'
    ].join("\n")
  };
}

export function buildDreamPrompt(params: DreamParams, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport): string {
  return buildCompactDreamPrompt(params, { surface: retryReport, language: languageRetryReport });
}

async function tryOpenAIDream(params: DreamParams, retryReport?: SurfaceValidationReport, languageRetryReport?: LanguageValidationReport) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) return { payload: null, model, error: "OPENAI_API_KEY is not set" };
  let lastError = "OpenAI dream request failed";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          input: buildCompactDreamPrompt(params, { surface: retryReport, language: languageRetryReport }),
          temperature: 0.9,
          max_output_tokens: 600,
          text: {
            format: {
              type: "json_schema",
              name: "ucu_beden_dream",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  dream_text: { type: "string" },
                  symbols: { type: "array", items: { type: "string" } },
                  mood_after: { type: "string" },
                  memory_mutations: { type: "array", items: { type: "string" } }
                },
                required: ["title", "dream_text", "symbols", "mood_after", "memory_mutations"],
                additionalProperties: false
              }
            }
          }
        })
      });
      if (!response.ok) {
        lastError = `OpenAI returned ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await wait(attempt * 1000);
          continue;
        }
        return { payload: null, model, error: lastError };
      }
      const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? null;
      const payload = text ? cleanJson(text) : null;
      return { payload, model, error: payload ? null : "OpenAI response had no valid dream payload" };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }
  return { payload: null, model, error: lastError };
}

function mockDream(params: DreamParams): DreamPayload {
  const input = packetInput(params);
  const packet = buildGenerationContextPacket(input);
  const moodTerms = Object.entries(params.poem.mood).sort((a, b) => b[1] - a[1]).map(([key]) => turkishMoodLabels[key] ?? key);
  const pool = generationFallbackTerms(input, 12);
  const symbols = seededMany(pool.length > 0 ? pool : moodTerms, `${params.poem.date}:mock-dream`, 5);
  return {
    title: symbols.slice(0, 3).join(" ") || moodTerms.slice(0, 2).join(" "),
    dream_text: [
      `${symbols[0] ?? moodTerms[0]} ilişki alanını değiştirdi`,
      `${symbols[1] ?? moodTerms[1]} dolaylı geri döndü`,
      `${packet.persona_safe_lived_context.body_attention_effect}`,
      `${symbols[2] ?? moodTerms[2]} uyanıştan önce bağının bir bölümünü kaybetti`
    ].join("\n"),
    symbols,
    mood_after: packet.persona_safe_lived_context.lived_context_effect,
    memory_mutations: symbols.slice(0, 3).map((symbol) => `${symbol}: rüyada çağrılırken ilişkisi değişti`)
  };
}

function safeDreamTitle(payload: DreamPayload, params: DreamParams, strict = false): string {
  const candidate = typeof payload.title === "string" ? payload.title.trim() : "";
  const candidateTerms = tokenize(candidate);
  if (!strict && candidate && filterGenerationSurfaceTerms(candidateTerms, packetInput(params)).length === candidateTerms.length) return candidate;
  const text = typeof payload.dream_text === "string" ? payload.dream_text : "";
  return buildOrganicFallbackTitle(packetInput(params), text, `${params.date}:dream-title:${strict ? "strict" : "default"}`);
}

export async function generateDream(params: DreamParams): Promise<DreamRecord> {
  let llm = await tryOpenAIDream(params);
  let candidatePayload = llm.payload && typeof llm.payload.dream_text === "string" ? llm.payload : null;
  let retryCount = 0;
  let languageRetryCount = 0;
  let candidateReport: SurfaceValidationReport | null = null;
  let candidateLanguageReport: LanguageValidationReport | null = null;
  while (candidatePayload) {
    const candidateTitle = typeof candidatePayload.title === "string" ? candidatePayload.title : safeDreamTitle(candidatePayload, params);
    candidateReport = await analyzeGeneratedDreamSurface(
      {
        title: candidateTitle,
        dream_text: candidatePayload.dream_text as string
      },
      { mode: "dream", repetition: params.repetition, sourcePoem: params.poem }
    );
    candidateLanguageReport = analyzeGeneratedDreamLanguage({
      title: candidateTitle,
      dream_text: candidatePayload.dream_text as string,
      mood_after: typeof candidatePayload.mood_after === "string" ? candidatePayload.mood_after : ""
    });
    if ((!candidateReport.severe && !candidateLanguageReport.severe) || retryCount >= 2) break;
    retryCount += 1;
    if (candidateLanguageReport.severe) languageRetryCount += 1;
    llm = await tryOpenAIDream(
      params,
      candidateReport.severe ? candidateReport : undefined,
      candidateLanguageReport.severe ? candidateLanguageReport : undefined
    );
    candidatePayload = llm.payload && typeof llm.payload.dream_text === "string" ? llm.payload : null;
  }
  if (candidatePayload && candidateLanguageReport?.severe) {
    llm = { ...llm, payload: null, error: "OpenAI output was rejected because it was not Turkish" };
    candidatePayload = null;
  }
  const payload = candidatePayload ?? mockDream(params);
  const fromLlm = payload === llm.payload;
  const symbols = Array.isArray(payload.symbols) ? payload.symbols.filter((value): value is string => typeof value === "string").slice(0, 8) : [];
  const mutations = Array.isArray(payload.memory_mutations) ? payload.memory_mutations.filter((value): value is string => typeof value === "string").slice(0, 6) : [];
  const title = safeDreamTitle(payload, params, candidateReport?.title_violation ?? false);
  const dreamText = typeof payload.dream_text === "string" ? payload.dream_text.trim() : "";
  const surfaceReport = await analyzeGeneratedDreamSurface(
    { title, dream_text: dreamText },
    { mode: "dream", repetition: params.repetition, sourcePoem: params.poem }
  );
  const moodAfter = typeof payload.mood_after === "string" ? payload.mood_after.trim() : "";
  const languageReport = analyzeGeneratedDreamLanguage({ title, dream_text: dreamText, mood_after: moodAfter });
  return {
    date: params.date,
    source_date: params.poem.date,
    generated_at: new Date().toISOString(),
    title,
    dream_text: dreamText,
    symbols,
    mood_after: moodAfter,
    visual_prompt: "",
    image_path: null,
    memory_mutations: mutations,
    memory_selection: params.memorySelection,
    generation: {
      provider: fromLlm ? "openai" : "mock",
      model: llm.model,
      fallback_reason: fromLlm ? null : llm.error,
      ...surfaceMetadata(surfaceReport, retryCount),
      ...languageMetadata(languageReport, languageRetryCount)
    }
  };
}
