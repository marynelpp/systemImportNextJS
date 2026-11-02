"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const validLimits = new Set([5, 10, 20]);

function currentLimit(searchParams: ReturnType<typeof useSearchParams>, fallback: number) {
  const value = Number(searchParams.get("limit"));
  return validLimits.has(value) ? value : fallback;
}

function pageHref(basePath: string, query: string, limit: number, page: number) {
  return `${basePath}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(limit !== 10 ? { limit: String(limit) } : {}), page: String(page) }).toString()}`;
}

export function FilterLimitInput({ fallback }: { fallback: number }) {
  const searchParams = useSearchParams();
  return <input type="hidden" name="limit" value={currentLimit(searchParams, fallback)} />;
}

export default function PaginationControls({ basePath, query, page, total, fallbackLimit }: { basePath: string; query: string; page: number; total: number; fallbackLimit: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const limit = currentLimit(searchParams, fallbackLimit);
  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(page, pages);
  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter((item) => pages <= 7 || item === 1 || item === pages || Math.abs(item - current) <= 1);

  return <footer className="table-pagination">
    <div className="pagination-summary">
      <p>{total ? `Mostrando ${(current - 1) * limit + 1}–${Math.min(current * limit, total)} de ${total} registros` : "Sin registros"}</p>
      <label className="page-size-select">Registros por página<select value={limit} onChange={(event) => router.push(pageHref(basePath, query, Number(event.target.value), 1))}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label>
    </div>
    <nav aria-label="Paginación">
      <Link className={`page-button ${current === 1 ? "disabled" : ""}`} href={current === 1 ? "#" : pageHref(basePath, query, limit, current - 1)} aria-disabled={current === 1}>←</Link>
      {visible.map((item, index) => <span key={item}>{index > 0 && visible[index - 1] !== item - 1 && <i>…</i>}<Link className={`page-button ${item === current ? "active" : ""}`} href={pageHref(basePath, query, limit, item)}>{item}</Link></span>)}
      <Link className={`page-button ${current === pages ? "disabled" : ""}`} href={current === pages ? "#" : pageHref(basePath, query, limit, current + 1)} aria-disabled={current === pages}>→</Link>
    </nav>
  </footer>;
}
