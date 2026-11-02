import Link from "next/link";
import PaginationControls, { FilterLimitInput } from "@/components/pagination-controls";

type Props = { basePath: string; query: string; page: number; total: number; limit?: number; placeholder?: string; includePagination?: boolean };
const href = (basePath: string, query: string, limit: number, page: number) => `${basePath}?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(limit !== 10 ? { limit: String(limit) } : {}), page: String(page) }).toString()}`;

export default function ListControls({ basePath, query, page, total, limit = 10, placeholder = "Buscar", includePagination = true }: Props) {
  return <><form method="GET" className="list-filter-bar">
    <label><span>Buscar</span><input name="q" defaultValue={query} placeholder={placeholder}/></label>
    <FilterLimitInput fallback={limit}/>
    <button className="button small">Aplicar filtros</button>
    {query && <Link className="filter-clear" href={basePath}>Limpiar</Link>}
  </form>{includePagination && <ListPagination basePath={basePath} query={query} page={page} total={total} limit={limit}/>}</>;
}

export function ListPagination({ basePath, query, page, total, limit = 10 }: Props) {
  return <PaginationControls basePath={basePath} query={query} page={page} total={total} fallbackLimit={limit}/>;
}
