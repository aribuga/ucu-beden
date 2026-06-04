export function todayInIstanbul(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function parseGenerationArgs(args: string[]): { force: boolean; date?: string } {
  const force = args.includes("--force") || args.includes("-f");
  const dateArg = args.find((arg) => arg.startsWith("--date="));
  return {
    force,
    date: dateArg?.split("=")[1]
  };
}
