import { tokenize } from "./inputPoems";
import type {
  DailyPoem,
  DreamRecord,
  LanguageValidationReport,
  LanguageViolation,
  LanguageViolationField,
  PoemGenerationMeta
} from "./types";

const englishMarkers = new Set(
  tokenize(
    [
      "a an and are as at be because been before between but by can could did do does each even every for from had has have he her here him his how i if in into is it its may might more most must my no not of on one only or other our out over she should so some than that the their them then there these they this those through to too under up very was we were what when where which while who why will with would you your",
      "after again against all almost already also always any around away back become being both down during enough ever few first get give go good great keep know last less like little long look made make many much need never new next now often old once own part people place put same say see seem since still such take tell thing think time use want way well work world",
      "attention breath breathing broken change clause compressed conceptual direct dream edge effect field folding image influence internalized language learning memory mood movement output poem pressure question rhythm sentence shadow short silence source sustained title turn vocabulary voice without write",
      "appeared available blocked closed distributed false high inward limited low measured medium none present true withheld"
    ].join(" ")
  )
);

const turkishMarkers = new Set(
  tokenize(
    "bir bu şu ve ile için gibi daha çok az ama çünkü kadar olan olarak var yok kendi bugün şimdi burada değil içinde sonra önce her ben sen o biz siz onlar mı mi mu mü da de ki ne nasıl neden hangi zaman gün beden hafıza rüya şiir başlık cümle ses sessizlik dikkat ritim öğrenme kayma etki dış iç geri dönüş"
  )
);

function distinct(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function rounded(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function languageFor(englishRatio: number, englishMatches: string[], hasTurkishSignal: boolean) {
  if (englishRatio >= 0.35) return "english" as const;
  if (englishMatches.length > 0) return "mixed" as const;
  if (hasTurkishSignal) return "turkish" as const;
  return "undetermined" as const;
}

export function analyzeGeneratedLanguage(
  text: string,
  field: LanguageViolationField = "text"
): LanguageValidationReport {
  const tokens = tokenize(text).filter((token) => /\p{L}/u.test(token));
  const englishMatches = distinct(tokens.filter((token) => englishMarkers.has(token)));
  const englishCount = tokens.filter((token) => englishMarkers.has(token)).length;
  const englishRatio = rounded(englishCount / Math.max(1, tokens.length));
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const nonTurkishLines = lines.filter((line) => {
    const lineTokens = tokenize(line).filter((token) => /\p{L}/u.test(token));
    if (lineTokens.length === 0) return false;
    const lineEnglish = lineTokens.filter((token) => englishMarkers.has(token)).length;
    const hasTurkishSignal = /[çğıöşü]/iu.test(line) || lineTokens.some((token) => turkishMarkers.has(token));
    return lineEnglish / lineTokens.length >= 0.25 && !hasTurkishSignal;
  });
  const nonTurkishLineRatio = rounded(nonTurkishLines.length / Math.max(1, lines.length));
  const shortTextEnglish = tokens.length <= 4 && englishRatio >= 0.5;
  const severeEnglish = shortTextEnglish || englishRatio >= 0.18 || nonTurkishLineRatio >= 0.34;
  const hasTurkishSignal = /[çğıöşü]/iu.test(text) || tokens.some((token) => turkishMarkers.has(token));
  const violations: LanguageViolation[] = [];
  if (englishMatches.length > 0) {
    violations.push({
      field,
      kind: field === "title" && severeEnglish ? "english_title" : "english_ratio",
      severity: severeEnglish ? "severe" : "warning",
      matches: englishMatches.slice(0, 16)
    });
  }
  if (nonTurkishLines.length > 0) {
    violations.push({
      field,
      kind: "non_turkish_lines",
      severity: nonTurkishLineRatio >= 0.34 ? "severe" : "warning",
      matches: nonTurkishLines.slice(0, 4)
    });
  }
  return {
    language_validation_passed: !severeEnglish,
    severe: severeEnglish,
    english_ratio: englishRatio,
    non_turkish_line_ratio: nonTurkishLineRatio,
    detected_language: languageFor(englishRatio, englishMatches, hasTurkishSignal),
    english_matches: englishMatches,
    language_violations: violations
  };
}

function combineLanguageReports(reports: LanguageValidationReport[]): LanguageValidationReport {
  const severe = reports.some((report) => report.severe);
  const englishRatio = reports.reduce((sum, report) => sum + report.english_ratio, 0) / Math.max(1, reports.length);
  const lineRatio = reports.reduce((sum, report) => sum + report.non_turkish_line_ratio, 0) / Math.max(1, reports.length);
  const languages = reports.map((report) => report.detected_language);
  return {
    language_validation_passed: !severe,
    severe,
    english_ratio: rounded(englishRatio),
    non_turkish_line_ratio: rounded(lineRatio),
    detected_language: languages.includes("english") ? "english" : languages.includes("mixed") ? "mixed" : languages.includes("turkish") ? "turkish" : "undetermined",
    english_matches: distinct(reports.flatMap((report) => report.english_matches)),
    language_violations: reports.flatMap((report) => report.language_violations)
  };
}

export function analyzeGeneratedPoemLanguage(value: { title: string; poem_text: string; mood_sentence: string }): LanguageValidationReport {
  return combineLanguageReports([
    analyzeGeneratedLanguage(value.title, "title"),
    analyzeGeneratedLanguage(value.poem_text, "poem_text"),
    analyzeGeneratedLanguage(value.mood_sentence, "mood_sentence")
  ]);
}

export function analyzeGeneratedDreamLanguage(value: { title: string; dream_text: string; mood_after: string }): LanguageValidationReport {
  return combineLanguageReports([
    analyzeGeneratedLanguage(value.title, "title"),
    analyzeGeneratedLanguage(value.dream_text, "dream_text"),
    analyzeGeneratedLanguage(value.mood_after, "mood_after")
  ]);
}

export function formatLanguagePolicy(): string {
  return [
    "Çıktı dili: Türkçe.",
    "Başlık, şiir, günlük ruh hali cümlesi, rüya metni ve rüya sonrası ruh hali bütünüyle Türkçe olmalı.",
    "İngilizce satır, İngilizce başlık veya İngilizce açıklama yazma.",
    "Şiiri ya da rüyayı İngilizceye çevirme.",
    "Teknik alan adları yalnızca talimattır; çıktı diline ve üsluba taşınmamalıdır."
  ].join("\n");
}

export function formatLanguageRetryConstraints(report: LanguageValidationReport): string {
  return [
    "Önceki çıktı Türkçe olmadığı için reddedildi.",
    "Metnin tamamını Türkçe yeniden yaz.",
    "Kaynak etkilerini içeride tut; İngilizce sözcük, satır veya başlık üretme.",
    `Önceki İngilizce oranı: ${report.english_ratio}.`,
    `Kaçınılacak İngilizce izler: ${report.english_matches.join(", ") || "yok"}.`
  ].join("\n");
}

export function languageMetadata(report: LanguageValidationReport, retryCount: number) {
  return {
    language_validation_passed: report.language_validation_passed,
    language_violations: report.language_violations,
    english_ratio: report.english_ratio,
    language_retry_count: retryCount
  };
}

function hasLanguageMetadata(generation: PoemGenerationMeta): boolean {
  return generation.language_validation_passed !== undefined || generation.language_violations !== undefined;
}

function validLanguageMetadata(generation: PoemGenerationMeta): boolean {
  const severe = generation.language_violations?.some((violation) => violation.severity === "severe") ?? false;
  return (
    typeof generation.language_validation_passed === "boolean" &&
    Array.isArray(generation.language_violations) &&
    typeof generation.english_ratio === "number" &&
    generation.english_ratio >= 0 &&
    generation.english_ratio <= 1 &&
    typeof generation.language_retry_count === "number" &&
    generation.language_retry_count >= 0 &&
    generation.language_validation_passed === !severe
  );
}

export function validateStoredLanguageRecords(poems: DailyPoem[], dreams: DreamRecord[]) {
  const records = [
    ...poems.map((record) => ({ origin: `poem:${record.date}`, record, report: analyzeGeneratedPoemLanguage(record) })),
    ...dreams.map((record) => ({ origin: `dream:${record.date}`, record, report: analyzeGeneratedDreamLanguage(record) }))
  ];
  const enriched = records.filter(({ record }) => hasLanguageMetadata(record.generation));
  const invalidMetadata = enriched.filter(({ record }) => !validLanguageMetadata(record.generation)).map(({ origin }) => origin);
  const severeWithoutRetry = enriched
    .filter(({ record, report }) => record.generation.provider === "openai" && report.severe && (record.generation.language_retry_count ?? 0) < 1)
    .map(({ origin }) => origin);
  const severeEnglishOutput = records.filter(({ report }) => report.severe).map(({ origin }) => origin);
  const enrichedSevereEnglishOutput = enriched.filter(({ report }) => report.severe).map(({ origin }) => origin);
  return {
    valid: invalidMetadata.length === 0 && severeWithoutRetry.length === 0 && enrichedSevereEnglishOutput.length === 0,
    metadata_records: {
      with_language_validation: enriched.length,
      legacy_without_language_validation: records.length - enriched.length
    },
    invalid_language_validation_metadata: invalidMetadata,
    severe_english_without_retry: severeWithoutRetry,
    severe_english_output: severeEnglishOutput,
    legacy_severe_english_output: severeEnglishOutput.filter((origin) => !enriched.some((item) => item.origin === origin))
  };
}
