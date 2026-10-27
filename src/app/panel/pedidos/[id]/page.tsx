import Link from "next/link";
import { cancelSaleOrder, confirmSaleOrder } from "@/app/actions/ventas";
import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { SaleLineForm } from "@/components/sale-forms";
import PaymentForm from "@/components/payment-form";
import PaymentActions from "@/components/payment-actions";
import { formatVenezuelanDate } from "@/lib/dates";

const number = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("pedidos.ver");
  const id = Number((await params).id), pool = await db();
  const [header, lines, products, currencies, payments, delivery, attachments] = await Promise.all([
    pool.request().input("id", sql.Int, id).query("SELECT o.*,c.Nombre Cliente FROM importadora.PedidosVenta o JOIN importadora.Clientes c ON c.Id=o.ClienteId WHERE o.Id=@id"),
    pool.request().input("id", sql.Int, id).query("SELECT d.*,p.Codigo,p.Nombre Producto FROM importadora.PedidoVentaDetalles d JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE d.PedidoVentaId=@id ORDER BY d.Id"),
    pool.request().query("SELECT p.Id,p.Codigo,p.Nombre,p.PrecioDetalUSD,SUM(l.CantidadDisponible) Existencia FROM importadora.Productos p JOIN importadora.InventarioLotes l ON l.ProductoId=p.Id WHERE p.Activo=1 AND l.CantidadDisponible>0 GROUP BY p.Id,p.Codigo,p.Nombre,p.PrecioDetalUSD ORDER BY p.Nombre"),
    pool.request().query("SELECT Codigo FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().input("id", sql.Int, id).query("SELECT Id,Fecha,Monto,MonedaCodigo,Metodo,Referencia FROM importadora.CobrosPedido WHERE PedidoVentaId=@id ORDER BY Fecha DESC,Id DESC"),
    pool.request().input("id", sql.Int, id).query("SELECT Id FROM importadora.EntregasPedido WHERE PedidoVentaId=@id"),
    pool.request().input("id", sql.Int, id).query("SELECT a.Id,a.CobroPedidoId,a.NombreOriginal FROM importadora.CobroAdjuntos a JOIN importadora.CobrosPedido c ON c.Id=a.CobroPedidoId WHERE c.PedidoVentaId=@id ORDER BY a.Id DESC")
  ]);
  const order = header.recordset[0];
  if (!order) return <p>Pedido no encontrado.</p>;
  const total = lines.recordset.reduce((sum, line) => sum + Number(line.Cantidad) * Number(line.PrecioUnitario), 0);
  const paid = payments.recordset.filter((payment) => payment.MonedaCodigo === order.MonedaCodigo).reduce((sum, payment) => sum + Number(payment.Monto), 0);
  const canManageOrders = can(user, "pedidos.administrar"), canManagePayments = can(user, "cobros.administrar");

  return <>
    <Link className="copy-link" href="/panel/pedidos">← Volver a pedidos</Link>
    <h1>{order.Numero}</h1>
    <p>{order.Cliente} · <span className="badge">{order.Estado}</span> · {order.MonedaCodigo}</p>
    {order.Estado === "confirmado" && <Link className="button small" href={`/panel/pedidos/${id}/entrega`}>{delivery.recordset[0] ? "Ver entrega" : "Registrar entrega"}</Link>}
    {order.Estado === "borrador" && canManageOrders && <form action={confirmSaleOrder}><input type="hidden" name="id" value={id}/><button className="button">Confirmar venta y descontar inventario</button></form>}
    {order.Estado === "confirmado" && !payments.recordset.length && canManageOrders && <form action={cancelSaleOrder}><input type="hidden" name="id" value={id}/><button className="catalog-action danger">Cancelar venta y devolver inventario</button></form>}

    <section className="empty-card inventory-section">
      <div className="section-heading"><h2>Productos del pedido</h2><strong>{order.MonedaCodigo} {number(total)}</strong></div>
      {order.Estado === "borrador" && canManageOrders && <SaleLineForm order={id} products={products.recordset}/>} 
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>{lines.recordset.map((line) => <tr key={line.Id}><td>{line.Codigo} · {line.Producto}</td><td>{number(Number(line.Cantidad))}</td><td>{order.MonedaCodigo} {number(Number(line.PrecioUnitario))}</td><td>{order.MonedaCodigo} {number(Number(line.Cantidad) * Number(line.PrecioUnitario))}</td></tr>)}</tbody></table><p className="order-total">Total: {order.MonedaCodigo} {number(total)}</p></div>
    </section>

    {order.Estado === "confirmado" && <section className="empty-card import-expenses">
      <h2>Pagos recibidos</h2>
      <p>Registrado: {order.MonedaCodigo} {number(paid)} · Pendiente: {order.MonedaCodigo} {number(Math.max(0, total - paid))}</p>
      {canManagePayments && <PaymentForm order={id} currencies={currencies.recordset}/>} 
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Comprobantes</th><th>Acciones</th></tr></thead><tbody>{payments.recordset.map((payment) => {
        const proofs = attachments.recordset.filter((attachment) => Number(attachment.CobroPedidoId) === Number(payment.Id));
        return <tr key={payment.Id}><td>{formatVenezuelanDate(payment.Fecha)}</td><td>{payment.MonedaCodigo} {number(Number(payment.Monto))}</td><td>{payment.Metodo.replace("_", " ")}</td><td>{payment.Referencia ?? "—"}</td><td>{proofs.length ? `${proofs.length} archivo(s)` : "—"}</td><td>{canManagePayments && <PaymentActions payment={{ ...payment, Monto: Number(payment.Monto) }} order={id} attachments={proofs}/>}</td></tr>;
      })}</tbody></table>{!payments.recordset.length && <p className="empty-text">Aún no hay pagos registrados.</p>}</div>
    </section>}
  </>;
}
