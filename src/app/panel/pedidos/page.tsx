import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { listingParams, PAGE_SIZE } from "@/lib/listing";
import ListControls from "@/components/list-controls";
import { SaleOrderForm } from "@/components/sale-forms";

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const user=await requireUser("pedidos.ver"),pool=await db(),{query,page}=listingParams(await searchParams);
  const [clients,currencies,count]=await Promise.all([pool.request().query("SELECT Id,Nombre FROM importadora.Clientes WHERE Activo=1 ORDER BY Nombre"),pool.request().query("SELECT Codigo FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),pool.request().input("q",sql.NVarChar(100),query).query("SELECT COUNT(*) Total FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId WHERE @q='' OR o.Numero LIKE '%'+@q+'%' OR c.Nombre LIKE '%'+@q+'%' OR o.Estado LIKE '%'+@q+'%'")]);
  const total=count.recordset[0].Total,activePage=Math.min(page,Math.max(1,Math.ceil(total/PAGE_SIZE)));
  const orders=await pool.request().input("q",sql.NVarChar(100),query).input("offset",sql.Int,(activePage-1)*PAGE_SIZE).input("take",sql.Int,PAGE_SIZE).query("SELECT o.Id,o.Numero,o.Fecha,o.Estado,o.MonedaCodigo,c.Nombre Cliente FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId WHERE @q='' OR o.Numero LIKE '%'+@q+'%' OR c.Nombre LIKE '%'+@q+'%' OR o.Estado LIKE '%'+@q+'%' ORDER BY o.Id DESC OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY");
  return <><h1>Pedidos y ventas</h1><p>Crea el pedido, agrega productos disponibles y confírmalo para descontar inventario.</p>{can(user,"pedidos.administrar")&&<section className="settings-section"><div><div className="eyebrow">NUEVO PEDIDO</div><h2>Venta a cliente</h2><p>El inventario se descuenta solo al confirmar.</p></div><SaleOrderForm clients={clients.recordset} currencies={currencies.recordset}/></section>}<section className="empty-card inventory-section"><h2>Pedidos registrados</h2><ListControls basePath="/panel/pedidos" query={query} page={activePage} total={total} placeholder="Buscar número, cliente o estado"/><div className="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Moneda</th><th>Estado</th><th></th></tr></thead><tbody>{orders.recordset.map((order)=><tr key={order.Id}><td>{order.Numero}</td><td>{order.Cliente}</td><td>{formatVenezuelanDate(order.Fecha)}</td><td>{order.MonedaCodigo}</td><td><span className="badge">{order.Estado}</span></td><td><Link className="copy-link" href={`/panel/pedidos/${order.Id}`}>Ver / gestionar</Link></td></tr>)}</tbody></table>{!orders.recordset.length&&<p className="empty-text">No hay pedidos que coincidan con el filtro.</p>}</div></section></>;
}
