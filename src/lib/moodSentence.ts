export function formatMoodSentence(sentence?: string): string {
  if (!sentence) {
    return "";
  }

  const trimmed = sentence.trim();
  if (trimmed.toLocaleLowerCase("tr").startsWith("bugünkü hali:")) {
    return trimmed;
  }

  return `Bugünkü hali: ${trimmed}`;
}
