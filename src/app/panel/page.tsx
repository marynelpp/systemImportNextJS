import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { venezuelanToday } from "@/lib/dates";
import { db, sql } from "@/lib/db";

const usd = (value: number) => `USD ${Number(value).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ acceso?: string }> }) {
  const user = await requireUser(), params = await searchParams, pool = await db();
  const [summary, imports, orders, alerts] = await Promise.all([
    pool.request().input("company",sql.Int,user.EmpresaId).input("today", sql.Date, venezuelanToday()).query(`
      SELECT
        (SELECT COUNT(*) FROM importadora.Productos WHERE EmpresaId=@company AND Activo=1) Productos,
        (SELECT ISNULL(SUM(l.CantidadDisponible),0) FROM importadora.InventarioLotes l JOIN importadora.Productos p ON p.Id=l.ProductoId WHERE p.EmpresaId=@company) Stock,
        (SELECT COUNT(*) FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId WHERE o.EmpresaId=@company AND i.Estado IN('preparacion','en_transito','aduana')) Importaciones,
        (SELECT ISNULL(SUM(CASE WHEN p.MonedaCodigo='VES' AND p.TasaBCV>0 THEN d.Cantidad*d.PrecioUnitario/p.TasaBCV ELSE d.Cantidad*d.PrecioUnitario END),0) FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE p.EmpresaId=@company AND p.Estado='confirmado' AND p.Fecha=@today) Ventas,
        (SELECT ISNULL(SUM(a.Cantidad*a.CostoUnitario),0) FROM importadora.VentaLoteAsignaciones a JOIN importadora.PedidoVentaDetalles d ON d.Id=a.PedidoVentaDetalleId JOIN importadora.PedidosVenta p ON p.Id=d.PedidoVentaId WHERE p.EmpresaId=@company AND p.Estado='confirmado' AND p.Fecha=@today) Costo,
        (SELECT ISNULL(SUM(COALESCE(c.MontoUSD,CASE WHEN c.MonedaCodigo='USD' THEN c.Monto ELSE 0 END)),0) FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE p.EmpresaId=@company AND c.Estado='activo' AND c.Fecha=@today) Cobrado`),
    pool.request().input("company",sql.Int,user.EmpresaId).query("SELECT TOP 4 i.Codigo,i.Estado,pr.Nombre Proveedor FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE o.EmpresaId=@company AND i.Estado IN('preparacion','en_transito','aduana') ORDER BY i.Id DESC"),
    pool.request().input("company",sql.Int,user.EmpresaId).query("SELECT TOP 4 p.Numero,p.Estado,c.Nombre Cliente FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId WHERE p.EmpresaId=@company ORDER BY p.Id DESC"),
    pool.request().input("company",sql.Int,user.EmpresaId).query("SELECT TOP 4 p.Id,p.Codigo,p.Nombre,ISNULL(SUM(l.CantidadDisponible),0) Existencia FROM importadora.Productos p LEFT JOIN importadora.InventarioLotes l ON l.ProductoId=p.Id LEFT JOIN importadora.ProductoProveedores pp ON pp.ProductoId=p.Id AND pp.EsPrincipal=1 WHERE p.EmpresaId=@company AND p.Activo=1 GROUP BY p.Id,p.Codigo,p.Nombre,pp.CantidadMinima HAVING ISNULL(SUM(l.CantidadDisponible),0)<=ISNULL(pp.CantidadMinima,0) ORDER BY Existencia,p.Nombre"),
  ]);
  const data = summary.recordset[0], n = (value: number) => Number(value).toLocaleString("es-VE", { maximumFractionDigits: 2 });
  const metrics = [
    ["Ventas de hoy", usd(data.Ventas), "/panel/reportes"],
    ["Utilidad bruta hoy", usd(Number(data.Ventas)-Number(data.Costo)), "/panel/reportes"],
    ["Cobrado hoy", usd(data.Cobrado), "/panel/caja"],
    ["Productos activos", n(data.Productos), "/panel/productos"],
    ["Unidades disponibles", n(data.Stock), "/panel/inventario"],
    ["Importaciones activas", n(data.Importaciones), "/panel/importaciones"],
  ];
  return <><h1>Hola, {user.Nombre.split(" ")[0]}.</h1><p>Resumen operativo y financiero de tu importadora en USD.</p>{params.acceso && <p className="form-message error">Tu rol no tiene permiso para acceder a esa función.</p>}<section className="module-grid">{metrics.map(([label, value, href]) => <Link key={label} className="module-card" href={href}><span className="eyebrow">HOY</span><h3>{value}</h3><p>{label}</p></Link>)}</section><div className="dashboard-columns"><section className="empty-card"><h2>Importaciones activas</h2>{imports.recordset.map((item) => <p key={item.Codigo}><strong>{item.Codigo}</strong> · {item.Proveedor} <span className="badge">{item.Estado}</span></p>)}{!imports.recordset.length && <p className="empty-text">No hay importaciones pendientes.</p>}<Link className="copy-link" href="/panel/importaciones">Ver importaciones</Link></section><section className="empty-card"><h2>Inventario que requiere atención</h2>{alerts.recordset.map((item) => <p key={item.Id}><strong>{item.Codigo}</strong> · {item.Nombre} <span className="badge">{n(item.Existencia)} disponibles</span></p>)}{!alerts.recordset.length && <p className="empty-text">No hay alertas de inventario.</p>}<Link className="copy-link" href="/panel/alertas">Ver alertas</Link></section><section className="empty-card"><h2>Pedidos recientes</h2>{orders.recordset.map((item) => <p key={item.Numero}><strong>{item.Numero}</strong> · {item.Cliente} <span className="badge">{item.Estado}</span></p>)}{!orders.recordset.length && <p className="empty-text">Aún no hay pedidos registrados.</p>}<Link className="copy-link" href="/panel/pedidos">Ver pedidos</Link></section></div></>;
}
