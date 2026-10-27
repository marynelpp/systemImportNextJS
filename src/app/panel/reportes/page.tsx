import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const usd = (value: number) => `USD ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ReportsPage() {
  await requireUser("pedidos.ver");
  const pool = await db();
  const [summary, receivables, customers] = await Promise.all([
    pool.request().query(`
      SELECT ISNULL(SUM(d.Cantidad*d.PrecioUnitario),0) Ventas,
        ISNULL((SELECT SUM(a.Cantidad*a.CostoUnitario) FROM importadora.VentaLoteAsignaciones a JOIN importadora.PedidoVentaDetalles d2 ON d2.Id=a.PedidoVentaDetalleId JOIN importadora.PedidosVenta p2 ON p2.Id=d2.PedidoVentaId WHERE p2.Estado='confirmado'),0) Costo,
        ISNULL((SELECT SUM(Monto) FROM importadora.CobrosPedido WHERE MonedaCodigo='USD'),0) Cobrado
      FROM importadora.PedidosVenta p JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE p.Estado='confirmado' AND p.MonedaCodigo='USD'`),
    pool.request().query(`
      SELECT p.Id,p.Numero,p.Fecha,c.Nombre Cliente,SUM(d.Cantidad*d.PrecioUnitario) Total,
        ISNULL((SELECT SUM(Monto) FROM importadora.CobrosPedido cp WHERE cp.PedidoVentaId=p.Id AND cp.MonedaCodigo=p.MonedaCodigo),0) Cobrado
      FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id
      WHERE p.Estado='confirmado' AND p.MonedaCodigo='USD'
      GROUP BY p.Id,p.Numero,p.Fecha,c.Nombre,p.MonedaCodigo ORDER BY p.Fecha DESC`),
    pool.request().query(`
      SELECT TOP 8 c.Nombre,SUM(d.Cantidad*d.PrecioUnitario) Total
      FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id
      WHERE p.Estado='confirmado' AND p.MonedaCodigo='USD' GROUP BY c.Nombre ORDER BY Total DESC`),
  ]);
  const data = summary.recordset[0], sales = Number(data.Ventas), cost = Number(data.Costo), paid = Number(data.Cobrado);
  return <><h1>Reportes</h1><p>Resumen comercial en USD basado en ventas confirmadas, costos FIFO y cobros registrados.</p>
    <section className="module-grid"><article className="module-card"><span className="eyebrow">VENTAS</span><h3>{usd(sales)}</h3><p>Ventas confirmadas</p></article><article className="module-card"><span className="eyebrow">MARGEN BRUTO</span><h3>{usd(sales-cost)}</h3><p>Costo de lote: {usd(cost)}</p></article><article className="module-card"><span className="eyebrow">COBRADO</span><h3>{usd(paid)}</h3><p>Saldo por cobrar: {usd(Math.max(0,sales-paid))}</p></article></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">CUENTAS POR COBRAR</div><h2>Pedidos pendientes de cobro</h2></div><Link className="copy-link" href="/panel/pedidos">Gestionar pedidos</Link></div><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Cobrado</th><th>Pendiente</th></tr></thead><tbody>{receivables.recordset.filter((item) => Number(item.Total)>Number(item.Cobrado)).map((item) => <tr key={item.Id}><td><Link className="copy-link" href={`/panel/pedidos/${item.Id}`}>{item.Numero}</Link></td><td>{item.Cliente}</td><td>{usd(Number(item.Total))}</td><td>{usd(Number(item.Cobrado))}</td><td>{usd(Number(item.Total)-Number(item.Cobrado))}</td></tr>)}</tbody></table>{!receivables.recordset.some((item) => Number(item.Total)>Number(item.Cobrado)) && <p className="empty-text">No hay cobros pendientes.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">CLIENTES</div><h2>Ventas por cliente</h2></div></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Ventas confirmadas</th></tr></thead><tbody>{customers.recordset.map((customer) => <tr key={customer.Nombre}><td>{customer.Nombre}</td><td>{usd(Number(customer.Total))}</td></tr>)}</tbody></table>{!customers.recordset.length && <p className="empty-text">Los resultados aparecerán al confirmar ventas.</p>}</div></section>
  </>;
}
