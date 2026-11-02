import Link from "next/link";
import { cancelSaleOrder, confirmSaleOrder, confirmUsdSaleOrder, deleteSaleLine } from "@/app/actions/ventas";
import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { SaleLineForm } from "@/components/sale-forms";
import { DraftBcvRate } from "@/components/draft-bcv-rate";
import PaymentForm from "@/components/payment-form";
import PaymentActions from "@/components/payment-actions";
import { formatVenezuelanDate } from "@/lib/dates";

const number = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("pedidos.ver");
  const id = Number((await params).id), pool = await db();
  const [header, lines, products, currencies, payments, delivery, attachments] = await Promise.all([
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT o.*,c.Nombre Cliente,a.Nombre Almacen FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId LEFT JOIN importadora.Almacenes a ON a.Id=o.AlmacenId WHERE o.Id=@id AND o.EmpresaId=@company"),
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT d.*,p.Codigo,p.Nombre Producto FROM importadora.PedidoVentaDetalles d JOIN importadora.PedidosVenta o ON o.Id=d.PedidoVentaId JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE d.PedidoVentaId=@id AND o.EmpresaId=@company ORDER BY d.Id"),
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT p.Id,p.Codigo,p.Nombre,p.PrecioDetalUSD,p.PrecioMayorUSD,SUM(l.CantidadDisponible) Existencia FROM importadora.Productos p JOIN importadora.InventarioLotes l ON l.ProductoId=p.Id JOIN importadora.PedidosVenta o ON o.Id=@id WHERE o.EmpresaId=@company AND p.EmpresaId=@company AND p.Activo=1 AND l.CantidadDisponible>0 AND (o.AlmacenId IS NULL OR l.AlmacenId=o.AlmacenId) GROUP BY p.Id,p.Codigo,p.Nombre,p.PrecioDetalUSD,p.PrecioMayorUSD ORDER BY p.Nombre"),
    pool.request().query("SELECT Codigo FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT c.Id,c.Fecha,c.Monto,c.MonedaCodigo,c.MontoUSD,c.TasaBCV,c.Estado,c.Metodo,c.Referencia FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta o ON o.Id=c.PedidoVentaId WHERE c.PedidoVentaId=@id AND o.EmpresaId=@company ORDER BY c.Fecha DESC,c.Id DESC"),
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT e.Id FROM importadora.EntregasPedido e JOIN importadora.PedidosVenta o ON o.Id=e.PedidoVentaId WHERE e.PedidoVentaId=@id AND o.EmpresaId=@company"),
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT a.Id,a.CobroPedidoId,a.NombreOriginal FROM importadora.CobroAdjuntos a JOIN importadora.CobrosPedido c ON c.Id=a.CobroPedidoId JOIN importadora.PedidosVenta o ON o.Id=c.PedidoVentaId WHERE c.PedidoVentaId=@id AND o.EmpresaId=@company ORDER BY a.Id DESC")
  ]);
  const order = header.recordset[0];
  if (!order) return <p>Pedido no encontrado.</p>;
  const total = lines.recordset.reduce((sum, line) => sum + Number(line.Cantidad) * Number(line.PrecioUnitario), 0);
  const paid = payments.recordset.filter((payment) => payment.Estado !== "revertido").reduce((sum, payment) => sum + Number(payment.MontoUSD ?? (payment.MonedaCodigo === "USD" ? payment.Monto : 0)), 0);
  const legacyVesRate = order.MonedaCodigo === "VES" ? Number(order.TasaBCV) : 0;
  const totalUsd = legacyVesRate > 0 ? total / legacyVesRate : total;
  const paymentStatus = paid <= 0 ? "pendiente" : paid + 0.005 >= totalUsd ? "pagado" : "abonado";
  const canManageOrders = can(user, "pedidos.administrar"), canManagePayments = can(user, "cobros.administrar");

  return <>
    <Link className="copy-link" href="/panel/pedidos">← Volver a pedidos</Link>
    <h1>{order.Numero}</h1>
    <p>{order.Cliente} · <span className="badge">{order.Estado}</span> · <span className="badge">{paymentStatus}</span> · {order.MonedaCodigo} · Precio {order.TipoPrecio === "mayor" ? "mayor" : "detal"}{order.Almacen ? ` · Almacén: ${order.Almacen}` : ""}{order.MonedaCodigo === "VES" && order.TasaBCV ? ` · Tasa BCV: Bs. ${number(Number(order.TasaBCV))} · Equivalente: USD ${number(totalUsd)}` : ""}</p>
    {order.Estado === "borrador" && order.MonedaCodigo === "USD" && can(user, "pedidos.administrar") && <DraftBcvRate order={id} rate={order.TasaBCV ? Number(order.TasaBCV) : undefined} />}
    {order.Estado === "confirmado" && <Link className="button small" href={`/panel/pedidos/${id}/entrega`}>{delivery.recordset[0] ? "Ver entrega" : "Registrar entrega"}</Link>}
    {order.Estado === "confirmado" && <Link className="button secondary small" href={`/panel/pedidos/${id}/recibo`}>Ver comprobante de venta</Link>}
    {order.Estado === "borrador" && canManageOrders && <form action={order.MonedaCodigo === "USD" ? confirmUsdSaleOrder : confirmSaleOrder}><input type="hidden" name="id" value={id}/><button className="button">Confirmar venta y descontar inventario</button></form>}
    {order.Estado === "confirmado" && !payments.recordset.length && canManageOrders && <form action={cancelSaleOrder}><input type="hidden" name="id" value={id}/><button className="catalog-action danger">Cancelar venta y devolver inventario</button></form>}

    <section className="empty-card inventory-section">
      <div className="section-heading"><h2>Productos del pedido</h2><strong>{order.MonedaCodigo} {number(total)}{legacyVesRate > 0 && <small className="usd-equivalent">Equivale a USD {number(totalUsd)}</small>}</strong></div>
      {order.Estado === "borrador" && canManageOrders && <SaleLineForm order={id} products={products.recordset} priceType={order.TipoPrecio === "mayor" ? "mayor" : "detal"} canChangePriceType={!lines.recordset.length} currency={order.MonedaCodigo} bcvRate={order.TasaBCV ? Number(order.TasaBCV) : undefined}/>} 
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th>{order.Estado === "borrador" && canManageOrders && <th aria-label="Acciones"/>}</tr></thead><tbody>{lines.recordset.map((line) => <tr key={line.Id}><td>{line.Codigo} · {line.Producto}</td><td>{number(Number(line.Cantidad))}</td><td>{order.MonedaCodigo} {number(Number(line.PrecioUnitario))}{legacyVesRate > 0 && <small className="usd-equivalent">USD {number(Number(line.PrecioUnitario) / legacyVesRate)}</small>}</td><td>{order.MonedaCodigo} {number(Number(line.Cantidad) * Number(line.PrecioUnitario))}{legacyVesRate > 0 && <small className="usd-equivalent">USD {number(Number(line.Cantidad) * Number(line.PrecioUnitario) / legacyVesRate)}</small>}</td>{order.Estado === "borrador" && canManageOrders && <td><form action={deleteSaleLine}><input type="hidden" name="id" value={line.Id}/><input type="hidden" name="order" value={id}/><button className="catalog-action danger">Eliminar</button></form></td>}</tr>)}</tbody></table><p className="order-total">Total: {order.MonedaCodigo} {number(total)}{legacyVesRate > 0 && <> · Equivalente USD {number(totalUsd)}</>}</p></div>
    </section>

    {order.Estado === "confirmado" && <section className="empty-card import-expenses">
      <h2>Pagos recibidos</h2>
      <p>Registrado: USD {number(paid)} · Pendiente: USD {number(Math.max(0, totalUsd - paid))}{legacyVesRate > 0 && <> · Pendiente en Bs.: {number(Math.max(0, totalUsd - paid) * legacyVesRate)}</>}</p>
      {canManagePayments && order.TasaBCV && <PaymentForm order={id} rate={Number(order.TasaBCV)}/>} 
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Monto recibido</th><th>Equivalente USD</th><th>Estado</th><th>Método</th><th>Referencia</th><th>Comprobantes</th><th>Acciones</th></tr></thead><tbody>{payments.recordset.map((payment) => {
        const proofs = attachments.recordset.filter((attachment) => Number(attachment.CobroPedidoId) === Number(payment.Id));
        return <tr key={payment.Id}><td>{formatVenezuelanDate(payment.Fecha)}</td><td>{payment.MonedaCodigo === "VES" ? "Bs." : "USD"} {number(Number(payment.Monto))}</td><td>USD {payment.MontoUSD === null || payment.MontoUSD === undefined ? "—" : number(Number(payment.MontoUSD))}</td><td><span className="badge">{payment.Estado}</span></td><td>{payment.Metodo.replace("_", " ")}</td><td>{payment.Referencia ?? "—"}</td><td>{proofs.length ? `${proofs.length} archivo(s)` : "—"}</td><td>{canManagePayments && payment.Estado !== "revertido" && <PaymentActions payment={{ ...payment, Monto: Number(payment.Monto) }} order={id} attachments={proofs}/>}</td></tr>;
      })}</tbody></table>{!payments.recordset.length && <p className="empty-text">Aún no hay pagos registrados.</p>}</div>
    </section>}
  </>;
}
