import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { venezuelanToday } from "@/lib/dates";
import { db, sql } from "@/lib/db";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ acceso?: string }> }) {
  const user = await requireUser(), params = await searchParams, pool = await db();
  const [summary, imports, orders] = await Promise.all([
    pool.request().input("today", sql.Date, venezuelanToday()).query(`SELECT (SELECT COUNT(*) FROM importadora.Productos WHERE Activo=1) Productos,(SELECT ISNULL(SUM(CantidadDisponible),0) FROM importadora.InventarioLotes) Stock,(SELECT COUNT(*) FROM importadora.Importaciones WHERE Estado IN('preparacion','en_transito','aduana')) Importaciones,(SELECT ISNULL(SUM(d.Cantidad*d.PrecioUnitario),0) FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE p.Estado='confirmado' AND p.Fecha=@today) Ventas`),
    pool.request().query("SELECT TOP 4 i.Codigo,i.Estado,pr.Nombre Proveedor FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE i.Estado IN('preparacion','en_transito','aduana') ORDER BY i.Id DESC"),
    pool.request().query("SELECT TOP 4 p.Numero,p.Estado,c.Nombre Cliente FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId ORDER BY p.Id DESC"),
  ]);
  const data=summary.recordset[0], n=(x:number)=>Number(x).toLocaleString("es-VE",{maximumFractionDigits:2});
  const metrics=[["Productos activos",n(data.Productos),"/panel/productos"],["Unidades disponibles",n(data.Stock),"/panel/inventario"],["Importaciones activas",n(data.Importaciones),"/panel/importaciones"],["Ventas de hoy",`USD ${n(data.Ventas)}`,"/panel/pedidos"]];
  return <><h1>Hola, {user.Nombre.split(" ")[0]}.</h1><p>Resumen operativo de tu importadora.</p>{params.acceso&&<p className="form-message error">Tu rol no tiene permiso para acceder a esa función.</p>}<section className="module-grid">{metrics.map(([label,value,href])=><Link key={label} className="module-card" href={href}><span className="eyebrow">OPERACIÓN</span><h3>{value}</h3><p>{label}</p></Link>)}</section><div className="dashboard-columns"><section className="empty-card"><h2>Importaciones activas</h2>{imports.recordset.map(x=><p key={x.Codigo}><strong>{x.Codigo}</strong> · {x.Proveedor} <span className="badge">{x.Estado}</span></p>)}{!imports.recordset.length&&<p className="empty-text">No hay importaciones pendientes.</p>}<Link className="copy-link" href="/panel/importaciones">Ver importaciones</Link></section><section className="empty-card"><h2>Pedidos recientes</h2>{orders.recordset.map(x=><p key={x.Numero}><strong>{x.Numero}</strong> · {x.Cliente} <span className="badge">{x.Estado}</span></p>)}{!orders.recordset.length&&<p className="empty-text">Aún no hay pedidos registrados.</p>}<Link className="copy-link" href="/panel/pedidos">Ver pedidos</Link></section></div></>;
}
