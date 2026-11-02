import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";

const rotationQuery = `
  WITH Rotacion AS (
    SELECT p.Codigo, p.Nombre, ISNULL(a.Nombre, N'Sin almacén asignado') AS Almacen, SUM(d.Cantidad) AS Unidades,
      SUM(d.Cantidad * d.PrecioUnitario) AS Ingreso,
      SUM(ISNULL(costos.Costo, 0)) AS Costo
    FROM importadora.PedidoVentaDetalles d
    JOIN importadora.PedidosVenta v ON v.Id = d.PedidoVentaId
    JOIN importadora.Productos p ON p.Id = d.ProductoId
    LEFT JOIN importadora.Almacenes a ON a.Id = v.AlmacenId
    LEFT JOIN (
      SELECT PedidoVentaDetalleId, SUM(Cantidad * CostoUnitario) AS Costo
      FROM importadora.VentaLoteAsignaciones
      GROUP BY PedidoVentaDetalleId
    ) costos ON costos.PedidoVentaDetalleId = d.Id
    WHERE v.EmpresaId=@company AND v.Estado = 'confirmado' AND v.MonedaCodigo = 'USD'
    GROUP BY p.Codigo, p.Nombre, a.Nombre
  )
`;

export default async function RotationPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user=await requireUser("pedidos.ver");
  const { query, page, limit, offset } = listingParams(await searchParams);
  const pool = await db();
  const filter = "WHERE @query='' OR Codigo LIKE '%'+@query+'%' OR Nombre LIKE '%'+@query+'%' OR Almacen LIKE '%'+@query+'%'";
  const [countResult, rowsResult] = await Promise.all([
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).query(`${rotationQuery} SELECT COUNT(*) AS Total FROM Rotacion ${filter}`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).input("offset", sql.Int, offset).input("limit", sql.Int, limit).query(`${rotationQuery} SELECT * FROM Rotacion ${filter} ORDER BY Unidades DESC, Ingreso DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`),
  ]);
  const total = countResult.recordset[0].Total as number;

  return <>
    <h1>Rotación y ganancia</h1>
    <p>Ventas confirmadas, costo FIFO y margen bruto por producto y almacén.</p>
    <section className="empty-card inventory-section">
      <ListControls basePath="/panel/rotacion" query={query} page={page} total={total} limit={limit} includePagination={false} placeholder="Buscar producto o almacén" />
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Almacén</th><th>Unidades</th><th>Ingresos</th><th>Costo</th><th>Ganancia bruta</th><th>Margen</th></tr></thead><tbody>{rowsResult.recordset.map((item) => { const income = Number(item.Ingreso), cost = Number(item.Costo), profit = income - cost, margin = income ? profit / income * 100 : 0; return <tr key={`${item.Codigo}-${item.Almacen}`}><td>{item.Codigo} · {item.Nombre}</td><td>{item.Almacen}</td><td>{Number(item.Unidades).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>USD {income.toFixed(2)}</td><td>USD {cost.toFixed(2)}</td><td>USD {profit.toFixed(2)}</td><td>{margin.toFixed(2)}%</td></tr>; })}</tbody></table>{!rowsResult.recordset.length && <p className="empty-text">No hay productos vendidos que coincidan con el filtro.</p>}<ListPagination basePath="/panel/rotacion" query={query} page={page} total={total} limit={limit} /></div>
    </section>
  </>;
}
