"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { DailyPoem } from "../lib/types";

import { DailyPoemCard } from "./DailyPoemCard";

const pageSize = 12;

function pageHref(page: number): string {
  return page <= 1 ? "/archive" : `/archive?page=${page}`;
}

function pageNumber(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageFromLocation(): number {
  return pageNumber(new URLSearchParams(window.location.search).get("page"));
}

export function ArchiveList({ poems }: { poems: DailyPoem[] }) {
  const [requestedPage, setRequestedPage] = useState(1);
  const newestFirst = useMemo(() => poems.slice().reverse(), [poems]);
  const totalPages = Math.max(1, Math.ceil(newestFirst.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pagePoems = newestFirst.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    const updatePage = () => setRequestedPage(pageFromLocation());
    updatePage();
    window.addEventListener("popstate", updatePage);
    return () => window.removeEventListener("popstate", updatePage);
  }, []);

  function goToPage(event: MouseEvent<HTMLAnchorElement>, page: number) {
    event.preventDefault();
    window.history.pushState(null, "", pageHref(page));
    setRequestedPage(page);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      {pagePoems.map((poem) => <DailyPoemCard key={poem.date} poem={poem} />)}
      {totalPages > 1 ? (
        <nav className="timeline-title" aria-label="Arşiv sayfaları">
          {currentPage > 1 ? (
            <a className="tiny" href={pageHref(currentPage - 1)} onClick={(event) => goToPage(event, currentPage - 1)}>daha yeni</a>
          ) : (
            <span />
          )}
          <span className="tiny">{currentPage} / {totalPages}</span>
          {currentPage < totalPages ? (
            <a className="tiny" href={pageHref(currentPage + 1)} onClick={(event) => goToPage(event, currentPage + 1)}>daha eski</a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
