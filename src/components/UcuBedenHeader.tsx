import Link from "next/link";

import { readMemoryReport } from "../lib/fileStorage";
import { memoryClimateHeadline } from "../lib/memoryPresentation";
import type { DailyPoem, UcuBedenState } from "../lib/types";
import { LogoHeader } from "./LogoHeader";

export async function UcuBedenHeader({ latest, state }: { latest: DailyPoem | null; state: UcuBedenState }) {
  const memory = memoryClimateHeadline(await readMemoryReport());
  return (
    <header className="header">
      <div className="header-top">
        <LogoHeader />
        <div className="meta">
          <div>Yaş: {latest?.age_display ?? `${state.age_months} ay`}</div>
          <div>Gün: {state.generated_days}</div>
          <div>Hafıza: {memory}</div>
        </div>
      </div>
      <nav className="nav" aria-label="Ana gezinme">
        <Link href="/">bugün</Link>
        <Link href="/archive">arşiv</Link>
        <Link href="/dreams">rüyalar</Link>
        <Link href="/memory">hafıza</Link>
        <Link href="/memory/mutations">mutasyonlar</Link>
        <Link href="/sources">kaynaklar</Link>
        <Link href="/mood-map">mood-map</Link>
        <Link href="/settings">ayarlar</Link>
      </nav>
    </header>
  );
}
