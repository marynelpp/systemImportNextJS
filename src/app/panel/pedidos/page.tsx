import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";
import { SaleOrderForm } from "@/components/sale-forms";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user = await requireUser("pedidos.ver");
  const pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);
  const [clients, currencies, warehouses, countResult, ordersResult] = await Promise.all([
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT Id,Nombre FROM importadora.Clientes WHERE EmpresaId=@company AND Activo=1 ORDER BY Nombre"),
    pool.request().query("SELECT Codigo FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT Id,Nombre FROM importadora.Almacenes WHERE EmpresaId=@company AND Activo=1 ORDER BY Nombre"),
    pool.request().input("company", sql.Int, user.EmpresaId).input("query", sql.NVarChar(100), query).query("SELECT COUNT(*) AS Total FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId WHERE o.EmpresaId=@company AND (@query='' OR o.Numero LIKE '%'+@query+'%' OR c.Nombre LIKE '%'+@query+'%' OR o.Estado LIKE '%'+@query+'%')"),
    pool.request().input("company", sql.Int, user.EmpresaId).input("query", sql.NVarChar(100), query).input("offset", sql.Int, offset).input("limit", sql.Int, limit).query("SELECT o.Id,o.Numero,o.Fecha,o.Estado,o.MonedaCodigo,c.Nombre Cliente FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId WHERE o.EmpresaId=@company AND (@query='' OR o.Numero LIKE '%'+@query+'%' OR c.Nombre LIKE '%'+@query+'%' OR o.Estado LIKE '%'+@query+'%') ORDER BY o.Id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY"),
  ]);
  const total = countResult.recordset[0].Total as number;

  return <>
    <h1>Pedidos y ventas</h1>
    <p>Crea el pedido, agrega productos disponibles y confírmalo para descontar inventario.</p>
    {can(user, "pedidos.administrar") && <section className="settings-section"><div><div className="eyebrow">NUEVO PEDIDO</div><h2>Venta a cliente</h2><p>El inventario se descuenta solo al confirmar, desde el almacén seleccionado.</p></div><SaleOrderForm clients={clients.recordset} currencies={currencies.recordset} warehouses={warehouses.recordset} /></section>}
    <section className="empty-card inventory-section">
      <h2>Pedidos registrados</h2>
      <ListControls basePath="/panel/pedidos" query={query} page={page} total={total} limit={limit} includePagination={false} placeholder="Buscar número, cliente o estado" />
      <div className="table-wrap table-wrap-paginated"><table><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Moneda</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{ordersResult.recordset.map((order) => <tr key={order.Id}><td>{order.Numero}</td><td>{order.Cliente}</td><td>{formatVenezuelanDate(order.Fecha)}</td><td>{order.MonedaCodigo}</td><td><span className="badge">{order.Estado}</span></td><td><Link className="copy-link" href={`/panel/pedidos/${order.Id}`}>Ver / gestionar</Link></td></tr>)}</tbody></table>{!ordersResult.recordset.length && <p className="empty-text">No hay pedidos que coincidan con el filtro.</p>}<ListPagination basePath="/panel/pedidos" query={query} page={page} total={total} limit={limit} /></div>
    </section>
  </>;
}
