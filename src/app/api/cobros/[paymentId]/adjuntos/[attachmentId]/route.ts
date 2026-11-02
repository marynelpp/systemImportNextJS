import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { signedPaymentProofUrl } from "@/lib/blob";

export async function GET(_: Request, { params }: { params: Promise<{ paymentId: string; attachmentId: string }> }) {
  const user = await requireUser("cobros.ver");
  const { paymentId, attachmentId } = await params;
  const result = await (await db()).request()
    .input("payment", sql.BigInt, Number(paymentId))
    .input("attachment", sql.BigInt, Number(attachmentId))
    .input("company", sql.Int, user.EmpresaId)
    .query("SELECT a.NombreBlob FROM importadora.CobroAdjuntos a JOIN importadora.CobrosPedido c ON c.Id=a.CobroPedidoId JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE a.Id=@attachment AND a.CobroPedidoId=@payment AND p.EmpresaId=@company");
  if (!result.recordset[0]) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(signedPaymentProofUrl(result.recordset[0].NombreBlob));
}
