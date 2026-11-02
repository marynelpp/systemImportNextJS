import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { PrintReceiptButton } from "@/components/print-receipt-button";

const money = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function SaleReceipt({ params }: { params: Promise<{ id: string }> }) {
  const user=await requireUser("pedidos.ver");
  const id = Number((await params).id), pool = await db();
  const [header, lines, payments] = await Promise.all([
    pool.request().input("id", sql.Int, id).input("company",sql.Int,user.EmpresaId).query("SELECT p.*,c.Nombre Cliente,c.Documento,c.Telefono FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId WHERE p.Id=@id AND p.EmpresaId=@company"),
    pool.request().input("id", sql.Int, id).input("company",sql.Int,user.EmpresaId).query("SELECT d.Cantidad,d.PrecioUnitario,pr.Codigo,pr.Nombre FROM importadora.PedidoVentaDetalles d JOIN importadora.PedidosVenta p ON p.Id=d.PedidoVentaId JOIN importadora.Productos pr ON pr.Id=d.ProductoId WHERE d.PedidoVentaId=@id AND p.EmpresaId=@company ORDER BY d.Id"),
    pool.request().input("id", sql.Int, id).input("company",sql.Int,user.EmpresaId).query("SELECT ISNULL(SUM(c.MontoUSD),0) Cobrado FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.PedidoVentaId=@id AND p.EmpresaId=@company AND c.Estado='activo'"),
  ]);
  const order = header.recordset[0];
  if (!order) return <p>Pedido no encontrado.</p>;
  const rawTotal = lines.recordset.reduce((sum, line) => sum + Number(line.Cantidad) * Number(line.PrecioUnitario), 0);
  const rate = Number(order.TasaBCV), totalUsd = order.MonedaCodigo === "VES" && rate > 0 ? rawTotal / rate : rawTotal;
  const paid = Number(payments.recordset[0].Cobrado), pending = Math.max(0, totalUsd - paid);
  return <main className="receipt-page"><div className="receipt-toolbar no-print"><Link className="copy-link" href={`/panel/pedidos/${id}`}>← Volver al pedido</Link><PrintReceiptButton /></div><section className="receipt-card"><header><div><div className="eyebrow">COMPROBANTE DE VENTA</div><h1>JJ IMPORT</h1><p>Pedido {order.Numero}</p></div><strong>{formatVenezuelanDate(order.Fecha)}</strong></header><hr/><div className="receipt-meta"><p><b>Cliente</b><br/>{order.Cliente}</p><p><b>Documento</b><br/>{order.Documento ?? "—"}</p><p><b>Estado</b><br/>{order.Estado}</p></div><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio USD</th><th>Subtotal USD</th></tr></thead><tbody>{lines.recordset.map((line) => <tr key={line.Codigo}><td>{line.Codigo} · {line.Nombre}</td><td>{money(Number(line.Cantidad))}</td><td>{money(order.MonedaCodigo === "VES" && rate > 0 ? Number(line.PrecioUnitario) / rate : Number(line.PrecioUnitario))}</td><td>{money((order.MonedaCodigo === "VES" && rate > 0 ? Number(line.PrecioUnitario) / rate : Number(line.PrecioUnitario)) * Number(line.Cantidad))}</td></tr>)}</tbody></table><div className="receipt-total"><p>Total de venta <strong>USD {money(totalUsd)}</strong></p><p>Cobrado <strong>USD {money(paid)}</strong></p><p>Pendiente <strong>USD {money(pending)}</strong></p>{rate > 0 && <small>Referencia BCV: Bs. {money(rate)} por USD.</small>}</div><footer>Documento generado por JJ IMPORT · Los importes contables se expresan en USD.</footer></section></main>;
}
