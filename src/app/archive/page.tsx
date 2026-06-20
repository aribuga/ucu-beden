import Link from "next/link";

import { DailyPoemCard } from "../../components/DailyPoemCard";
import { UcuBedenHeader } from "../../components/UcuBedenHeader";
import { getLatestPoem, listGeneratedPoems, readState } from "../../lib/fileStorage";

const pageSize = 12;

function pageHref(page: number): string {
  return page <= 1 ? "/archive" : `/archive?page=${page}`;
}

function pageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function ArchivePage({ searchParams }: { searchParams?: Promise<{ page?: string | string[] }> }) {
  const [latest, poems, state] = await Promise.all([getLatestPoem(), listGeneratedPoems(), readState()]);
  const params = await searchParams;
  const newestFirst = poems.slice().reverse();
  const totalPages = Math.max(1, Math.ceil(newestFirst.length / pageSize));
  const currentPage = Math.min(pageNumber(params?.page), totalPages);
  const pagePoems = newestFirst.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <main className="site-shell">
      <UcuBedenHeader latest={latest} state={state} />
      <section className="section">
        <h2 className="section-title">Arşiv</h2>
        {poems.length === 0 ? (
          <p>Henüz arşivlenmiş şiir yok.</p>
        ) : (
          <>
            {pagePoems.map((poem) => <DailyPoemCard key={poem.date} poem={poem} />)}
            {totalPages > 1 ? (
              <nav className="timeline-title" aria-label="Arşiv sayfaları">
                {currentPage > 1 ? <Link className="tiny" href={pageHref(currentPage - 1)}>daha yeni</Link> : <span />}
                <span className="tiny">{currentPage} / {totalPages}</span>
                {currentPage < totalPages ? <Link className="tiny" href={pageHref(currentPage + 1)}>daha eski</Link> : <span />}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
