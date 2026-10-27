import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { signedProductImageUrl } from "@/lib/blob";

export async function GET(_:Request,{params}:{params:Promise<{id:string;imageId:string}>}) {
  await requireUser("productos.ver");
  const {id,imageId}=await params;
  const result=await (await db()).request().input("product",sql.Int,Number(id)).input("image",sql.BigInt,Number(imageId)).query("SELECT NombreBlob FROM importadora.ProductoImagenes WHERE Id=@image AND ProductoId=@product");
  if(!result.recordset[0]) return new NextResponse("No encontrada",{status:404});
  return NextResponse.redirect(signedProductImageUrl(result.recordset[0].NombreBlob));
}
