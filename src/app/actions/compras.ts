"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import type { FormState } from "./auth";
export async function createPurchase(_:FormState,data:FormData):Promise<FormState>{const user=await requireUser("compras.administrar"),provider=Number(data.get("provider")),currency=String(data.get("currency")),date=String(data.get("date")),suggestedProduct=Number(data.get("suggestedProduct"));if(!provider||!date||!currency)return{message:"Completa proveedor, fecha y moneda."};let orderId:number;try{const pool=await db();const validProvider=await pool.request().input("provider",sql.Int,provider).input("company",sql.Int,user.EmpresaId).query("SELECT Id FROM importadora.Proveedores WHERE Id=@provider AND EmpresaId=@company AND Activo=1");if(!validProvider.recordset[0])return{message:"El proveedor seleccionado no pertenece a la empresa activa."};const n=await pool.request().query("SELECT ISNULL(MAX(Id),0)+1 N FROM importadora.OrdenesCompra");const number=`OC-${String(n.recordset[0].N).padStart(6,"0")}`;const created=await pool.request().input("company",sql.Int,user.EmpresaId).input("number",sql.VarChar(30),number).input("provider",sql.Int,provider).input("date",sql.Date,date).input("currency",sql.Char(3),currency).input("notes",sql.NVarChar(1000),String(data.get("notes")??"")||null).input("user",sql.Int,user.Id).query("INSERT importadora.OrdenesCompra(EmpresaId,Numero,ProveedorId,Fecha,MonedaCodigo,Observaciones,CreadoPorUsuarioId) OUTPUT INSERTED.Id VALUES(@company,@number,@provider,@date,@currency,@notes,@user)");orderId=created.recordset[0].Id;}catch{return{message:"No se pudo crear la orden."}}revalidatePath("/panel/compras");if(Number.isInteger(suggestedProduct)&&suggestedProduct>0)redirect(`/panel/compras/${orderId}?producto=${suggestedProduct}`);return{success:true,message:"Orden creada."}}
export async function addPurchaseLine(_:FormState,d:FormData):Promise<FormState>{const user=await requireUser("compras.administrar");const o=Number(d.get("order")),p=Number(d.get("product")),q=Number(d.get("quantity")),c=Number(d.get("cost"));if(!Number.isInteger(o)||!Number.isInteger(p)||!Number.isFinite(q)||!Number.isFinite(c)||q<=0||c<0)return{message:"Revisa producto, cantidad y costo."};try{const added=await(await db()).request().input("company",sql.Int,user.EmpresaId).input("o",sql.Int,o).input("p",sql.Int,p).input("q",sql.Decimal(19,4),q).input("c",sql.Decimal(19,4),c).query("INSERT importadora.OrdenCompraDetalles(OrdenCompraId,ProductoId,Cantidad,CostoUnitario) SELECT @o,@p,@q,@c WHERE EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@o AND EmpresaId=@company AND Estado='borrador') AND EXISTS(SELECT 1 FROM importadora.Productos WHERE Id=@p AND EmpresaId=@company AND Activo=1)");if(!added.rowsAffected[0])return{message:"La orden ya no se puede modificar o el producto no está disponible."};}catch{return{message:"No se pudo agregar; el producto ya está en la orden."}}revalidatePath(`/panel/compras/${o}`);return{success:true,message:"Producto agregado."}}
export async function deletePurchaseLine(d:FormData){const user=await requireUser("compras.administrar");const id=Number(d.get("id")),o=Number(d.get("order"));if(!Number.isInteger(id)||!Number.isInteger(o))return;await(await db()).request().input("id",sql.Int,id).input("o",sql.Int,o).input("company",sql.Int,user.EmpresaId).query("DELETE d FROM importadora.OrdenCompraDetalles d JOIN importadora.OrdenesCompra o ON o.Id=d.OrdenCompraId WHERE d.Id=@id AND d.OrdenCompraId=@o AND o.EmpresaId=@company AND o.Estado='borrador'");revalidatePath(`/panel/compras/${o}`)}
export async function deletePurchase(d:FormData){const user=await requireUser("compras.administrar");const id=Number(d.get("id"));const p=await db();await p.request().input("id",sql.Int,id).input("company",sql.Int,user.EmpresaId).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND EmpresaId=@company AND Estado='borrador') BEGIN DELETE FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id; DELETE FROM importadora.OrdenesCompra WHERE Id=@id AND EmpresaId=@company; END");revalidatePath("/panel/compras")}
export async function confirmPurchase(d:FormData){const user=await requireUser("compras.administrar");const id=Number(d.get("id")),p=await db();await p.request().input("id",sql.Int,id).input("company",sql.Int,user.EmpresaId).query("IF EXISTS(SELECT 1 FROM importadora.OrdenesCompra WHERE Id=@id AND EmpresaId=@company AND Estado='borrador') AND EXISTS(SELECT 1 FROM importadora.OrdenCompraDetalles WHERE OrdenCompraId=@id) BEGIN UPDATE importadora.OrdenesCompra SET Estado='confirmada',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id AND EmpresaId=@company; INSERT importadora.Importaciones(OrdenCompraId,Codigo) SELECT Id,CONCAT('IMP-',RIGHT('000000'+CONVERT(varchar(6),Id),6)) FROM importadora.OrdenesCompra WHERE Id=@id AND EmpresaId=@company; END");revalidatePath(`/panel/compras/${id}`);revalidatePath("/panel/compras")}
export async function updateImport(d:FormData){const user=await requireUser("compras.administrar");const id=Number(d.get("id")),state=String(d.get("state")),shipping=String(d.get("shipping"));if(!Number.isInteger(id)||!["preparacion","en_transito","aduana"].includes(state)||!["maritimo","aereo","terrestre"].includes(shipping))return;await(await db()).request().input("id",sql.Int,id).input("company",sql.Int,user.EmpresaId).input("agent",sql.NVarChar(150),String(d.get("agent")??"")||null).input("box",sql.NVarChar(150),String(d.get("box")??"")||null).input("guide",sql.NVarChar(100),String(d.get("guide")??"")||null).input("state",sql.VarChar(15),state).input("shipping",sql.VarChar(10),shipping).input("out",sql.Date,String(d.get("out")||"")||null).input("eta",sql.Date,String(d.get("eta")||"")||null).input("arrival",sql.Date,String(d.get("arrival")||"")||null).query("UPDATE i SET AgenteCarga=@agent,Casillero=@box,GuiaContenedor=@guide,Estado=CASE WHEN i.Estado='recibida' THEN i.Estado ELSE @state END,TipoEnvio=@shipping,FechaSalida=@out,FechaEstimadaLlegada=@eta,FechaLlegada=@arrival FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId WHERE i.Id=@id AND o.EmpresaId=@company");revalidatePath(`/panel/importaciones/${id}`);revalidatePath("/panel/importaciones")}



export async function addImportExpense(data: FormData) {
  const user=await requireUser("compras.administrar");
  const importId = Number(data.get("importId")), amount = Number(data.get("amount"));
  const concept = String(data.get("concept") ?? "").trim(), currency = String(data.get("currency") ?? "");
  const date = String(data.get("date") ?? ""), rateRaw = String(data.get("rate") ?? "").trim();
  const rate = rateRaw ? Number(rateRaw) : null;
  if (!importId || !concept || !currency || !date || !Number.isFinite(amount) || amount < 0 || (rate !== null && (!Number.isFinite(rate) || rate <= 0))) return;
  await (await db()).request().input("importId", sql.Int, importId).input("company",sql.Int,user.EmpresaId).input("concept", sql.NVarChar(120), concept).input("amount", sql.Decimal(19, 4), amount).input("currency", sql.Char(3), currency).input("date", sql.Date, date).input("rate", sql.Decimal(19, 6), rate).query("INSERT importadora.ImportacionGastos(ImportacionId,Concepto,Monto,MonedaCodigo,Fecha,TasaBCV) SELECT @importId,@concept,@amount,@currency,@date,@rate WHERE EXISTS(SELECT 1 FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId WHERE i.Id=@importId AND o.EmpresaId=@company)");
  revalidatePath(`/panel/importaciones/${importId}`);
}

export async function deleteImportExpense(data: FormData) {
  const user=await requireUser("compras.administrar");
  const id = Number(data.get("id")), importId = Number(data.get("importId"));
  await (await db()).request().input("id", sql.Int, id).input("importId", sql.Int, importId).input("company",sql.Int,user.EmpresaId).query("DELETE g FROM importadora.ImportacionGastos g JOIN importadora.Importaciones i ON i.Id=g.ImportacionId JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId WHERE g.Id=@id AND g.ImportacionId=@importId AND o.EmpresaId=@company");
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
    const header = await request().input("importId", sql.Int, importId).input("company",sql.Int,user.EmpresaId).query(`
      SELECT i.Id,i.Estado,o.MonedaCodigo
      FROM importadora.Importaciones i WITH(UPDLOCK,HOLDLOCK)
      JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId
      WHERE i.Id=@importId AND o.EmpresaId=@company`);
    const importation = header.recordset[0];
    if (!importation || importation.Estado !== "aduana") throw new Error("Estado de importación no permitido.");

    const warehouse = await request().input("warehouseId", sql.Int, warehouseId).input("company",sql.Int,user.EmpresaId)
      .query("SELECT Id FROM importadora.Almacenes WHERE Id=@warehouseId AND EmpresaId=@company AND Activo=1");
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
    await request().input("userId", sql.Int, user.Id).input("company",sql.Int,user.EmpresaId).input("importId", sql.Int, importId).query(`
      INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle)
      VALUES(@company,@userId,'importacion.recepcion',@importId,N'Recepción de importación registrada e inventario creado.')`);
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
    const lotResult = await request().input("lotId", sql.Int, lotId).input("company",sql.Int,user.EmpresaId).query(`
      SELECT l.Id,l.CantidadDisponible FROM importadora.InventarioLotes l WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Productos p ON p.Id=l.ProductoId WHERE l.Id=@lotId AND p.EmpresaId=@company`);
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
    await request().input("userId", sql.Int, user.Id).input("company",sql.Int,user.EmpresaId).input("lotId", sql.Int, lotId).input("detail", sql.NVarChar(500), `${type}: ${quantity}. ${reason}`).query(`
      INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle)
      VALUES(@company,@userId,'inventario.ajuste',@lotId,@detail)`);
    await transaction.commit();
  } catch {
    await transaction.rollback();
    return { message: "No se pudo aplicar el ajuste. Verifica la existencia disponible." };
  }
  revalidatePath("/panel/inventario");
  return { success: true, message: "Ajuste aplicado y registrado en el historial." };
}

export async function transferInventoryLot(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("inventario.administrar");
  const lotId = Number(data.get("lotId"));
  const destinationWarehouseId = Number(data.get("destinationWarehouseId"));
  const quantity = Number(data.get("quantity"));
  const notes = String(data.get("notes") ?? "").trim();
  if (!Number.isInteger(lotId) || !Number.isInteger(destinationWarehouseId) || !Number.isFinite(quantity) || quantity <= 0 || notes.length > 300)
    return { message: "Completa un almacén de destino y una cantidad válida." };

  const pool = await db();
  const transaction = new sql.Transaction(pool);
  let transferNumber = "";
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const sourceResult = await request().input("lotId", sql.Int, lotId).input("company",sql.Int,user.EmpresaId).query(`
      SELECT Id,AlmacenId,ProductoId,ImportacionId,RecepcionDetalleId,CantidadDisponible,CostoUnitarioAterrizado,MonedaCodigo
      FROM importadora.InventarioLotes l WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Productos p ON p.Id=l.ProductoId WHERE l.Id=@lotId AND p.EmpresaId=@company`);
    const source = sourceResult.recordset[0];
    if (!source || quantity > Number(source.CantidadDisponible)) throw new Error("No hay disponibilidad suficiente.");
    if (Number(source.AlmacenId) === destinationWarehouseId) throw new Error("El destino debe ser otro almacén.");

    const destination = await request().input("warehouseId", sql.Int, destinationWarehouseId).input("company",sql.Int,user.EmpresaId).query(`
      SELECT Id,Nombre FROM importadora.Almacenes WITH(UPDLOCK,HOLDLOCK) WHERE Id=@warehouseId AND EmpresaId=@company AND Activo=1`);
    if (!destination.recordset[0]) throw new Error("El almacén destino no está disponible.");

    const next = await request().query(`SELECT ISNULL(MAX(Id),0)+1 AS NextId FROM importadora.TransferenciasInventario WITH(TABLOCKX)`);
    transferNumber = `TR-${String(next.recordset[0].NextId).padStart(6, "0")}`;
    const transfer = await request().input("number", sql.VarChar(30), transferNumber).input("sourceLotId", sql.Int, lotId)
      .input("sourceWarehouseId", sql.Int, source.AlmacenId).input("destinationWarehouseId", sql.Int, destinationWarehouseId)
      .input("quantity", sql.Decimal(19, 4), quantity).input("notes", sql.NVarChar(300), notes || null).input("userId", sql.Int, user.Id).query(`
        INSERT importadora.TransferenciasInventario(Numero,LoteOrigenId,AlmacenOrigenId,AlmacenDestinoId,Cantidad,Observaciones,CreadoPorUsuarioId)
        OUTPUT INSERTED.Id VALUES(@number,@sourceLotId,@sourceWarehouseId,@destinationWarehouseId,@quantity,@notes,@userId)`);
    const transferId = transfer.recordset[0].Id;

    await request().input("lotId", sql.Int, lotId).input("quantity", sql.Decimal(19, 4), quantity).query(`
      UPDATE importadora.InventarioLotes SET CantidadDisponible=CantidadDisponible-@quantity WHERE Id=@lotId`);
    const destinationLot = await request().input("warehouseId", sql.Int, destinationWarehouseId).input("productId", sql.Int, source.ProductoId)
      .input("importId", sql.Int, source.ImportacionId).input("receiptDetailId", sql.Int, source.RecepcionDetalleId)
      .input("quantity", sql.Decimal(19, 4), quantity).input("cost", sql.Decimal(19, 4), source.CostoUnitarioAterrizado)
      .input("currency", sql.Char(3), source.MonedaCodigo).query(`
        INSERT importadora.InventarioLotes(AlmacenId,ProductoId,ImportacionId,RecepcionDetalleId,CantidadInicial,CantidadDisponible,CostoUnitarioAterrizado,MonedaCodigo)
        OUTPUT INSERTED.Id VALUES(@warehouseId,@productId,@importId,@receiptDetailId,@quantity,@quantity,@cost,@currency)`);
    const destinationLotId = destinationLot.recordset[0].Id;

    await request().input("transferId", sql.BigInt, transferId).input("destinationLotId", sql.Int, destinationLotId).query(`
      UPDATE importadora.TransferenciasInventario SET LoteDestinoId=@destinationLotId WHERE Id=@transferId`);
    await request().input("sourceLotId", sql.Int, lotId).input("destinationLotId", sql.Int, destinationLotId)
      .input("quantity", sql.Decimal(19, 4), quantity).input("reference", sql.NVarChar(80), transferNumber).input("userId", sql.Int, user.Id).query(`
        INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId)
        VALUES(@sourceLotId,'transferencia',-@quantity,@reference,@userId),(@destinationLotId,'transferencia',@quantity,@reference,@userId)`);
    await request().input("userId", sql.Int, user.Id).input("company",sql.Int,user.EmpresaId).input("transferId", sql.BigInt, transferId)
      .input("detail", sql.NVarChar(500), `Transferencia ${transferNumber}: lote ${lotId} a almacén ${destinationWarehouseId}, cantidad ${quantity}. ${notes}`).query(`
        INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle)
        VALUES(@company,@userId,'inventario.transferencia',@transferId,@detail)`);
    await transaction.commit();
  } catch {
    await transaction.rollback().catch(() => {});
    return { message: "No se pudo transferir. Verifica el almacén destino y la existencia disponible." };
  }
  revalidatePath("/panel/inventario");
  revalidatePath("/panel");
  revalidatePath("/panel/alertas");
  return { success: true, message: `Transferencia ${transferNumber} registrada.` };
}

export async function startInventoryCount(data: FormData) {
  const user = await requireUser("inventario.administrar"), warehouseId = Number(data.get("warehouseId"));
  const date = String(data.get("date") ?? ""), notes = String(data.get("notes") ?? "").trim();
  if (!Number.isInteger(warehouseId) || !date || notes.length > 300) return;
  const pool = await db(), transaction = new sql.Transaction(pool);
  let id = 0;
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const warehouse = await request().input("warehouse", sql.Int, warehouseId).input("company",sql.Int,user.EmpresaId).query("SELECT Id FROM importadora.Almacenes WITH(UPDLOCK,HOLDLOCK) WHERE Id=@warehouse AND EmpresaId=@company AND Activo=1");
    if (!warehouse.recordset[0]) throw new Error();
    const next = await request().query("SELECT ISNULL(MAX(Id),0)+1 NextId FROM importadora.ConteosInventario WITH(TABLOCKX)");
    const created = await request().input("number", sql.VarChar(30), `CI-${String(next.recordset[0].NextId).padStart(6, "0")}`).input("warehouse", sql.Int, warehouseId).input("date", sql.Date, date).input("notes", sql.NVarChar(300), notes || null).input("user", sql.Int, user.Id).query("INSERT importadora.ConteosInventario(Numero,AlmacenId,Fecha,Observaciones,CreadoPorUsuarioId) OUTPUT INSERTED.Id VALUES(@number,@warehouse,@date,@notes,@user)");
    id = created.recordset[0].Id;
    await request().input("count", sql.BigInt, id).input("warehouse", sql.Int, warehouseId).query("INSERT importadora.ConteoInventarioDetalles(ConteoId,LoteId,CantidadSistema) SELECT @count,Id,CantidadDisponible FROM importadora.InventarioLotes WHERE AlmacenId=@warehouse AND CantidadDisponible>0");
    await transaction.commit();
  } catch { await transaction.rollback().catch(() => {}); return; }
  redirect(`/panel/inventario/conteos/${id}`);
}

export async function saveInventoryCountLine(data: FormData) {
  const user=await requireUser("inventario.administrar");
  const countId = Number(data.get("countId")), lineId = Number(data.get("lineId")), physical = Number(data.get("physical"));
  if (!Number.isInteger(countId) || !Number.isInteger(lineId) || !Number.isFinite(physical) || physical < 0) return;
  await (await db()).request().input("count", sql.BigInt, countId).input("line", sql.BigInt, lineId).input("company",sql.Int,user.EmpresaId).input("physical", sql.Decimal(19,4), physical).query("UPDATE d SET CantidadFisica=@physical FROM importadora.ConteoInventarioDetalles d JOIN importadora.ConteosInventario c ON c.Id=d.ConteoId JOIN importadora.Almacenes a ON a.Id=c.AlmacenId WHERE d.Id=@line AND d.ConteoId=@count AND a.EmpresaId=@company AND c.Estado='borrador'");
  revalidatePath(`/panel/inventario/conteos/${countId}`);
}

export async function applyInventoryCount(data: FormData) {
  const user = await requireUser("inventario.administrar"), countId = Number(data.get("countId"));
  if (!Number.isInteger(countId)) return;
  const pool = await db(), transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = () => new sql.Request(transaction);
    const header = await request().input("count", sql.BigInt, countId).input("company",sql.Int,user.EmpresaId).query("SELECT c.* FROM importadora.ConteosInventario c WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Almacenes a ON a.Id=c.AlmacenId WHERE c.Id=@count AND a.EmpresaId=@company AND c.Estado='borrador'");
    const count = header.recordset[0]; if (!count) throw new Error();
    const lines = (await request().input("count", sql.BigInt, countId).query("SELECT d.*,l.CantidadDisponible FROM importadora.ConteoInventarioDetalles d JOIN importadora.InventarioLotes l WITH(UPDLOCK,HOLDLOCK) ON l.Id=d.LoteId WHERE d.ConteoId=@count")).recordset;
    if (!lines.length || lines.some((line) => line.CantidadFisica === null || Number(line.CantidadDisponible) !== Number(line.CantidadSistema))) throw new Error();
    for (const line of lines) { const diff = Number(line.CantidadFisica)-Number(line.CantidadSistema); if (!diff) continue; const type = diff>0 ? "ajuste_entrada" : "ajuste_salida"; await request().input("lot",sql.Int,line.LoteId).input("physical",sql.Decimal(19,4),line.CantidadFisica).query("UPDATE importadora.InventarioLotes SET CantidadDisponible=@physical WHERE Id=@lot"); await request().input("lot",sql.Int,line.LoteId).input("type",sql.VarChar(20),type).input("quantity",sql.Decimal(19,4),diff).input("reference",sql.NVarChar(80),count.Numero).input("user",sql.Int,user.Id).query("INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId) VALUES(@lot,@type,@quantity,@reference,@user)"); }
    await request().input("count",sql.BigInt,countId).input("company",sql.Int,user.EmpresaId).input("user",sql.Int,user.Id).query("UPDATE importadora.ConteosInventario SET Estado='aplicado',AplicadoPorUsuarioId=@user,AplicadoEn=SYSUTCDATETIME() WHERE Id=@count; INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) VALUES(@company,@user,'inventario.conteo.aplicado',@count,N'Conteo físico aplicado.')");
    await transaction.commit();
  } catch { await transaction.rollback().catch(() => {}); return; }
  revalidatePath(`/panel/inventario/conteos/${countId}`); revalidatePath("/panel/inventario"); revalidatePath("/panel/alertas");
}

export async function setWarehouseMinimum(data: FormData) {
  const user = await requireUser("inventario.administrar"), productId = Number(data.get("productId")), warehouseId = Number(data.get("warehouseId")), minimum = Number(data.get("minimum"));
  if (!Number.isInteger(productId) || !Number.isInteger(warehouseId) || !Number.isFinite(minimum) || minimum < 0) return;
  await (await db()).request().input("product",sql.Int,productId).input("warehouse",sql.Int,warehouseId).input("company",sql.Int,user.EmpresaId).input("minimum",sql.Decimal(19,4),minimum).input("user",sql.Int,user.Id).query(`MERGE importadora.ProductoAlmacenMinimos AS target USING (SELECT @product ProductoId,@warehouse AlmacenId WHERE EXISTS(SELECT 1 FROM importadora.Productos WHERE Id=@product AND EmpresaId=@company AND Activo=1) AND EXISTS(SELECT 1 FROM importadora.Almacenes WHERE Id=@warehouse AND EmpresaId=@company AND Activo=1)) source ON target.ProductoId=source.ProductoId AND target.AlmacenId=source.AlmacenId WHEN MATCHED THEN UPDATE SET CantidadMinima=@minimum,ActualizadoPorUsuarioId=@user,ActualizadoEn=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(ProductoId,AlmacenId,CantidadMinima,ActualizadoPorUsuarioId) VALUES(@product,@warehouse,@minimum,@user);`);
  revalidatePath("/panel/inventario"); revalidatePath("/panel/alertas"); revalidatePath("/panel");
}
