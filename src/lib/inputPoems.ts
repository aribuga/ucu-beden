import path from "node:path";

import { listFiles, readTextFile, storagePaths, writeJsonFile } from "./fileStorage";
import type { InputFileAnalysis, InputPoemsAnalysis, ParsedInputPoem } from "./types";

const stopWords = new Set([
  "ve",
  "ile",
  "bir",
  "bu",
  "şu",
  "o",
  "da",
  "de",
  "mi",
  "mı",
  "mu",
  "mü",
  "için",
  "gibi",
  "ama",
  "ben",
  "sen",
  "biz",
  "siz",
  "her",
  "çok",
  "az",
  "daha",
  "en",
  "var",
  "yok",
  "diye",
  "olan",
  "kadar",
  "sonra",
  "önce",
  "buraya",
  "buradan"
]);

const lexicons = {
  food: ["tost", "tavuk", "pilav", "yoğurt", "makarna", "sucuk", "salata", "ekşi", "maya", "döner", "ekmek", "çay", "kahve"],
  body: ["beden", "ağız", "dil", "gövde", "ayak", "el", "mide", "baş", "yüz", "bacak", "kol", "kalp", "boğaz"],
  animal: ["kurbağa", "kuzu", "yunus", "sinek", "köpek", "kedi", "kuş", "balık", "hayvan"],
  city: ["sokak", "park", "mahalle", "apartman", "market", "vapur", "kadıköy", "osmanağa", "yoğurtçu", "kalamış"],
  absurd: ["oyuncak", "haber", "suç", "rakam", "kurum", "market", "spor", "porselen", "yeşil"],
  affect: ["panik", "yorgun", "halsiz", "şefkat", "arzu", "korku", "komik", "sinir", "üzgün"]
};

export function tokenize(text: string): string[] {
  return Array.from(text.toLocaleLowerCase("tr").matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0]).filter(
    (word) => word.length > 1 && !stopWords.has(word)
  );
}

export function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

export function topWords(words: string[], limit = 12): string[] {
  return Array.from(countWords(words).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, limit)
    .map(([word]) => word);
}

function uniqueMatches(words: string[], group: keyof typeof lexicons): string[] {
  const wordSet = new Set(words);
  return lexicons[group].filter((item) => wordSet.has(item));
}

function detectImageFields(words: string[]): string[] {
  const fields: string[] = [];
  if (uniqueMatches(words, "food").length > 0) fields.push("yemek");
  if (uniqueMatches(words, "body").length > 0) fields.push("beden");
  if (uniqueMatches(words, "animal").length > 0) fields.push("hayvan");
  if (uniqueMatches(words, "city").length > 0) fields.push("şehir / mahalle");
  if (uniqueMatches(words, "absurd").length > 0) fields.push("absürt gündelik");
  if (fields.length === 0) fields.push("gündelik kırıntı");
  return fields;
}

function repeatedPhrases(text: string): string[] {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "-");
  const phrases = new Map<string, number>();

  for (const line of lines) {
    const words = tokenize(line);
    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
  }

  return Array.from(phrases.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

function toneFor(words: string[], text: string): string[] {
  const tone = new Set<string>(["gündelik"]);
  if (uniqueMatches(words, "absurd").length > 0) tone.add("absürt");
  if (uniqueMatches(words, "body").length > 0) tone.add("bedensel");
  if (uniqueMatches(words, "food").length > 0) tone.add("yemekle bozulan");
  if (uniqueMatches(words, "affect").some((word) => ["panik", "yorgun", "halsiz", "korku"].includes(word))) tone.add("panic-comic");
  if (/[!?]{2,}|çok|hani|ya|abi|lan/ui.test(text)) tone.add("konuşma dili bozukluğu");
  if (tone.size < 3) tone.add("kırık ve samimi");
  return Array.from(tone);
}

function absurdFragments(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => {
      const words = tokenize(line);
      return uniqueMatches(words, "food").length > 0 && uniqueMatches(words, "body").length > 0;
    })
    .slice(0, 8);
}

export function parseInputPoems(file: string, text: string): ParsedInputPoem[] {
  const parts: string[] = [];
  let current: string[] = [];

  for (const line of text.split(/\r?\n/g)) {
    if (line.trim() === "-") {
      const poem = current.join("\n").trim();
      if (poem.length > 0) {
        parts.push(poem);
      }
      current = [];
      continue;
    }

    current.push(line);
  }

  const lastPoem = current.join("\n").trim();
  if (lastPoem.length > 0) {
    parts.push(lastPoem);
  }

  const baseName = path.basename(file);
  return parts.map((textPart, index) => ({
    id: `${baseName.replace(/\.txt$/i, "")}-${String(index + 1).padStart(3, "0")}`,
    file: baseName,
    index: index + 1,
    text: textPart
  }));
}

function isPlaceholderInput(text: string): boolean {
  const normalized = text.toLocaleLowerCase("tr");
  return normalized.includes("ilk şiirini buraya yapıştır") && normalized.includes("tek satırdaki tire şiirleri ayırır");
}

function analyzeFile(file: string, poems: ParsedInputPoem[]): InputFileAnalysis {
  const text = poems.map((poem) => poem.text).join("\n");
  const words = tokenize(text);

  return {
    file: path.basename(file),
    poem_count: poems.length,
    word_count: words.length,
    dominant_words: topWords(words),
    image_fields: detectImageFields(words),
    food_images: uniqueMatches(words, "food"),
    body_images: uniqueMatches(words, "body"),
    animal_images: uniqueMatches(words, "animal"),
    city_images: uniqueMatches(words, "city"),
    absurd_fragments: absurdFragments(text),
    repeated_phrases: repeatedPhrases(text),
    tone: toneFor(words, text),
    syntax_notes: "Tek satır tireyle ayrılan serbest parçalar; kırık cümle, gündelik konuşma ve ani yön değişimi korunur.",
    style_notes:
      "Analiz yalnızca genetik iz çıkarır: ritim, nesne alanı, konuşma bozulması, bedensel mizah ve panik kırıntısı şiire kopyasız taşınır."
  };
}

function mergeUnique(lists: string[][], limit = 16): string[] {
  return Array.from(new Set(lists.flat())).slice(0, limit);
}

export async function readInputPoems(): Promise<ParsedInputPoem[]> {
  const files = await listFiles(storagePaths.poemsInput, ".txt");
  const parsed: ParsedInputPoem[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (isPlaceholderInput(text)) {
      continue;
    }
    parsed.push(...parseInputPoems(file, text));
  }

  return parsed;
}

export async function analyzeInputPoems(): Promise<InputPoemsAnalysis> {
  const files = await listFiles(storagePaths.poemsInput, ".txt");
  const fileAnalyses: InputFileAnalysis[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (isPlaceholderInput(text)) {
      continue;
    }
    const poems = parseInputPoems(file, text);
    if (poems.length === 0) {
      continue;
    }
    fileAnalyses.push(analyzeFile(file, poems));
  }

  const globalText = fileAnalyses.map((analysis) => analysis.dominant_words.join(" ")).join(" ");
  const globalWords = tokenize(globalText);
  const poemCount = fileAnalyses.reduce((sum, analysis) => sum + analysis.poem_count, 0);
  const wordCount = fileAnalyses.reduce((sum, analysis) => sum + analysis.word_count, 0);

  return {
    files: fileAnalyses,
    global: {
      poem_count: poemCount,
      word_count: wordCount,
      dominant_words: topWords(globalWords.length > 0 ? globalWords : fileAnalyses.flatMap((analysis) => analysis.dominant_words), 16),
      image_fields: mergeUnique(fileAnalyses.map((analysis) => analysis.image_fields)),
      food_images: mergeUnique(fileAnalyses.map((analysis) => analysis.food_images)),
      body_images: mergeUnique(fileAnalyses.map((analysis) => analysis.body_images)),
      animal_images: mergeUnique(fileAnalyses.map((analysis) => analysis.animal_images)),
      city_images: mergeUnique(fileAnalyses.map((analysis) => analysis.city_images)),
      absurd_fragments: mergeUnique(fileAnalyses.map((analysis) => analysis.absurd_fragments), 12),
      repeated_phrases: mergeUnique(fileAnalyses.map((analysis) => analysis.repeated_phrases), 12),
      tone: mergeUnique(fileAnalyses.map((analysis) => analysis.tone), 10),
      rhythm_notes:
        poemCount === 0
          ? "Henüz analiz edilecek kullanıcı şiiri yok."
          : "Serbest dize, gündelik konuşma kırılması, ani nesne çarpışması ve kısa/taşan cümleler birlikte izleniyor.",
      style_notes:
        "Gündelik olanla absürt olan iç içe geçer; yemek, beden, şehir, yorgunluk ve şefkat alanları kopyasız bir genetik hafıza olarak kullanılır.",
      taboo_copying_rules: "Do not reproduce full lines from input poems."
    }
  };
}

export async function analyzeAndSaveInputPoems(): Promise<InputPoemsAnalysis> {
  const analysis = await analyzeInputPoems();
  await writeJsonFile(storagePaths.inputAnalysis, analysis);
  return analysis;
}
