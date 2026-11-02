import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";

const usd = (value: number) => `USD ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanDate = (value: string | string[] | undefined) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; start?: string | string[]; end?: string | string[] }> }) {
  const user=await requireUser("pedidos.ver");
  const pool = await db(), params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const start = cleanDate(params.start), end = cleanDate(params.end);
  const salesFilter = "p.EmpresaId=@company AND p.Estado='confirmado' AND (@start IS NULL OR p.Fecha>=@start) AND (@end IS NULL OR p.Fecha<=@end)";
  const revenue = "CASE WHEN p.MonedaCodigo='VES' AND p.TasaBCV>0 THEN d.Cantidad*d.PrecioUnitario/p.TasaBCV ELSE d.Cantidad*d.PrecioUnitario END";
  const [summary, receivables, products, customers, warehouses] = await Promise.all([
    pool.request().input("company",sql.Int,user.EmpresaId).input("start", sql.Date, start || null).input("end", sql.Date, end || null).query(`
      SELECT ISNULL(SUM(${revenue}),0) Ventas,
        ISNULL((SELECT SUM(a.Cantidad*a.CostoUnitario) FROM importadora.VentaLoteAsignaciones a JOIN importadora.PedidoVentaDetalles d2 ON d2.Id=a.PedidoVentaDetalleId JOIN importadora.PedidosVenta p2 ON p2.Id=d2.PedidoVentaId WHERE p2.EmpresaId=@company AND p2.Estado='confirmado' AND (@start IS NULL OR p2.Fecha>=@start) AND (@end IS NULL OR p2.Fecha<=@end)),0) Costo,
        ISNULL((SELECT SUM(COALESCE(c.MontoUSD,CASE WHEN c.MonedaCodigo='USD' THEN c.Monto ELSE 0 END)) FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p3 ON p3.Id=c.PedidoVentaId WHERE p3.EmpresaId=@company AND c.Estado='activo' AND (@start IS NULL OR c.Fecha>=@start) AND (@end IS NULL OR c.Fecha<=@end)),0) Cobrado
      FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE ${salesFilter}`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).query(`
      WITH Cuentas AS (SELECT p.Id,p.Numero,c.Nombre Cliente,
        CASE WHEN p.MonedaCodigo='VES' AND p.TasaBCV>0 THEN SUM(d.Cantidad*d.PrecioUnitario)/p.TasaBCV ELSE SUM(d.Cantidad*d.PrecioUnitario) END Total,
        ISNULL((SELECT SUM(COALESCE(cp.MontoUSD,CASE WHEN cp.MonedaCodigo='USD' THEN cp.Monto ELSE 0 END)) FROM importadora.CobrosPedido cp WHERE cp.PedidoVentaId=p.Id AND cp.Estado='activo'),0) Cobrado
        FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE p.EmpresaId=@company AND p.Estado='confirmado' GROUP BY p.Id,p.Numero,c.Nombre,p.MonedaCodigo,p.TasaBCV)
      SELECT * FROM Cuentas WHERE Total>Cobrado AND (@query='' OR Numero LIKE '%'+@query+'%' OR Cliente LIKE '%'+@query+'%') ORDER BY Numero DESC`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("start", sql.Date, start || null).input("end", sql.Date, end || null).query(`
      SELECT TOP 12 pr.Codigo,pr.Nombre,SUM(${revenue}) Ventas,ISNULL(SUM(a.Cantidad*a.CostoUnitario),0) Costo
      FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id JOIN importadora.Productos pr ON pr.Id=d.ProductoId
      LEFT JOIN importadora.VentaLoteAsignaciones a ON a.PedidoVentaDetalleId=d.Id WHERE ${salesFilter}
      GROUP BY pr.Codigo,pr.Nombre ORDER BY SUM(${revenue})-ISNULL(SUM(a.Cantidad*a.CostoUnitario),0) DESC`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("start", sql.Date, start || null).input("end", sql.Date, end || null).query(`
      SELECT TOP 8 c.Nombre,SUM(${revenue}) Total FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE ${salesFilter} GROUP BY c.Nombre ORDER BY Total DESC`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("start", sql.Date, start || null).input("end", sql.Date, end || null).query(`
      SELECT ISNULL(a.Nombre,N'Sin almacén asignado') Almacen,SUM(${revenue}) Ventas,ISNULL(SUM(costos.Costo),0) Costo
      FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id
      LEFT JOIN importadora.Almacenes a ON a.Id=p.AlmacenId
      LEFT JOIN (SELECT PedidoVentaDetalleId,SUM(Cantidad*CostoUnitario) Costo FROM importadora.VentaLoteAsignaciones GROUP BY PedidoVentaDetalleId) costos ON costos.PedidoVentaDetalleId=d.Id
      WHERE ${salesFilter} GROUP BY a.Nombre ORDER BY SUM(${revenue}) DESC`),
  ]);
  const data = summary.recordset[0], sales = Number(data.Ventas), cost = Number(data.Costo), paid = Number(data.Cobrado);
  return <><h1>Reportes</h1><p>Indicadores comerciales y financieros expresados en USD.</p>
    <form className="list-filter-bar"><label><span>Buscar cuenta por cobrar</span><input name="q" defaultValue={query} placeholder="Pedido o cliente"/></label><label><span>Desde</span><input name="start" type="date" defaultValue={start}/></label><label><span>Hasta</span><input name="end" type="date" defaultValue={end}/></label><button className="button small">Aplicar período</button>{(query || start || end) && <Link className="filter-clear" href="/panel/reportes">Limpiar</Link>}<Link className="catalog-action" href={`/api/reportes/ventas.csv?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`}>Exportar CSV</Link></form>
    <section className="module-grid"><article className="module-card"><span className="eyebrow">VENTAS</span><h3>{usd(sales)}</h3><p>Ventas confirmadas en el período</p></article><article className="module-card"><span className="eyebrow">UTILIDAD BRUTA</span><h3>{usd(sales-cost)}</h3><p>Costo FIFO: {usd(cost)}</p></article><article className="module-card"><span className="eyebrow">COBRADO</span><h3>{usd(paid)}</h3><p>Ingresos recibidos en el período</p></article></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">RENTABILIDAD</div><h2>Ganancia por producto</h2></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Ventas</th><th>Costo FIFO</th><th>Utilidad</th><th>Margen</th></tr></thead><tbody>{products.recordset.map((product) => { const income=Number(product.Ventas), productCost=Number(product.Costo), profit=income-productCost; return <tr key={product.Codigo}><td>{product.Codigo} · {product.Nombre}</td><td>{usd(income)}</td><td>{usd(productCost)}</td><td>{usd(profit)}</td><td>{income ? `${((profit/income)*100).toFixed(1)}%` : "—"}</td></tr>; })}</tbody></table>{!products.recordset.length && <p className="empty-text">No hay ventas confirmadas en este período.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">ALMACENES</div><h2>Resultado por almacén</h2></div></div><div className="table-wrap"><table><thead><tr><th>Almacén</th><th>Ventas</th><th>Costo FIFO</th><th>Utilidad bruta</th></tr></thead><tbody>{warehouses.recordset.map((warehouse) => { const income=Number(warehouse.Ventas), warehouseCost=Number(warehouse.Costo); return <tr key={warehouse.Almacen}><td>{warehouse.Almacen}</td><td>{usd(income)}</td><td>{usd(warehouseCost)}</td><td>{usd(income-warehouseCost)}</td></tr>; })}</tbody></table>{!warehouses.recordset.length && <p className="empty-text">No hay ventas confirmadas en este período.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">CUENTAS POR COBRAR</div><h2>Pedidos pendientes de cobro</h2></div><Link className="copy-link" href="/panel/pedidos">Gestionar pedidos</Link></div><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total USD</th><th>Cobrado USD</th><th>Pendiente USD</th></tr></thead><tbody>{receivables.recordset.map((item) => <tr key={item.Id}><td><Link className="copy-link" href={`/panel/pedidos/${item.Id}`}>{item.Numero}</Link></td><td>{item.Cliente}</td><td>{usd(Number(item.Total))}</td><td>{usd(Number(item.Cobrado))}</td><td>{usd(Number(item.Total)-Number(item.Cobrado))}</td></tr>)}</tbody></table>{!receivables.recordset.length && <p className="empty-text">No hay cobros pendientes que coincidan con el filtro.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">CLIENTES</div><h2>Ventas por cliente</h2></div></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Ventas confirmadas</th></tr></thead><tbody>{customers.recordset.map((customer) => <tr key={customer.Nombre}><td>{customer.Nombre}</td><td>{usd(Number(customer.Total))}</td></tr>)}</tbody></table>{!customers.recordset.length && <p className="empty-text">Los resultados aparecerán al confirmar ventas.</p>}</div></section>
  </>;
}
