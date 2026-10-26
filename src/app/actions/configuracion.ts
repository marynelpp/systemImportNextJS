"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { fetchBcvUsdRate } from "@/lib/bcv";
import type { FormState } from "./auth";

const clean = (value: FormDataEntryValue | null, length: number) =>
  String(value ?? "").trim().slice(0, length);

export async function saveCompany(_: FormState, data: FormData): Promise<FormState> {
  const actor = await requireUser("configuracion.administrar");
  const legalName = clean(data.get("legalName"), 150);
  const tradeName = clean(data.get("tradeName"), 150);
  const rif = clean(data.get("rif"), 20);
  const phone = clean(data.get("phone"), 30);
  const email = clean(data.get("email"), 254).toLowerCase();
  const address = clean(data.get("address"), 300);
  if (legalName.length < 2 || (email && !/^\S+@\S+\.\S+$/.test(email)))
    return { message: "Indica el nombre legal y, si agregas correo, usa un formato válido." };
  try {
    const pool = await db();
    await pool.request()
      .input("name", sql.NVarChar(150), legalName)
      .input("trade", sql.NVarChar(150), tradeName || null)
      .input("rif", sql.NVarChar(20), rif || null)
      .input("phone", sql.NVarChar(30), phone || null)
      .input("email", sql.NVarChar(254), email || null)
      .input("address", sql.NVarChar(300), address || null)
      .input("actor", sql.Int, actor.Id).query(`
        SET XACT_ABORT ON; BEGIN TRANSACTION;
        IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo' AND (r.EsAdministrador=1 OR EXISTS(SELECT 1 FROM importadora.RolPermisos p WHERE p.RolId=u.RolId AND p.PermisoCodigo='configuracion.administrar'))) THROW 50030,'Acceso denegado',1;
        MERGE importadora.EmpresaConfiguracion WITH(HOLDLOCK) AS target
        USING (SELECT CAST(1 AS tinyint) Id) AS source ON target.Id=source.Id
        WHEN MATCHED THEN UPDATE SET NombreLegal=@name,NombreComercial=@trade,Rif=@rif,Telefono=@phone,Email=@email,Direccion=@address,ActualizadoPorUsuarioId=@actor,ActualizadoEn=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(Id,NombreLegal,NombreComercial,Rif,Telefono,Email,Direccion,ActualizadoPorUsuarioId) VALUES(1,@name,@trade,@rif,@phone,@email,@address,@actor);
        INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId) VALUES(@actor,'configuracion.empresa',1);
        COMMIT;`);
  } catch {
    return { message: "No se pudo guardar. Confirma que ejecutaste el script de configuración y que tu rol tiene permiso." };
  }
  revalidatePath("/panel/configuracion");
  return { success: true, message: "Datos de la empresa actualizados." };
}

export async function createWarehouse(_: FormState, data: FormData): Promise<FormState> {
  const actor = await requireUser("configuracion.administrar");
  const code = clean(data.get("code"), 20).toUpperCase();
  const name = clean(data.get("name"), 100);
  const address = clean(data.get("address"), 300);
  if (!/^[A-Z0-9_-]{2,20}$/.test(code) || name.length < 2)
    return { message: "El código usa entre 2 y 20 letras, números, guiones o guiones bajos." };
  try {
    const pool = await db();
    await pool.request().input("actor", sql.Int, actor.Id).input("code", sql.VarChar(20), code).input("name", sql.NVarChar(100), name).input("address", sql.NVarChar(300), address || null).query(`
      SET XACT_ABORT ON; BEGIN TRANSACTION;
      IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo' AND (r.EsAdministrador=1 OR EXISTS(SELECT 1 FROM importadora.RolPermisos p WHERE p.RolId=u.RolId AND p.PermisoCodigo='configuracion.administrar'))) THROW 50031,'Acceso denegado',1;
      INSERT importadora.Almacenes(Codigo,Nombre,Direccion) VALUES(@code,@name,@address);
      INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle) VALUES(@actor,'configuracion.almacen',CONVERT(int,SCOPE_IDENTITY()),@code);
      COMMIT;`);
  } catch {
    return { message: "No se pudo crear el almacén. El código debe ser único." };
  }
  revalidatePath("/panel/configuracion");
  return { success: true, message: "Almacén creado." };
}

export async function syncBcvRate(): Promise<FormState> {
  const actor = await requireUser("tasas.administrar");
  let bcv: { rate: number; date: string };
  try {
    bcv = await fetchBcvUsdRate();
  } catch {
    return { message: "No pudimos consultar la publicación del BCV. Conservamos la última tasa registrada; intenta nuevamente más tarde." };
  }
  try {
    const pool = await db();
    await pool.request().input("actor", sql.Int, actor.Id).input("date", sql.Date, bcv.date).input("rate", sql.Decimal(19, 6), bcv.rate).query(`
      SET XACT_ABORT ON; BEGIN TRANSACTION;
      IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo' AND (r.EsAdministrador=1 OR EXISTS(SELECT 1 FROM importadora.RolPermisos p WHERE p.RolId=u.RolId AND p.PermisoCodigo='tasas.administrar'))) THROW 50032,'Acceso denegado',1;
      MERGE importadora.TasasCambio WITH(HOLDLOCK) AS target
      USING (SELECT 'USD' MonedaBase,'VES' MonedaDestino,@date FechaVigencia) AS source ON target.MonedaBase=source.MonedaBase AND target.MonedaDestino=source.MonedaDestino AND target.FechaVigencia=source.FechaVigencia
      WHEN MATCHED THEN UPDATE SET Tasa=@rate,Fuente='BCV',Observacion=NULL,RegistradaPorUsuarioId=@actor,ActualizadoEn=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT(MonedaBase,MonedaDestino,FechaVigencia,Tasa,Fuente,Observacion,RegistradaPorUsuarioId) VALUES('USD','VES',@date,@rate,'BCV',NULL,@actor);
      INSERT importadora.Auditoria(UsuarioId,Accion,Detalle) VALUES(@actor,'tasa.bcv_sync',CONCAT(CONVERT(varchar(10),@date,23),' · ',CONVERT(varchar(30),@rate)));
      COMMIT;`);
  } catch {
    return { message: "El BCV respondió correctamente, pero no pudimos guardar la tasa. Confirma que ejecutaste el script de configuración y que tu rol tiene permiso." };
  }
  revalidatePath("/panel/configuracion");
  return { success: true, message: `Tasa BCV actualizada: 1 USD = Bs. ${bcv.rate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}. Vigencia: ${bcv.date}.` };
}
