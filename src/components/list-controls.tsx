import Link from "next/link";
import PageSizeSelect from "@/components/page-size-select";

type Props = { basePath: string; query: string; page: number; total: number; limit?: number; placeholder?: string; includePagination?: boolean };
const href = (basePath: string, query: string, limit: number, page: number) => `${basePath}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(limit !== 10 ? { limit: String(limit) } : {}), page: String(page) }).toString()}`;

export default function ListControls({ basePath, query, page, total, limit = 10, placeholder = "Buscar", includePagination = true }: Props) {
  return <><form method="GET" className="list-filter-bar">
    <label><span>Buscar</span><input name="q" defaultValue={query} placeholder={placeholder}/></label>
    <input type="hidden" name="limit" value={limit}/>
    <button className="button small">Aplicar filtros</button>
    {query && <Link className="filter-clear" href={basePath}>Limpiar</Link>}
  </form>{includePagination && <ListPagination basePath={basePath} query={query} page={page} total={total} limit={limit}/>}</>;
}

export function ListPagination({ basePath, query, page, total, limit = 10 }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit)), current = Math.min(page, pages);
  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter((item) => pages <= 7 || item === 1 || item === pages || Math.abs(item - current) <= 1);
  return <footer className="table-pagination"><div className="pagination-summary"><p>{total ? `Mostrando ${(current - 1) * limit + 1}–${Math.min(current * limit, total)} de ${total} registros` : "Sin registros"}</p><PageSizeSelect basePath={basePath} query={query} limit={limit}/></div><nav aria-label="Paginación"><Link className={`page-button ${current === 1 ? "disabled" : ""}`} href={current === 1 ? "#" : href(basePath, query, limit, current - 1)} aria-disabled={current === 1}>←</Link>{visible.map((item, index) => <span key={item}>{index > 0 && visible[index - 1] !== item - 1 && <i>…</i>}<Link className={`page-button ${item === current ? "active" : ""}`} href={href(basePath, query, limit, item)}>{item}</Link></span>)}<Link className={`page-button ${current === pages ? "disabled" : ""}`} href={current === pages ? "#" : href(basePath, query, limit, current + 1)} aria-disabled={current === pages}>→</Link></nav></footer>;
}
