import Link from "next/link";

import type { DailyPoem, UcuBedenState } from "../lib/types";

export function UcuBedenHeader({ latest, state }: { latest: DailyPoem | null; state: UcuBedenState }) {
  return (
    <header className="header">
      <div className="header-top">
        <h1 className="brand">UCU BEDEN</h1>
        <div className="meta">
          <div>Yaş: {latest?.age_display ?? `${state.age_months} ay`}</div>
          <div>Gün: {state.generated_days}</div>
          <div>Hafıza: {state.memory_density}/100</div>
        </div>
      </div>
      <nav className="nav" aria-label="Ana gezinme">
        <Link href="/">bugün</Link>
        <Link href="/archive">arşiv</Link>
        <Link href="/memory">hafıza</Link>
        <Link href="/sources">kaynaklar</Link>
        <Link href="/settings">ayarlar</Link>
      </nav>
    </header>
  );
}
