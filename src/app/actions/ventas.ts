"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { uploadPaymentProof } from "@/lib/blob";
import { fetchBcvUsdRate } from "@/lib/bcv";
import type { FormState } from "./auth";

const text = (data: FormData, name: string, length: number) => String(data.get(name) ?? "").trim().slice(0, length);
const paymentFiles = (data: FormData) => data.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
const validPaymentFile = (file: File) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) && file.size <= 8 * 1024 * 1024;

export type BcvRateFormState = FormState & { rate?: number; date?: string };

export async function fetchCurrentSaleBcvRate(_: BcvRateFormState, __: FormData): Promise<BcvRateFormState> {
  await requireUser("pedidos.administrar");
  try {
    const rate = await fetchBcvUsdRate();
    return { success: true, rate: rate.rate, date: rate.date, message: `Tasa BCV consultada: Bs. ${Number(rate.rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por USD.` };
  } catch {
    return { message: "No se pudo consultar el BCV en este momento. Intenta nuevamente o ingresa la tasa confirmada." };
  }
}

export async function refreshDraftSaleBcvRate(_: BcvRateFormState, data: FormData): Promise<BcvRateFormState> {
  const user = await requireUser("pedidos.administrar");
  const order = Number(data.get("order"));
  if (!Number.isInteger(order)) return { message: "Pedido inválido." };
  let liveRate: number;
  try {
    liveRate = Number((await fetchBcvUsdRate()).rate);
    if (!Number.isFinite(liveRate) || liveRate <= 0) throw new Error();
  } catch {
    return { message: "No se pudo consultar el BCV en este momento. Intenta nuevamente." };
  }
  const pool = await db();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const header = await request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("SELECT TasaBCV FROM importadora.PedidosVenta WITH(UPDLOCK,HOLDLOCK) WHERE Id=@order AND EmpresaId=@company AND Estado='borrador' AND MonedaCodigo='VES'");
    const oldRate = Number(header.recordset[0]?.TasaBCV);
    if (!Number.isFinite(oldRate) || oldRate <= 0) throw new Error();
    await request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("oldRate", sql.Decimal(19, 6), oldRate).input("newRate", sql.Decimal(19, 6), liveRate)
      .query("UPDATE d SET PrecioUnitario=ROUND(d.PrecioUnitario/@oldRate*@newRate,4) FROM importadora.PedidoVentaDetalles d JOIN importadora.PedidosVenta p ON p.Id=d.PedidoVentaId WHERE d.PedidoVentaId=@order AND p.EmpresaId=@company; UPDATE importadora.PedidosVenta SET TasaBCV=@newRate,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@order AND EmpresaId=@company AND Estado='borrador' AND MonedaCodigo='VES'");
    await transaction.commit();
  } catch {
    await transaction.rollback();
    return { message: "Solo se puede actualizar la tasa de un pedido en bolívares que siga en borrador." };
  }
  revalidatePath(`/panel/pedidos/${order}`);
  return { success: true, rate: liveRate, message: `Tasa BCV actualizada a Bs. ${liveRate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Los importes del borrador fueron recalculados.` };
}

export async function createSaleOrderWithRate(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("pedidos.administrar");
  const client = Number(data.get("client"));
  const date = String(data.get("date") ?? "");
  const currency = String(data.get("currency") ?? "USD").toUpperCase();
  const priceType = String(data.get("priceType") ?? "");
  const bcvRate = Number(data.get("bcvRate"));
  if (!Number.isInteger(client) || !date || !["USD", "VES"].includes(currency) || !["detal", "mayor"].includes(priceType)) return { message: "Completa cliente, fecha, moneda y tipo de venta." };
  if (currency === "VES" && (!Number.isFinite(bcvRate) || bcvRate <= 0)) return { message: "Consulta o ingresa una tasa BCV válida para este pedido en bolívares." };
  try {
    const pool = await db();
    const next = await pool.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.PedidosVenta");
    const number = `PV-${String(next.recordset[0].N).padStart(6, "0")}`;
    await pool.request().input("company", sql.Int, user.EmpresaId).input("number", sql.VarChar(30), number).input("client", sql.Int, client).input("date", sql.Date, date)
      .input("currency", sql.Char(3), currency).input("priceType", sql.VarChar(10), priceType)
      .input("bcvRate", sql.Decimal(19, 6), currency === "VES" ? bcvRate : null)
      .input("notes", sql.NVarChar(500), text(data, "notes", 500) || null).input("user", sql.Int, user.Id)
      .query("INSERT importadora.PedidosVenta(EmpresaId,Numero,ClienteId,Fecha,MonedaCodigo,TipoPrecio,TasaBCV,Observaciones,CreadoPorUsuarioId) SELECT @company,@number,@client,@date,@currency,@priceType,@bcvRate,@notes,@user WHERE EXISTS(SELECT 1 FROM importadora.Clientes WHERE Id=@client AND EmpresaId=@company AND Activo=1)");
  } catch {
    return { message: "No se pudo crear el pedido. Verifica que ejecutaste la actualización de base de datos." };
  }
  revalidatePath("/panel/pedidos");
  return { success: true, message: "Pedido creado con la tasa confirmada." };
}

export async function createUsdSaleOrder(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("pedidos.administrar");
  const client = Number(data.get("client")), warehouse = Number(data.get("warehouse")), date = String(data.get("date") ?? ""), priceType = String(data.get("priceType") ?? "");
  if (!Number.isInteger(client) || !Number.isInteger(warehouse) || !date || !["detal", "mayor"].includes(priceType)) return { message: "Completa cliente, almacén, fecha y tipo de venta." };
  try {
    const pool = await db();
    const next = await pool.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.PedidosVenta");
    const number = `PV-${String(next.recordset[0].N).padStart(6, "0")}`;
    const created = await pool.request().input("company", sql.Int, user.EmpresaId).input("number", sql.VarChar(30), number).input("client", sql.Int, client).input("warehouse", sql.Int, warehouse).input("date", sql.Date, date).input("priceType", sql.VarChar(10), priceType).input("notes", sql.NVarChar(500), text(data, "notes", 500) || null).input("user", sql.Int, user.Id)
      .query("INSERT importadora.PedidosVenta(EmpresaId,Numero,ClienteId,AlmacenId,Fecha,MonedaCodigo,TipoPrecio,Observaciones,CreadoPorUsuarioId) SELECT @company,@number,@client,@warehouse,@date,'USD',@priceType,@notes,@user WHERE EXISTS(SELECT 1 FROM importadora.Clientes WHERE Id=@client AND EmpresaId=@company AND Activo=1) AND EXISTS(SELECT 1 FROM importadora.Almacenes WHERE Id=@warehouse AND EmpresaId=@company AND Activo=1)");
    if (!created.rowsAffected[0]) return { message: "El cliente o almacén seleccionado ya no pertenece a la empresa activa." };
  } catch {
    return { message: "No se pudo crear el pedido." };
  }
  revalidatePath("/panel/pedidos");
  return { success: true, message: "Pedido creado en USD." };
}

export async function openCashDay(data: FormData) {
  const user=await requireUser("cobros.administrar"), date=String(data.get("date")??""), opening=Number(data.get("opening"));
  if(!date||!Number.isFinite(opening)||opening<0)return;
  await (await db()).request().input("company",sql.Int,user.EmpresaId).input("date",sql.Date,date).input("opening",sql.Decimal(19,4),opening).input("user",sql.Int,user.Id).query("INSERT importadora.CierresCaja(EmpresaId,Fecha,SaldoInicialUSD,AbiertoPorUsuarioId) SELECT @company,@date,@opening,@user WHERE NOT EXISTS(SELECT 1 FROM importadora.CierresCaja WHERE EmpresaId=@company AND Fecha=@date)");
  revalidatePath("/panel/caja");
}
export async function closeCashDay(data: FormData) {
  const user=await requireUser("cobros.administrar"), date=String(data.get("date")??""), declared=Number(data.get("declared")), notes=text(data,"notes",300);
  if(!date||!Number.isFinite(declared)||declared<0)return;
  await (await db()).request().input("company",sql.Int,user.EmpresaId).input("date",sql.Date,date).input("declared",sql.Decimal(19,4),declared).input("notes",sql.NVarChar(300),notes||null).input("user",sql.Int,user.Id).query("UPDATE importadora.CierresCaja SET Estado='cerrado',CobrosUSD=(SELECT ISNULL(SUM(COALESCE(c.MontoUSD,CASE WHEN c.MonedaCodigo='USD' THEN c.Monto ELSE 0 END)),0) FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Fecha=@date AND c.Estado='activo' AND p.EmpresaId=@company),MontoDeclaradoUSD=@declared,Observaciones=@notes,CerradoPorUsuarioId=@user,CerradoEn=SYSUTCDATETIME() WHERE EmpresaId=@company AND Fecha=@date AND Estado='abierto'");
  revalidatePath("/panel/caja");
}

export async function addSaleLineWithRate(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("pedidos.administrar");
  const order = Number(data.get("order")), product = Number(data.get("product")), quantity = Number(data.get("quantity")), priceType = String(data.get("priceType") ?? "");
  if (!Number.isInteger(order) || !Number.isInteger(product) || quantity <= 0 || !["detal", "mayor"].includes(priceType)) return { message: "Revisa producto, cantidad y tipo de precio." };
  try {
    const pool = await db();
    const header = await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("SELECT TipoPrecio,MonedaCodigo,TasaBCV,AlmacenId,(SELECT COUNT(*) FROM importadora.PedidoVentaDetalles WHERE PedidoVentaId=@order) Lineas FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='borrador'");
    const current = header.recordset[0];
    if (!current || !["USD", "VES"].includes(current.MonedaCodigo)) return { message: "El pedido debe estar en borrador y usar USD o VES." };
    if (current.MonedaCodigo === "VES" && (!current.TasaBCV || Number(current.TasaBCV) <= 0)) return { message: "Este pedido no tiene una tasa BCV válida." };
    if (Number(current.Lineas) > 0 && current.TipoPrecio !== priceType) return { message: "No puedes cambiar de Detal a Mayor después de agregar productos." };
    if (Number(current.Lineas) === 0) await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("priceType", sql.VarChar(10), priceType).query("UPDATE importadora.PedidosVenta SET TipoPrecio=@priceType WHERE Id=@order AND EmpresaId=@company");
    const selected = await pool.request().input("product", sql.Int, product).input("company", sql.Int, user.EmpresaId).input("priceType", sql.VarChar(10), priceType).input("warehouse", sql.Int, current.AlmacenId ?? null).query("SELECT CASE @priceType WHEN 'mayor' THEN PrecioMayorUSD ELSE PrecioDetalUSD END Precio FROM importadora.Productos p WHERE Id=@product AND EmpresaId=@company AND Activo=1 AND EXISTS(SELECT 1 FROM importadora.InventarioLotes l WHERE l.ProductoId=p.Id AND l.CantidadDisponible>0 AND (@warehouse IS NULL OR l.AlmacenId=@warehouse))");
    const basePrice = selected.recordset[0]?.Precio;
    if (basePrice === null || basePrice === undefined) return { message: "Configura el precio de venta seleccionado para este producto." };
    const price = current.MonedaCodigo === "VES" ? Number(basePrice) * Number(current.TasaBCV) : Number(basePrice);
    await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("product", sql.Int, product).input("quantity", sql.Decimal(19, 4), quantity).input("price", sql.Decimal(19, 4), price).query("INSERT importadora.PedidoVentaDetalles(PedidoVentaId,ProductoId,Cantidad,PrecioUnitario) SELECT @order,@product,@quantity,@price WHERE EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='borrador')");
  } catch {
    return { message: "No se pudo agregar el producto; puede que ya esté en el pedido." };
  }
  revalidatePath(`/panel/pedidos/${order}`);
  return { success: true, message: "Producto agregado con el precio y tasa del pedido." };
}

export async function registerOrderCurrencyPayment(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("cobros.administrar");
  const order = Number(data.get("order")), amount = Number(data.get("amount")), date = String(data.get("date") ?? ""), method = String(data.get("method") ?? ""), files = paymentFiles(data);
  if (!Number.isInteger(order) || !Number.isFinite(amount) || amount <= 0 || !date || !["efectivo", "pago_movil", "transferencia", "zelle", "punto_venta", "otro"].includes(method)) return { message: "Completa los datos del cobro." };
  if (files.some((file) => !validPaymentFile(file))) return { message: "Adjunta solo JPG, PNG, WebP o PDF de máximo 8 MB." };
  try {
    const pool = await db();
    const created = await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("amount", sql.Decimal(19, 4), amount).input("date", sql.Date, date).input("method", sql.VarChar(20), method)
      .input("reference", sql.NVarChar(100), text(data, "reference", 100) || null).input("notes", sql.NVarChar(300), text(data, "notes", 300) || null).input("user", sql.Int, user.Id)
      .query("INSERT importadora.CobrosPedido(PedidoVentaId,Fecha,Monto,MonedaCodigo,Metodo,Referencia,Notas,RegistradoPorUsuarioId) OUTPUT INSERTED.Id SELECT @order,@date,@amount,MonedaCodigo,@method,@reference,@notes,@user FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado'");
    const paymentId = created.recordset[0]?.Id;
    if (!paymentId) return { message: "El pedido ya no permite registrar cobros." };
    await savePaymentAttachments(paymentId, files, user.Id);
  } catch {
    return { message: "No se pudo registrar el cobro o sus comprobantes." };
  }
  revalidatePath(`/panel/pedidos/${order}`);
  revalidatePath("/panel/reportes");
  return { success: true, message: files.length ? "Cobro y comprobantes registrados." : "Cobro registrado." };
}

export async function refreshUsdDraftBcvRate(_: BcvRateFormState, data: FormData): Promise<BcvRateFormState> {
  const user = await requireUser("pedidos.administrar");
  const order = Number(data.get("order"));
  if (!Number.isInteger(order)) return { message: "Pedido inválido." };
  try {
    const rate = Number((await fetchBcvUsdRate()).rate);
    const updated = await (await db()).request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("rate", sql.Decimal(19, 6), rate)
      .query("UPDATE importadora.PedidosVenta SET TasaBCV=@rate,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@order AND EmpresaId=@company AND Estado='borrador' AND MonedaCodigo='USD'");
    if (!updated.rowsAffected[0]) return { message: "El pedido ya no está disponible para actualizar su tasa." };
    revalidatePath(`/panel/pedidos/${order}`);
    return { success: true, rate, message: "Tasa BCV de referencia actualizada. Al confirmar, esta será la tasa aplicada." };
  } catch {
    return { message: "No se pudo consultar el BCV en este momento." };
  }
}

export async function registerUsdBasedPayment(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("cobros.administrar");
  const order = Number(data.get("order")), amount = Number(data.get("amount")), currency = String(data.get("currency") ?? ""), date = String(data.get("date") ?? ""), method = String(data.get("method") ?? ""), files = paymentFiles(data);
  if (!Number.isInteger(order) || !Number.isFinite(amount) || amount <= 0 || !["USD", "VES"].includes(currency) || !date || !["efectivo", "pago_movil", "transferencia", "zelle", "punto_venta", "otro"].includes(method)) return { message: "Completa los datos del cobro." };
  if (files.some((file) => !validPaymentFile(file))) return { message: "Adjunta solo JPG, PNG, WebP o PDF de máximo 8 MB." };
  try {
    const pool = await db();
    const header = await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("SELECT MonedaCodigo,TasaBCV FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado'");
    const sale = header.recordset[0];
    if (!sale || !["USD", "VES"].includes(sale.MonedaCodigo)) return { message: "Este cobro requiere un pedido confirmado." };
    const rate = Number(sale.TasaBCV);
    if (currency === "VES" && (!Number.isFinite(rate) || rate <= 0)) return { message: "El pedido no tiene una tasa BCV confirmada." };
    const amountUsd = currency === "VES" ? amount / rate : amount;
    const created = await pool.request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("amount", sql.Decimal(19, 4), amount).input("currency", sql.Char(3), currency).input("amountUsd", sql.Decimal(19, 4), amountUsd).input("rate", sql.Decimal(19, 6), currency === "VES" ? rate : null).input("date", sql.Date, date).input("method", sql.VarChar(20), method).input("reference", sql.NVarChar(100), text(data, "reference", 100) || null).input("notes", sql.NVarChar(300), text(data, "notes", 300) || null).input("user", sql.Int, user.Id)
      .query("INSERT importadora.CobrosPedido(PedidoVentaId,Fecha,Monto,MonedaCodigo,MontoUSD,TasaBCV,Metodo,Referencia,Notas,RegistradoPorUsuarioId) OUTPUT INSERTED.Id SELECT @order,@date,@amount,@currency,@amountUsd,@rate,@method,@reference,@notes,@user WHERE EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado')");
    await savePaymentAttachments(created.recordset[0].Id, files, user.Id);
  } catch {
    return { message: "No se pudo registrar el cobro o sus comprobantes." };
  }
  revalidatePath(`/panel/pedidos/${order}`);
  revalidatePath("/panel/reportes");
  return { success: true, message: "Cobro registrado y convertido a su equivalente en USD." };
}

export async function registerPaymentWithBalance(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("cobros.administrar");
  const order = Number(data.get("order")), amount = Number(data.get("amount")), currency = String(data.get("currency") ?? ""), date = String(data.get("date") ?? ""), method = String(data.get("method") ?? ""), files = paymentFiles(data);
  if (!Number.isInteger(order) || !Number.isFinite(amount) || amount <= 0 || !["USD", "VES"].includes(currency) || !date || !["efectivo", "pago_movil", "transferencia", "zelle", "punto_venta", "otro"].includes(method)) return { message: "Completa los datos del cobro." };
  if (files.some((file) => !validPaymentFile(file))) return { message: "Adjunta solo JPG, PNG, WebP o PDF de máximo 8 MB." };
  const pool = await db(), transaction = new sql.Transaction(pool);
  let paymentId: number;
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const header = await request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("SELECT p.MonedaCodigo,p.TasaBCV,SUM(d.Cantidad*d.PrecioUnitario) Total FROM importadora.PedidosVenta p WITH(UPDLOCK,HOLDLOCK) JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id WHERE p.Id=@order AND p.EmpresaId=@company AND p.Estado='confirmado' GROUP BY p.MonedaCodigo,p.TasaBCV");
    const sale = header.recordset[0];
    if (!sale) throw new Error();
    const rate = Number(sale.TasaBCV);
    if (currency === "VES" && (!Number.isFinite(rate) || rate <= 0)) throw new Error();
    const totalUsd = sale.MonedaCodigo === "VES" ? Number(sale.Total) / rate : Number(sale.Total);
    const amountUsd = currency === "VES" ? amount / rate : amount;
    const paid = await request().input("order", sql.Int, order).query("SELECT ISNULL(SUM(MontoUSD),0) Total FROM importadora.CobrosPedido WHERE PedidoVentaId=@order AND Estado='activo'");
    const remaining = totalUsd - Number(paid.recordset[0].Total);
    if (amountUsd > remaining + 0.005) return await transaction.rollback().then(() => ({ message: `El cobro supera el saldo pendiente de USD ${Math.max(0, remaining).toFixed(2)}.` }));
    const inserted = await request().input("order", sql.Int, order).input("amount", sql.Decimal(19, 4), amount).input("currency", sql.Char(3), currency).input("amountUsd", sql.Decimal(19, 4), amountUsd).input("rate", sql.Decimal(19, 6), currency === "VES" ? rate : null).input("date", sql.Date, date).input("method", sql.VarChar(20), method).input("reference", sql.NVarChar(100), text(data, "reference", 100) || null).input("notes", sql.NVarChar(300), text(data, "notes", 300) || null).input("user", sql.Int, user.Id).query("INSERT importadora.CobrosPedido(PedidoVentaId,Fecha,Monto,MonedaCodigo,MontoUSD,TasaBCV,Metodo,Referencia,Notas,RegistradoPorUsuarioId) OUTPUT INSERTED.Id VALUES(@order,@date,@amount,@currency,@amountUsd,@rate,@method,@reference,@notes,@user)");
    paymentId = Number(inserted.recordset[0].Id);
    await transaction.commit();
  } catch {
    await transaction.rollback();
    return { message: "No se pudo registrar el cobro." };
  }
  try { await savePaymentAttachments(paymentId!, files, user.Id); } catch { return { message: "Cobro registrado, pero no se pudieron guardar los comprobantes." }; }
  revalidatePath(`/panel/pedidos/${order}`); revalidatePath("/panel/caja"); revalidatePath("/panel/reportes");
  return { success: true, message: "Cobro registrado y convertido a USD." };
}

export async function reversePayment(data: FormData) {
  const user = await requireUser("cobros.administrar");
  const id = Number(data.get("id")), order = Number(data.get("order"));
  if (!Number.isInteger(id) || !Number.isInteger(order)) return;
  await (await db()).request().input("id", sql.BigInt, id).input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("user", sql.Int, user.Id).input("reason", sql.NVarChar(300), "Reversado por corrección de cobro")
    .query("UPDATE c SET Estado='revertido',RevertidoEn=SYSUTCDATETIME(),RevertidoPorUsuarioId=@user,MotivoReversion=@reason FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Id=@id AND c.PedidoVentaId=@order AND p.EmpresaId=@company AND c.Estado='activo'");
  revalidatePath(`/panel/pedidos/${order}`); revalidatePath("/panel/caja"); revalidatePath("/panel/reportes");
}

export async function updateUsdBasedPayment(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("cobros.administrar");
  const id = Number(data.get("id")), order = Number(data.get("order")), amount = Number(data.get("amount")), date = String(data.get("date") ?? ""), method = String(data.get("method") ?? "");
  if (!Number.isInteger(id) || !Number.isInteger(order) || !Number.isFinite(amount) || amount <= 0 || !date) return { message: "Revisa los datos del cobro." };
  try {
    const updated = await (await db()).request().input("id", sql.BigInt, id).input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("amount", sql.Decimal(19, 4), amount).input("date", sql.Date, date).input("method", sql.VarChar(20), method).input("reference", sql.NVarChar(100), text(data, "reference", 100) || null)
      .query("UPDATE c SET Fecha=@date,Monto=@amount,MontoUSD=CASE WHEN c.MonedaCodigo='VES' THEN ROUND(@amount/c.TasaBCV,4) ELSE @amount END,Metodo=@method,Referencia=@reference FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta o ON o.Id=c.PedidoVentaId WHERE c.Id=@id AND c.PedidoVentaId=@order AND o.EmpresaId=@company AND o.MonedaCodigo IN('USD','VES')");
    if (!updated.rowsAffected[0]) return { message: "No se pudo actualizar el cobro." };
  } catch {
    return { message: "No se pudo actualizar el cobro." };
  }
  revalidatePath(`/panel/pedidos/${order}`);
  revalidatePath("/panel/reportes");
  return { success: true, message: "Cobro actualizado manteniendo su equivalencia en USD." };
}

export async function confirmUsdSaleOrder(data: FormData) {
  const user = await requireUser("pedidos.administrar");
  const order = Number(data.get("id"));
  if (!Number.isInteger(order)) return;
  try {
    const rate = Number((await fetchBcvUsdRate()).rate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    const updated = await (await db()).request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).input("rate", sql.Decimal(19, 6), rate)
      .query("UPDATE importadora.PedidosVenta SET TasaBCV=@rate,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@order AND EmpresaId=@company AND Estado='borrador' AND MonedaCodigo='USD'");
    if (!updated.rowsAffected[0]) return;
  } catch {
    return;
  }
  await confirmSaleOrder(data);
}

async function savePaymentAttachments(paymentId: number, files: File[], userId: number) {
  const pool = await db();
  for (const file of files) {
    const attachment = await uploadPaymentProof(paymentId, file);
    await pool.request().input("payment", sql.BigInt, paymentId).input("blob", sql.NVarChar(300), attachment.blobName)
      .input("original", sql.NVarChar(255), attachment.originalName).input("type", sql.VarChar(100), attachment.contentType)
      .input("size", sql.Int, attachment.size).input("user", sql.Int, userId)
      .query("INSERT importadora.CobroAdjuntos(CobroPedidoId,NombreBlob,NombreOriginal,TipoContenido,TamanoBytes,CreadoPorUsuarioId) VALUES(@payment,@blob,@original,@type,@size,@user)");
  }
}

export async function createCustomer(_: FormState, data: FormData): Promise<FormState> {
  const actor = await requireUser("clientes.administrar");
  const code = text(data, "code", 20).toUpperCase();
  const type = text(data, "type", 12);
  const name = text(data, "name", 160);
  const document = text(data, "document", 30).toUpperCase();
  const email = text(data, "email", 254).toLowerCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code) || !["natural", "empresa"].includes(type) || name.length < 2 || (email && !/^\S+@\S+\.\S+$/.test(email))) return { message: "Revisa código, tipo, nombre y correo." };
  try {
    await (await db()).request().input("company", sql.Int, actor.EmpresaId).input("code", sql.VarChar(20), code).input("type", sql.VarChar(12), type).input("name", sql.NVarChar(160), name).input("document", sql.VarChar(30), document || null).input("phone", sql.NVarChar(40), text(data, "phone", 40) || null).input("email", sql.NVarChar(254), email || null).input("address", sql.NVarChar(300), text(data, "address", 300) || null).input("notes", sql.NVarChar(500), text(data, "notes", 500) || null).query("INSERT importadora.Clientes(EmpresaId,Codigo,Tipo,Nombre,Documento,Telefono,Email,Direccion,Notas) VALUES(@company,@code,@type,@name,@document,@phone,@email,@address,@notes)");
  } catch { return { message: "No se pudo registrar. El código o documento ya existe." }; }
  revalidatePath("/panel/clientes");
  return { success: true, message: "Cliente registrado." };
}

export async function deactivateCustomer(data: FormData) {
  const actor = await requireUser("clientes.administrar");
  const id = Number(data.get("id"));
  if (!Number.isInteger(id)) return;
  await (await db()).request().input("id", sql.Int, id).input("company", sql.Int, actor.EmpresaId).query("UPDATE importadora.Clientes SET Activo=0,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id AND EmpresaId=@company");
  revalidatePath("/panel/clientes");
}

export async function createSaleOrder(_: FormState,data: FormData): Promise<FormState>{const user=await requireUser("pedidos.administrar"),client=Number(data.get("client")),date=String(data.get("date")??""),currency=String(data.get("currency")??"USD"),priceType=String(data.get("priceType")??"");if(!Number.isInteger(client)||!date||!currency||!["detal","mayor"].includes(priceType))return{message:"Completa cliente, fecha, moneda y tipo de venta."};try{const p=await db(),n=await p.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.PedidosVenta"),number=`PV-${String(n.recordset[0].N).padStart(6,"0")}`;await p.request().input("number",sql.VarChar(30),number).input("client",sql.Int,client).input("date",sql.Date,date).input("currency",sql.Char(3),currency).input("priceType",sql.VarChar(10),priceType).input("notes",sql.NVarChar(500),text(data,"notes",500)||null).input("user",sql.Int,user.Id).query("INSERT importadora.PedidosVenta(Numero,ClienteId,Fecha,MonedaCodigo,TipoPrecio,Observaciones,CreadoPorUsuarioId) VALUES(@number,@client,@date,@currency,@priceType,@notes,@user)");}catch{return{message:"No se pudo crear el pedido. Verifica que ejecutaste la actualización de base de datos."}}revalidatePath("/panel/pedidos");return{success:true,message:"Pedido creado."}}
export async function addSaleLine(_: FormState,data: FormData): Promise<FormState>{await requireUser("pedidos.administrar");const order=Number(data.get("order")),product=Number(data.get("product")),quantity=Number(data.get("quantity")),priceType=String(data.get("priceType")??"");if(!Number.isInteger(order)||!Number.isInteger(product)||quantity<=0||!["detal","mayor"].includes(priceType))return{message:"Revisa producto, cantidad y tipo de precio."};try{const pool=await db(),header=await pool.request().input("order",sql.Int,order).query("SELECT TipoPrecio,(SELECT COUNT(*) FROM importadora.PedidoVentaDetalles WHERE PedidoVentaId=@order) Lineas FROM importadora.PedidosVenta WHERE Id=@order AND Estado='borrador' AND MonedaCodigo='USD'");const current=header.recordset[0];if(!current)return{message:"El pedido debe estar en borrador y en USD."};if(Number(current.Lineas)>0&&current.TipoPrecio!==priceType)return{message:"No puedes cambiar de Detal a Mayor después de agregar productos."};if(Number(current.Lineas)===0)await pool.request().input("order",sql.Int,order).input("priceType",sql.VarChar(10),priceType).query("UPDATE importadora.PedidosVenta SET TipoPrecio=@priceType WHERE Id=@order");const priceResult=await pool.request().input("product",sql.Int,product).input("priceType",sql.VarChar(10),priceType).query("SELECT CASE @priceType WHEN 'mayor' THEN PrecioMayorUSD ELSE PrecioDetalUSD END Precio FROM importadora.Productos WHERE Id=@product AND Activo=1");const price=priceResult.recordset[0]?.Precio;if(price===null||price===undefined)return{message:"Configura el precio de venta seleccionado para este producto."};await pool.request().input("order",sql.Int,order).input("product",sql.Int,product).input("quantity",sql.Decimal(19,4),quantity).input("price",sql.Decimal(19,4),price).query("INSERT importadora.PedidoVentaDetalles(PedidoVentaId,ProductoId,Cantidad,PrecioUnitario) VALUES(@order,@product,@quantity,@price)");}catch{return{message:"No se pudo agregar el producto; puede que ya esté en el pedido."}}revalidatePath(`/panel/pedidos/${order}`);return{success:true,message:"Producto agregado con el precio configurado."}}
export async function deleteSaleLine(data:FormData){const user=await requireUser("pedidos.administrar"),id=Number(data.get("id")),order=Number(data.get("order"));if(!Number.isInteger(id)||!Number.isInteger(order))return;await(await db()).request().input("id",sql.Int,id).input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("DELETE d FROM importadora.PedidoVentaDetalles d JOIN importadora.PedidosVenta o ON o.Id=d.PedidoVentaId WHERE d.Id=@id AND d.PedidoVentaId=@order AND o.EmpresaId=@company AND o.Estado='borrador'");revalidatePath(`/panel/pedidos/${order}`)}
export async function confirmSaleOrder(data: FormData) {
  const user = await requireUser("pedidos.administrar"), order = Number(data.get("id"));
  if (!Number.isInteger(order)) return;
  const pool = await db(), transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const header = await request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("SELECT Id,AlmacenId FROM importadora.PedidosVenta WITH(UPDLOCK,HOLDLOCK) WHERE Id=@order AND EmpresaId=@company AND Estado='borrador'");
    const sale = header.recordset[0];
    if (!sale) throw new Error();
    const details = (await request().input("order", sql.Int, order).query("SELECT Id,ProductoId,Cantidad FROM importadora.PedidoVentaDetalles WHERE PedidoVentaId=@order")).recordset;
    if (!details.length) throw new Error();
    for (const detail of details) {
      let pending = Number(detail.Cantidad);
      const lots = (await request().input("product", sql.Int, detail.ProductoId).input("warehouse", sql.Int, sale.AlmacenId ?? null).query("SELECT Id,CantidadDisponible,CostoUnitarioAterrizado FROM importadora.InventarioLotes WITH(UPDLOCK,HOLDLOCK) WHERE ProductoId=@product AND CantidadDisponible>0 AND (@warehouse IS NULL OR AlmacenId=@warehouse) ORDER BY CreadoEn,Id")).recordset;
      for (const lot of lots) {
        if (!pending) break;
        const amount = Math.min(pending, Number(lot.CantidadDisponible));
        await request().input("lot", sql.Int, lot.Id).input("amount", sql.Decimal(19, 4), amount).query("UPDATE importadora.InventarioLotes SET CantidadDisponible=CantidadDisponible-@amount WHERE Id=@lot");
        await request().input("detail", sql.Int, detail.Id).input("lot", sql.Int, lot.Id).input("amount", sql.Decimal(19, 4), amount).input("cost", sql.Decimal(19, 4), lot.CostoUnitarioAterrizado).query("INSERT importadora.VentaLoteAsignaciones(PedidoVentaDetalleId,LoteId,Cantidad,CostoUnitario) VALUES(@detail,@lot,@amount,@cost)");
        await request().input("lot", sql.Int, lot.Id).input("amount", sql.Decimal(19, 4), -amount).input("user", sql.Int, user.Id).input("reference", sql.NVarChar(80), `PV-${order}`).query("INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId) VALUES(@lot,'venta',@amount,@reference,@user)");
        pending -= amount;
      }
      if (pending > 0) throw new Error();
    }
    await request().input("order", sql.Int, order).input("company", sql.Int, user.EmpresaId).query("UPDATE importadora.PedidosVenta SET Estado='confirmado',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@order AND EmpresaId=@company");
    await transaction.commit();
  } catch { await transaction.rollback().catch(() => {}); return; }
  revalidatePath(`/panel/pedidos/${order}`); revalidatePath("/panel/pedidos"); revalidatePath("/panel/inventario");
}
export async function registerPayment(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("cobros.administrar"),order=Number(data.get("order")),amount=Number(data.get("amount")),date=String(data.get("date")??""),currency=String(data.get("currency")??""),method=String(data.get("method")??""),files=paymentFiles(data);if(!Number.isInteger(order)||!Number.isFinite(amount)||amount<=0||!date||!/^[A-Z]{3}$/.test(currency)||!["efectivo","pago_movil","transferencia","zelle","punto_venta","otro"].includes(method))return{message:"Completa los datos del cobro."};if(files.some(file=>!validPaymentFile(file)))return{message:"Adjunta solo JPG, PNG, WebP o PDF de máximo 8 MB."};try{const created=await(await db()).request().input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).input("amount",sql.Decimal(19,4),amount).input("date",sql.Date,date).input("currency",sql.Char(3),currency).input("method",sql.VarChar(20),method).input("reference",sql.NVarChar(100),text(data,"reference",100)||null).input("notes",sql.NVarChar(300),text(data,"notes",300)||null).input("user",sql.Int,user.Id).query("INSERT importadora.CobrosPedido(PedidoVentaId,Fecha,Monto,MonedaCodigo,Metodo,Referencia,Notas,RegistradoPorUsuarioId) OUTPUT INSERTED.Id SELECT @order,@date,@amount,@currency,@method,@reference,@notes,@user WHERE EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado')");const paymentId=created.recordset[0]?.Id;if(!paymentId)return{message:"El pedido ya no permite registrar cobros."};await savePaymentAttachments(paymentId,files,user.Id);}catch{return{message:"No se pudo registrar el cobro o sus comprobantes."}}revalidatePath(`/panel/pedidos/${order}`);return{success:true,message:files.length?"Cobro y comprobantes registrados.":"Cobro registrado."}}
export async function cancelSaleOrder(data:FormData){const user=await requireUser("pedidos.administrar"),order=Number(data.get("id"));if(!Number.isInteger(order))return;const pool=await db(),t=new sql.Transaction(pool);await t.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);try{const request=()=>new sql.Request(t),valid=await request().input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("SELECT Id FROM importadora.PedidosVenta WITH(UPDLOCK,HOLDLOCK) WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado' AND NOT EXISTS(SELECT 1 FROM importadora.CobrosPedido WHERE PedidoVentaId=@order)");if(!valid.recordset[0])throw new Error();const rows=(await request().input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("SELECT a.LoteId,a.Cantidad FROM importadora.VentaLoteAsignaciones a JOIN importadora.PedidoVentaDetalles d ON d.Id=a.PedidoVentaDetalleId JOIN importadora.PedidosVenta p ON p.Id=d.PedidoVentaId WHERE d.PedidoVentaId=@order AND p.EmpresaId=@company")).recordset;for(const row of rows){await request().input("lot",sql.Int,row.LoteId).input("quantity",sql.Decimal(19,4),row.Cantidad).query("UPDATE importadora.InventarioLotes SET CantidadDisponible=CantidadDisponible+@quantity WHERE Id=@lot");await request().input("lot",sql.Int,row.LoteId).input("quantity",sql.Decimal(19,4),row.Cantidad).input("user",sql.Int,user.Id).input("reference",sql.NVarChar(80),`Anulación PV-${order}`).query("INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId) VALUES(@lot,'ajuste_entrada',@quantity,@reference,@user)");}await request().input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("UPDATE importadora.PedidosVenta SET Estado='cancelado',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@order AND EmpresaId=@company");await t.commit();}catch{await t.rollback();return;}revalidatePath(`/panel/pedidos/${order}`);revalidatePath("/panel/pedidos");revalidatePath("/panel/inventario");revalidatePath("/panel/reportes");}
export async function updateCustomer(data:FormData){const actor=await requireUser("clientes.administrar");const id=Number(data.get("id")),code=text(data,"code",20).toUpperCase(),type=text(data,"type",12),name=text(data,"name",160),document=text(data,"document",30).toUpperCase(),email=text(data,"email",254).toLowerCase();if(!Number.isInteger(id)||!/^[A-Z0-9_-]{2,20}$/.test(code)||!["natural","empresa"].includes(type)||name.length<2)return;await(await db()).request().input("id",sql.Int,id).input("company",sql.Int,actor.EmpresaId).input("code",sql.VarChar(20),code).input("type",sql.VarChar(12),type).input("name",sql.NVarChar(160),name).input("document",sql.VarChar(30),document||null).input("phone",sql.NVarChar(40),text(data,"phone",40)||null).input("email",sql.NVarChar(254),email||null).input("address",sql.NVarChar(300),text(data,"address",300)||null).input("notes",sql.NVarChar(500),text(data,"notes",500)||null).query("UPDATE importadora.Clientes SET Codigo=@code,Tipo=@type,Nombre=@name,Documento=@document,Telefono=@phone,Email=@email,Direccion=@address,Notas=@notes,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id AND EmpresaId=@company");revalidatePath("/panel/clientes");revalidatePath(`/panel/clientes/${id}`);}
export async function deleteCustomer(data:FormData){const actor=await requireUser("clientes.administrar");const id=Number(data.get("id"));if(!Number.isInteger(id))return;await(await db()).request().input("id",sql.Int,id).input("company",sql.Int,actor.EmpresaId).query("IF NOT EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE ClienteId=@id AND EmpresaId=@company) DELETE FROM importadora.Clientes WHERE Id=@id AND EmpresaId=@company; ELSE UPDATE importadora.Clientes SET Activo=0,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id AND EmpresaId=@company");revalidatePath("/panel/clientes");}
export async function updatePayment(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("cobros.administrar");const id=Number(data.get("id")),order=Number(data.get("order")),amount=Number(data.get("amount")),date=String(data.get("date")??""),method=String(data.get("method")??"");if(!Number.isInteger(id)||!Number.isInteger(order)||!Number.isFinite(amount)||amount<=0||!date)return{message:"Revisa los datos del cobro."};try{await(await db()).request().input("id",sql.BigInt,id).input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).input("amount",sql.Decimal(19,4),amount).input("date",sql.Date,date).input("method",sql.VarChar(20),method).input("reference",sql.NVarChar(100),text(data,"reference",100)||null).query("UPDATE c SET Fecha=@date,Monto=@amount,Metodo=@method,Referencia=@reference FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Id=@id AND c.PedidoVentaId=@order AND p.EmpresaId=@company");}catch{return{message:"No se pudo actualizar el cobro."}}revalidatePath(`/panel/pedidos/${order}`);revalidatePath("/panel/reportes");return{success:true,message:"Cobro actualizado."}}
export async function addPaymentAttachments(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("cobros.administrar"),payment=Number(data.get("payment")),order=Number(data.get("order")),files=paymentFiles(data);if(!Number.isInteger(payment)||!Number.isInteger(order)||!files.length)return{message:"Selecciona al menos un comprobante."};if(files.some(file=>!validPaymentFile(file)))return{message:"Adjunta solo JPG, PNG, WebP o PDF de máximo 8 MB."};try{const exists=await(await db()).request().input("payment",sql.BigInt,payment).input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("SELECT c.Id FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Id=@payment AND c.PedidoVentaId=@order AND p.EmpresaId=@company");if(!exists.recordset[0])return{message:"El cobro no existe."};await savePaymentAttachments(payment,files,user.Id);}catch{return{message:"No se pudieron guardar los comprobantes."}}revalidatePath(`/panel/pedidos/${order}`);return{success:true,message:"Comprobante(s) guardado(s)."}}
export async function deletePaymentAttachment(data:FormData){const user=await requireUser("cobros.administrar");const id=Number(data.get("id")),payment=Number(data.get("payment")),order=Number(data.get("order"));if(!Number.isInteger(id)||!Number.isInteger(payment)||!Number.isInteger(order))return;await(await db()).request().input("id",sql.BigInt,id).input("payment",sql.BigInt,payment).input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("DELETE a FROM importadora.CobroAdjuntos a JOIN importadora.CobrosPedido c ON c.Id=a.CobroPedidoId JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE a.Id=@id AND a.CobroPedidoId=@payment AND c.PedidoVentaId=@order AND p.EmpresaId=@company");revalidatePath(`/panel/pedidos/${order}`)}
export async function deletePayment(data:FormData){const user=await requireUser("cobros.administrar");const id=Number(data.get("id")),order=Number(data.get("order"));if(!Number.isInteger(id)||!Number.isInteger(order))return;await(await db()).request().input("id",sql.BigInt,id).input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).query("DELETE a FROM importadora.CobroAdjuntos a JOIN importadora.CobrosPedido c ON c.Id=a.CobroPedidoId JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Id=@id AND c.PedidoVentaId=@order AND p.EmpresaId=@company; DELETE c FROM importadora.CobrosPedido c JOIN importadora.PedidosVenta p ON p.Id=c.PedidoVentaId WHERE c.Id=@id AND c.PedidoVentaId=@order AND p.EmpresaId=@company");revalidatePath(`/panel/pedidos/${order}`);revalidatePath("/panel/reportes");}
export async function registerDelivery(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("entregas.administrar"),order=Number(data.get("order")),date=String(data.get("date")??""),method=String(data.get("method")??"");if(!Number.isInteger(order)||!date||!["retiro","delivery","encomienda","otro"].includes(method))return{message:"Completa fecha y método de entrega."};try{await(await db()).request().input("order",sql.Int,order).input("company",sql.Int,user.EmpresaId).input("date",sql.Date,date).input("method",sql.VarChar(20),method).input("responsible",sql.NVarChar(120),text(data,"responsible",120)||null).input("reference",sql.NVarChar(120),text(data,"reference",120)||null).input("notes",sql.NVarChar(300),text(data,"notes",300)||null).input("user",sql.Int,user.Id).query("INSERT importadora.EntregasPedido(PedidoVentaId,Fecha,Metodo,Responsable,Referencia,Notas,RegistradoPorUsuarioId) SELECT @order,@date,@method,@responsible,@reference,@notes,@user WHERE EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE Id=@order AND EmpresaId=@company AND Estado='confirmado')");}catch{return{message:"No se pudo registrar; el pedido puede estar ya entregado."}}revalidatePath(`/panel/pedidos/${order}`);return{success:true,message:"Entrega registrada."}}
