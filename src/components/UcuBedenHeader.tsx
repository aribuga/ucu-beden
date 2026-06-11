import Link from "next/link";

import type { DailyPoem, UcuBedenState } from "../lib/types";
import { memoryWeather } from "../lib/dayStateEngine";
import { LogoHeader } from "./LogoHeader";

export function UcuBedenHeader({ latest, state }: { latest: DailyPoem | null; state: UcuBedenState }) {
  const memory = memoryWeather(state.memory_density);
  return (
    <header className="header">
      <div className="header-top">
        <LogoHeader />
        <div className="meta">
          <div>Yaş: {latest?.age_display ?? `${state.age_months} ay`}</div>
          <div>Gün: {state.generated_days}</div>
          <div title={memory.sentence}>Hafıza: {memory.state}</div>
        </div>
      </div>
      <nav className="nav" aria-label="Ana gezinme">
        <Link href="/">bugün</Link>
        <Link href="/archive">arşiv</Link>
        <Link href="/memory">hafıza</Link>
        <Link href="/sources">kaynaklar</Link>
        <Link href="/mood-map">mood-map</Link>
        <Link href="/settings">ayarlar</Link>
      </nav>
    </header>
  );
}
