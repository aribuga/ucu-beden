import type { MemoryReport } from "./types";

export function memoryClimateHeadline(report: MemoryReport | null): string {
  if (!report || report.trace_count === 0) return "kayıt yok";
  const climate = report.climate;
  const ranked = [
    { value: climate.repression.value, text: "bastırılmış izler önde" },
    { value: climate.clarity.value, text: "çağırma yolu açık" },
    { value: climate.pressure.value, text: "duygusal basınç önde" },
    { value: climate.leakage.value, text: "dış etki içeri sızıyor" },
    { value: climate.decay.value, text: "eski izler silikleşiyor" }
  ].sort((a, b) => b.value - a.value);
  return ranked[0]?.text ?? "izler dengede";
}

export function memoryClimateDetail(report: MemoryReport): string {
  const parts: string[] = [];
  if (report.suppressed.length > 0) parts.push("bastırılmış izler mevcut");
  if (report.dream_returns.length > 0) parts.push("rüyadan dönen bağlantılar var");
  if (report.indirect_only.length > 0) parts.push("bazı tekrarlar yalnızca dolaylı çağrılıyor");
  if (report.external_leakage.length > 0) parts.push("dış etki içselleştirilmiş izlere dönüşmüş");
  return parts.join("; ") || "hafıza kayıtları sakin biçimde birikiyor";
}
