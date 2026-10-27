"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import type { FormState } from "./auth";
export async function createPurchase(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("compras.administrar"),provider=Number(data.get("provider")),currency=String(data.get("currency")),date=String(data.get("date"));if(!provider||!date||!currency)return{message:"Completa proveedor, fecha y moneda."};try{const pool=await db();const n=await pool.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.OrdenesCompra");const number=`OC-${String(n.recordset[0].N).padStart(6,"0")}`;await pool.request().input("number",sql.VarChar(30),number).input("provider",sql.Int,provider).input("date",sql.Date,date).input("currency",sql.Char(3),currency).input("notes",sql.NVarChar(1000),String(data.get("notes")??"")||null).input("user",sql.Int,user.Id).query("INSERT importadora.OrdenesCompra(Numero,ProveedorId,Fecha,MonedaCodigo,Observaciones,CreadoPorUsuarioId) VALUES(@number,@provider,@date,@currency,@notes,@user)");}catch{return{message:"No se pudo crear la orden."}}revalidatePath("/panel/compras");return{success:true,message:"Orden creada."}}
export async function addPurchaseLine(_:FormState,d:FormData):Promise<FormState>{await requireUser("compras.administrar");const o=Number(d.get("order")),p=Number(d.get("product")),q=Number(d.get("quantity")),c=Number(d.get("cost"));if(!o||!p||q<=0||c<0)return{message:"Revisa producto, cantidad y costo."};try{await(await db()).request().input("o",sql.Int,o).input("p",sql.Int,p).input("q",sql.Decimal(19,4),q).input("c",sql.Decimal(19,4),c).query("INSERT importadora.OrdenCompraDetalles(OrdenCompraId,ProductoId,Cantidad,CostoUnitario) VALUES(@o,@p,@q,@c)");}catch{return{message:"No se pudo agregar; el producto ya está en la orden."}}revalidatePath(`/panel/compras/${o}`);return{success:true,message:"Producto agregado."}}
export async function deletePurchaseLine(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id")),o=Number(d.get("order"));await(await db()).request().input("id",sql.Int,id).query("DELETE FROM importadora.OrdenCompraDetalles WHERE Id=@id");revalidatePath(`/panel/compras/${o}`)}
export async function deletePurchase(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id"));const p=await db();await p.request().input("id",sql.Int,id).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND Estado='borrador') BEGIN DELETE FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id; DELETE FROM importadora.OrdenesCompra WHERE Id=@id; END");revalidatePath("/panel/compras")}
export async function confirmPurchase(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id")),p=await db();await p.request().input("id",sql.Int,id).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND Estado='borrador') AND EXISTS(SELECT 1 FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id) BEGIN UPDATE importadora.OrdenesCompra SET Estado='confirmada',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id; INSERT importadora.Importaciones(OrdenCompraId,Codigo) SELECT Id,CONCAT('IMP-',RIGHT('000000'+CONVERT(varchar(6),Id),6)) FROM importadora.OrdenesCompra WHERE Id=@id; END");revalidatePath(`/panel/compras/${id}`);revalidatePath("/panel/compras")}
export async function updateImport(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id"));await(await db()).request().input("id",sql.Int,id).input("agent",sql.NVarChar(150),String(d.get("agent")??"")||null).input("box",sql.NVarChar(150),String(d.get("box")??"")||null).input("guide",sql.NVarChar(100),String(d.get("guide")??"")||null).input("state",sql.VarChar(15),String(d.get("state"))).input("shipping",sql.VarChar(10),String(d.get("shipping"))).input("out",sql.Date,String(d.get("out")||"")||null).input("eta",sql.Date,String(d.get("eta")||"")||null).input("arrival",sql.Date,String(d.get("arrival")||"")||null).query("UPDATE importadora.Importaciones SET AgenteCarga=@agent,Casillero=@box,GuiaContenedor=@guide,Estado=@state,TipoEnvio=@shipping,FechaSalida=@out,FechaEstimadaLlegada=@eta,FechaLlegada=@arrival WHERE Id=@id");revalidatePath(`/panel/importaciones/${id}`);revalidatePath("/panel/importaciones")}



export async function addImportExpense(data: FormData) {
  await requireUser("compras.administrar");
  const importId = Number(data.get("importId")), amount = Number(data.get("amount"));
  const concept = String(data.get("concept") ?? "").trim(), currency = String(data.get("currency") ?? "");
  const date = String(data.get("date") ?? ""), rateRaw = String(data.get("rate") ?? "").trim();
  const rate = rateRaw ? Number(rateRaw) : null;
  if (!importId || !concept || !currency || !date || !Number.isFinite(amount) || amount < 0 || (rate !== null && (!Number.isFinite(rate) || rate <= 0))) return;
  await (await db()).request().input("importId", sql.Int, importId).input("concept", sql.NVarChar(120), concept).input("amount", sql.Decimal(19, 4), amount).input("currency", sql.Char(3), currency).input("date", sql.Date, date).input("rate", sql.Decimal(19, 6), rate).query("INSERT importadora.ImportacionGastos(ImportacionId,Concepto,Monto,MonedaCodigo,Fecha,TasaBCV) SELECT @importId,@concept,@amount,@currency,@date,@rate WHERE EXISTS(SELECT 1 FROM importadora.Importaciones WHERE Id=@importId)");
  revalidatePath(`/panel/importaciones/${importId}`);
}

export async function deleteImportExpense(data: FormData) {
  await requireUser("compras.administrar");
  const id = Number(data.get("id")), importId = Number(data.get("importId"));
  await (await db()).request().input("id", sql.Int, id).input("importId", sql.Int, importId).query("DELETE FROM importadora.ImportacionGastos WHERE Id=@id AND ImportacionId=@importId");
  revalidatePath(`/panel/importaciones/${importId}`);
}
