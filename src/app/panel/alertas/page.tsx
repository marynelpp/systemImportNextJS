import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";

const alertsQuery = `
  WITH Alertas AS (
    SELECT p.Id, p.Codigo, p.Nombre, a.Nombre Almacen, ISNULL(SUM(l.CantidadDisponible), 0) AS Existencia,
      m.CantidadMinima, pp.ProveedorId, pr.Nombre AS Proveedor
    FROM importadora.ProductoAlmacenMinimos m
    JOIN importadora.Productos p ON p.Id=m.ProductoId
    JOIN importadora.Almacenes a ON a.Id=m.AlmacenId
    LEFT JOIN importadora.InventarioLotes l ON l.ProductoId=p.Id AND l.AlmacenId=a.Id
    LEFT JOIN importadora.ProductoProveedores pp ON pp.ProductoId = p.Id AND pp.EsPrincipal = 1
    LEFT JOIN importadora.Proveedores pr ON pr.Id = pp.ProveedorId
    WHERE p.EmpresaId=@company AND p.Activo = 1 AND a.Activo=1
    GROUP BY p.Id, p.Codigo, p.Nombre, a.Nombre, m.CantidadMinima, pp.ProveedorId, pr.Nombre
    HAVING ISNULL(SUM(l.CantidadDisponible), 0) <= m.CantidadMinima
  )
`;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user=await requireUser("inventario.ver");
  const { query, page, limit, offset } = listingParams(await searchParams);
  const pool = await db();
  const filter = "WHERE @query='' OR Codigo LIKE '%'+@query+'%' OR Nombre LIKE '%'+@query+'%' OR Almacen LIKE '%'+@query+'%' OR Proveedor LIKE '%'+@query+'%'";
  const [countResult, alertsResult] = await Promise.all([
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).query(`${alertsQuery} SELECT COUNT(*) AS Total FROM Alertas ${filter}`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).input("offset", sql.Int, offset).input("limit", sql.Int, limit).query(`${alertsQuery} SELECT * FROM Alertas ${filter} ORDER BY Existencia, Nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`),
  ]);
  const total = countResult.recordset[0].Total as number;

  return <>
    <h1>Alertas de inventario</h1>
    <p>Productos sin existencia o por debajo del mínimo configurado en cada almacén.</p>
    <section className="empty-card inventory-section">
      <div className="section-heading"><div><div className="eyebrow">REPOSICIÓN</div><h2>Productos que requieren atención</h2></div></div>
      <ListControls basePath="/panel/alertas" query={query} page={page} total={total} limit={limit} includePagination={false} placeholder="Buscar producto, almacén o proveedor" />
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Almacén</th><th>Disponible</th><th>Mínimo</th><th>Proveedor sugerido</th><th>Acciones</th></tr></thead><tbody>{alertsResult.recordset.map((item) => <tr key={`${item.Id}-${item.Almacen}`}><td>{item.Codigo} · {item.Nombre}</td><td>{item.Almacen}</td><td>{Number(item.Existencia).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{Number(item.CantidadMinima).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{item.Proveedor ?? "Sin proveedor principal"}</td><td><Link className="copy-link" href={`/panel/productos/${item.Id}`}>Ver producto</Link>{item.ProveedorId && <Link className="catalog-action" href={`/panel/compras?proveedor=${item.ProveedorId}&producto=${item.Id}`}>Crear compra</Link>}</td></tr>)}</tbody></table>{!alertsResult.recordset.length && <p className="empty-text">No hay alertas; configura los mínimos por almacén en Inventario.</p>}<ListPagination basePath="/panel/alertas" query={query} page={page} total={total} limit={limit} /></div>
    </section>
  </>;
}
