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
    const istanbul = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return `${istanbul.getUTCFullYear()}-${String(istanbul.getUTCMonth() + 1).padStart(2, "0")}-${String(istanbul.getUTCDate()).padStart(2, "0")}`;
  }

  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + days));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

export function previousCalendarDate(date: string): string {
  return addCalendarDays(date, -1);
}

export function parseGenerationArgs(args: string[]): { force: boolean; date?: string } {
  const force = args.includes("--force") || args.includes("-f");
  const dateArg = args.find((arg) => arg.startsWith("--date="));
  return {
    force,
    date: dateArg?.split("=")[1]
  };
}
