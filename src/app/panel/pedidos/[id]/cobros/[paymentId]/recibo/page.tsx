import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { PrintReceiptButton } from "@/components/print-receipt-button";

const money = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PaymentReceipt({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const user=await requireUser("pedidos.ver");
  const { id, paymentId } = await params, pool = await db();
  const result = await pool.request().input("company",sql.Int,user.EmpresaId).input("order", sql.Int, Number(id)).input("payment", sql.BigInt, Number(paymentId)).query("SELECT c.*,p.Numero,cl.Nombre Cliente FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId JOIN importadora.Clientes cl ON cl.Id=p.ClienteId WHERE p.EmpresaId=@company AND c.PedidoVentaId=@order AND c.Id=@payment");
  const payment = result.recordset[0];
  if (!payment) return <p>Cobro no encontrado.</p>;
  return <main className="receipt-page"><div className="receipt-toolbar no-print"><Link className="copy-link" href={`/panel/pedidos/${id}`}>← Volver al pedido</Link><PrintReceiptButton /></div><section className="receipt-card"><header><div><div className="eyebrow">RECIBO DE COBRO</div><h1>JJ IMPORT</h1><p>Pedido {payment.Numero}</p></div><strong>{formatVenezuelanDate(payment.Fecha)}</strong></header><hr/><div className="receipt-meta"><p><b>Cliente</b><br/>{payment.Cliente}</p><p><b>Estado</b><br/>{payment.Estado}</p><p><b>Referencia</b><br/>{payment.Referencia ?? "—"}</p></div><div className="receipt-total"><p>Monto recibido <strong>{payment.MonedaCodigo === "VES" ? "Bs." : "USD"} {money(Number(payment.Monto))}</strong></p><p>Equivalente contable <strong>USD {money(Number(payment.MontoUSD ?? payment.Monto))}</strong></p>{payment.MonedaCodigo === "VES" && <small>Tasa aplicada: Bs. {money(Number(payment.TasaBCV))} por USD.</small>}</div><footer>Método: {payment.Metodo.replace("_", " ")} · Documento generado por JJ IMPORT.</footer></section></main>;
}
