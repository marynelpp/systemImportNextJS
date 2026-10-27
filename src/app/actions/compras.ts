"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import type { FormState } from "./auth";
export async function createPurchase(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("compras.administrar"),provider=Number(data.get("provider")),currency=String(data.get("currency")),date=String(data.get("date")),suggestedProduct=Number(data.get("suggestedProduct"));if(!provider||!date||!currency)return{message:"Completa proveedor, fecha y moneda."};let orderId:number;try{const pool=await db();const validProvider=await pool.request().input("provider",sql.Int,provider).query("SELECT Id FROM importadora.Proveedores WHERE Id=@provider AND Activo=1");if(!validProvider.recordset[0])return{message:"El proveedor seleccionado no está disponible."};const n=await pool.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.OrdenesCompra");const number=`OC-${String(n.recordset[0].N).padStart(6,"0")}`;const created=await pool.request().input("number",sql.VarChar(30),number).input("provider",sql.Int,provider).input("date",sql.Date,date).input("currency",sql.Char(3),currency).input("notes",sql.NVarChar(1000),String(data.get("notes")??"")||null).input("user",sql.Int,user.Id).query("INSERT importadora.OrdenesCompra(Numero,ProveedorId,Fecha,MonedaCodigo,Observaciones,CreadoPorUsuarioId) OUTPUT INSERTED.Id VALUES(@number,@provider,@date,@currency,@notes,@user)");orderId=created.recordset[0].Id;}catch{return{message:"No se pudo crear la orden."}}revalidatePath("/panel/compras");if(Number.isInteger(suggestedProduct)&&suggestedProduct>0)redirect(`/panel/compras/${orderId}?producto=${suggestedProduct}`);return{success:true,message:"Orden creada."}}
export async function addPurchaseLine(_:FormState,d:FormData):Promise<FormState>{await requireUser("compras.administrar");const o=Number(d.get("order")),p=Number(d.get("product")),q=Number(d.get("quantity")),c=Number(d.get("cost"));if(!Number.isInteger(o)||!Number.isInteger(p)||!Number.isFinite(q)||!Number.isFinite(c)||q<=0||c<0)return{message:"Revisa producto, cantidad y costo."};try{const added=await(await db()).request().input("o",sql.Int,o).input("p",sql.Int,p).input("q",sql.Decimal(19,4),q).input("c",sql.Decimal(19,4),c).query("INSERT importadora.OrdenCompraDetalles(OrdenCompraId,ProductoId,Cantidad,CostoUnitario) SELECT @o,@p,@q,@c WHERE EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@o AND Estado='borrador') AND EXISTS(SELECT 1 FROM importadora.Productos WHERE Id=@p AND Activo=1)");if(!added.rowsAffected[0])return{message:"La orden ya no se puede modificar o el producto no está disponible."};}catch{return{message:"No se pudo agregar; el producto ya está en la orden."}}revalidatePath(`/panel/compras/${o}`);return{success:true,message:"Producto agregado."}}
export async function deletePurchaseLine(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id")),o=Number(d.get("order"));if(!Number.isInteger(id)||!Number.isInteger(o))return;await(await db()).request().input("id",sql.Int,id).input("o",sql.Int,o).query("DELETE d FROM importadora.OrdenCompraDetalles d JOIN importadora.OrdenesCompra o ON o.Id=d.OrdenCompraId WHERE d.Id=@id AND d.OrdenCompraId=@o AND o.Estado='borrador'");revalidatePath(`/panel/compras/${o}`)}
export async function deletePurchase(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id"));const p=await db();await p.request().input("id",sql.Int,id).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND Estado='borrador') BEGIN DELETE FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id; DELETE FROM importadora.OrdenesCompra WHERE Id=@id; END");revalidatePath("/panel/compras")}
export async function confirmPurchase(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id")),p=await db();await p.request().input("id",sql.Int,id).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND Estado='borrador') AND EXISTS(SELECT 1 FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id) BEGIN UPDATE importadora.OrdenesCompra SET Estado='confirmada',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id; INSERT importadora.Importaciones(OrdenCompraId,Codigo) SELECT Id,CONCAT('IMP-',RIGHT('000000'+CONVERT(varchar(6),Id),6)) FROM importadora.OrdenesCompra WHERE Id=@id; END");revalidatePath(`/panel/compras/${id}`);revalidatePath("/panel/compras")}
export async function updateImport(d:FormData){await requireUser("compras.administrar");const id=Number(d.get("id")),state=String(d.get("state")),shipping=String(d.get("shipping"));if(!Number.isInteger(id)||!["preparacion","en_transito","aduana"].includes(state)||!["maritimo","aereo","terrestre"].includes(shipping))return;await(await db()).request().input("id",sql.Int,id).input("agent",sql.NVarChar(150),String(d.get("agent")??"")||null).input("box",sql.NVarChar(150),String(d.get("box")??"")||null).input("guide",sql.NVarChar(100),String(d.get("guide")??"")||null).input("state",sql.VarChar(15),state).input("shipping",sql.VarChar(10),shipping).input("out",sql.Date,String(d.get("out")||"")||null).input("eta",sql.Date,String(d.get("eta")||"")||null).input("arrival",sql.Date,String(d.get("arrival")||"")||null).query("UPDATE importadora.Importaciones SET AgenteCarga=@agent,Casillero=@box,GuiaContenedor=@guide,Estado=CASE WHEN Estado='recibida' THEN Estado ELSE @state END,TipoEnvio=@shipping,FechaSalida=@out,FechaEstimadaLlegada=@eta,FechaLlegada=@arrival WHERE Id=@id");revalidatePath(`/panel/importaciones/${id}`);revalidatePath("/panel/importaciones")}



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

export async function receiveImport(data: FormData) {
  const user = await requireUser("inventario.administrar");
  const importId = Number(data.get("importId"));
  const warehouseId = Number(data.get("warehouseId"));
  const date = String(data.get("date") ?? "");
  const notes = String(data.get("notes") ?? "").trim();
  if (!Number.isInteger(importId) || !Number.isInteger(warehouseId) || !date) return;

  const pool = await db();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const header = await request().input("importId", sql.Int, importId).query(`
      SELECT i.Id,i.Estado,o.MonedaCodigo
      FROM importadora.Importaciones i WITH(UPDLOCK,HOLDLOCK)
      JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId
      WHERE i.Id=@importId`);
    const importation = header.recordset[0];
    if (!importation || importation.Estado !== "aduana") throw new Error("Estado de importación no permitido.");

    const warehouse = await request().input("warehouseId", sql.Int, warehouseId)
      .query("SELECT Id FROM importadora.Almacenes WHERE Id=@warehouseId AND Activo=1");
    if (!warehouse.recordset[0]) throw new Error("Almacén inválido.");

    const linesResult = await request().input("importId", sql.Int, importId).query(`
      SELECT d.Id,d.ProductoId,d.Cantidad,d.CostoUnitario
      FROM importadora.Importaciones i
      JOIN importadora.OrdenCompraDetalles d ON d.OrdenCompraId=i.OrdenCompraId
      WHERE i.Id=@importId ORDER BY d.Id`);
    const lines = linesResult.recordset;
    if (!lines.length) throw new Error("La importación no tiene productos.");

    const received = lines.map((line) => {
      const quantity = Number(data.get(`received-${line.Id}`));
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > Number(line.Cantidad)) throw new Error("Las cantidades recibidas no son válidas.");
      return { ...line, received: quantity };
    });
    if (!received.some((line) => line.received > 0)) throw new Error("Registra al menos una unidad recibida.");

    const expenseResult = await request().input("importId", sql.Int, importId).query(`
      SELECT g.Monto,g.MonedaCodigo,g.TasaBCV,
        CASE WHEN g.MonedaCodigo=o.MonedaCodigo THEN g.Monto
             WHEN o.MonedaCodigo='USD' AND g.MonedaCodigo='VES' AND g.TasaBCV IS NOT NULL THEN g.Monto/g.TasaBCV
             ELSE NULL END MontoEnMonedaOrden
      FROM importadora.ImportacionGastos g
      JOIN importadora.Importaciones i ON i.Id=g.ImportacionId
      JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId
      WHERE g.ImportacionId=@importId`);
    if (expenseResult.recordset.some((expense) => expense.MontoEnMonedaOrden === null)) {
      throw new Error("Hay gastos sin conversión a la moneda de la orden.");
    }
    const totalExpenses = expenseResult.recordset.reduce((sum, expense) => sum + Number(expense.MontoEnMonedaOrden), 0);
    const goodsTotal = received.reduce((sum, line) => sum + Number(line.Cantidad) * Number(line.CostoUnitario), 0);
    if (goodsTotal <= 0) throw new Error("No se pudo calcular el costo de la mercancía.");

    const receipt = await request().input("importId", sql.Int, importId).input("warehouseId", sql.Int, warehouseId)
      .input("date", sql.Date, date).input("notes", sql.NVarChar(500), notes || null).input("userId", sql.Int, user.Id).query(`
        INSERT importadora.RecepcionesImportacion(ImportacionId,AlmacenId,Fecha,Observaciones,RecibidoPorUsuarioId)
        OUTPUT INSERTED.Id VALUES(@importId,@warehouseId,@date,@notes,@userId)`);
    const receiptId = receipt.recordset[0].Id;

    let assignedSoFar = 0;
    for (let index = 0; index < received.length; index += 1) {
      const line = received[index];
      const merchandiseCost = Number(line.Cantidad) * Number(line.CostoUnitario);
      const allocated = index === received.length - 1
        ? Number((totalExpenses - assignedSoFar).toFixed(4))
        : Number((totalExpenses * merchandiseCost / goodsTotal).toFixed(4));
      assignedSoFar += allocated;
      const landedTotal = Number((merchandiseCost + allocated).toFixed(4));
      const missing = Number(line.Cantidad) - line.received;
      const detail = await request().input("receiptId", sql.Int, receiptId).input("lineId", sql.Int, line.Id)
        .input("ordered", sql.Decimal(19, 4), line.Cantidad).input("received", sql.Decimal(19, 4), line.received)
        .input("missing", sql.Decimal(19, 4), missing).query(`
          INSERT importadora.RecepcionImportacionDetalles(RecepcionId,OrdenCompraDetalleId,CantidadPedida,CantidadRecibida,CantidadFaltante)
          OUTPUT INSERTED.Id VALUES(@receiptId,@lineId,@ordered,@received,@missing)`);
      await request().input("importId", sql.Int, importId).input("lineId", sql.Int, line.Id)
        .input("merchandise", sql.Decimal(19, 4), merchandiseCost).input("expenses", sql.Decimal(19, 4), allocated)
        .input("landed", sql.Decimal(19, 4), landedTotal).input("currency", sql.Char(3), importation.MonedaCodigo).query(`
          INSERT importadora.ImportacionCostoDistribuciones(ImportacionId,OrdenCompraDetalleId,CostoMercancia,GastosAsignados,CostoAterrizadoTotal,MonedaCodigo)
          VALUES(@importId,@lineId,@merchandise,@expenses,@landed,@currency)`);
      if (line.received > 0) {
        const lot = await request().input("warehouseId", sql.Int, warehouseId).input("productId", sql.Int, line.ProductoId)
          .input("importId", sql.Int, importId).input("receiptDetailId", sql.Int, detail.recordset[0].Id)
          .input("quantity", sql.Decimal(19, 4), line.received).input("unitCost", sql.Decimal(19, 4), landedTotal / line.received)
          .input("currency", sql.Char(3), importation.MonedaCodigo).query(`
            INSERT importadora.InventarioLotes(AlmacenId,ProductoId,ImportacionId,RecepcionDetalleId,CantidadInicial,CantidadDisponible,CostoUnitarioAterrizado,MonedaCodigo)
            OUTPUT INSERTED.Id VALUES(@warehouseId,@productId,@importId,@receiptDetailId,@quantity,@quantity,@unitCost,@currency)`);
        await request().input("lotId", sql.Int, lot.recordset[0].Id).input("quantity", sql.Decimal(19, 4), line.received)
          .input("reference", sql.NVarChar(80), `IMP-${importId}`).input("userId", sql.Int, user.Id).query(`
            INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId)
            VALUES(@lotId,'recepcion',@quantity,@reference,@userId)`);
      }
    }
    await request().input("importId", sql.Int, importId).query(`
      UPDATE i SET Estado='recibida',FechaLlegada=COALESCE(FechaLlegada,CONVERT(date,SYSUTCDATETIME()))
      FROM importadora.Importaciones i WHERE i.Id=@importId;
      UPDATE o SET Estado='recibida',ActualizadoEn=SYSUTCDATETIME()
      FROM importadora.OrdenesCompra o JOIN importadora.Importaciones i ON i.OrdenCompraId=o.Id WHERE i.Id=@importId;`);
    await request().input("userId", sql.Int, user.Id).input("importId", sql.Int, importId).query(`
      INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle)
      VALUES(@userId,'importacion.recepcion',@importId,N'Recepción de importación registrada e inventario creado.')`);
    await transaction.commit();
  } catch {
    await transaction.rollback();
    return;
  }
  revalidatePath(`/panel/importaciones/${importId}`);
  revalidatePath("/panel/importaciones");
  revalidatePath("/panel/compras");
}

export async function adjustInventory(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("inventario.administrar");
  const lotId = Number(data.get("lotId"));
  const type = String(data.get("type") ?? "");
  const quantity = Number(data.get("quantity"));
  const reason = String(data.get("reason") ?? "").trim();
  if (!Number.isInteger(lotId) || !["ajuste_entrada", "ajuste_salida"].includes(type) || !Number.isFinite(quantity) || quantity <= 0 || !reason) return { message: "Completa tipo, cantidad y motivo del ajuste." };

  const pool = await db();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const lotResult = await request().input("lotId", sql.Int, lotId).query(`
      SELECT Id,CantidadDisponible FROM importadora.InventarioLotes WITH(UPDLOCK,HOLDLOCK) WHERE Id=@lotId`);
    const lot = lotResult.recordset[0];
    if (!lot || (type === "ajuste_salida" && quantity > Number(lot.CantidadDisponible))) throw new Error("Ajuste inválido.");
    const signedQuantity = type === "ajuste_entrada" ? quantity : -quantity;
    await request().input("lotId", sql.Int, lotId).input("quantity", sql.Decimal(19, 4), signedQuantity).query(`
      UPDATE importadora.InventarioLotes SET CantidadDisponible=CantidadDisponible+@quantity WHERE Id=@lotId`);
    await request().input("lotId", sql.Int, lotId).input("type", sql.VarChar(20), type)
      .input("quantity", sql.Decimal(19, 4), signedQuantity).input("reference", sql.NVarChar(80), reason)
      .input("userId", sql.Int, user.Id).query(`
        INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId)
        VALUES(@lotId,@type,@quantity,@reference,@userId)`);
    await request().input("userId", sql.Int, user.Id).input("lotId", sql.Int, lotId).input("detail", sql.NVarChar(500), `${type}: ${quantity}. ${reason}`).query(`
      INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle)
      VALUES(@userId,'inventario.ajuste',@lotId,@detail)`);
    await transaction.commit();
  } catch {
    await transaction.rollback();
    return { message: "No se pudo aplicar el ajuste. Verifica la existencia disponible." };
  }
  revalidatePath("/panel/inventario");
  return { success: true, message: "Ajuste aplicado y registrado en el historial." };
}
