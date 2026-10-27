import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { signedPaymentProofUrl } from "@/lib/blob";

export async function GET(_: Request, { params }: { params: Promise<{ paymentId: string; attachmentId: string }> }) {
  await requireUser("cobros.ver");
  const { paymentId, attachmentId } = await params;
  const result = await (await db()).request()
    .input("payment", sql.BigInt, Number(paymentId))
    .input("attachment", sql.BigInt, Number(attachmentId))
    .query("SELECT NombreBlob FROM importadora.CobroAdjuntos WHERE Id=@attachment AND CobroPedidoId=@payment");
  if (!result.recordset[0]) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(signedPaymentProofUrl(result.recordset[0].NombreBlob));
}
