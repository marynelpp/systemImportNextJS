"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser, digest, SESSION_COOKIE } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { FormState } from "./auth";

export type CompanySetupState = FormState & { inviteUrl?: string };

export async function changeActiveCompany(data: FormData) {
  const user=await currentUser(), company=Number(data.get("companyId"));
  if(!user||!Number.isInteger(company)) return;
  const token=(await cookies()).get(SESSION_COOKIE)?.value; if(!token) return;
  await (await db()).request().input("token",sql.Char(64),digest(token)).input("user",sql.Int,user.Id).input("company",sql.Int,company).query("UPDATE s SET EmpresaId=@company FROM importadora.Sesiones s JOIN importadora.Usuarios u ON u.Id=s.UsuarioId WHERE s.TokenHash=@token AND s.UsuarioId=@user AND EXISTS(SELECT 1 FROM importadora.Empresas e WHERE e.Id=@company AND e.Activa=1) AND (u.EsAdministradorSistema=1 OR EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue WHERE ue.UsuarioId=@user AND ue.EmpresaId=@company AND ue.Activo=1))");
  revalidatePath("/panel","layout");
}

export async function createCompanyWithAdmin(_: CompanySetupState, data: FormData): Promise<CompanySetupState> {
  const actor = await currentUser();
  if (!actor?.EsAdministradorSistema) return { message: "Solo el administrador global puede crear empresas." };
  const code = String(data.get("code") ?? "").trim().toUpperCase();
  const legalName = String(data.get("legalName") ?? "").trim();
  const tradeName = String(data.get("tradeName") ?? "").trim();
  const adminName = String(data.get("adminName") ?? "").trim();
  const adminEmail = String(data.get("adminEmail") ?? "").trim().toLowerCase();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code) || legalName.length < 2 || adminName.length < 2 || !/^\S+@\S+\.\S+$/.test(adminEmail)) return { message: "Revisa el código, los nombres y el correo del administrador." };
  if (adminEmail === "perazaperozo@gmail.com") return { message: "Ese correo está reservado para el administrador global." };
  const token = randomBytes(32).toString("hex"), placeholderHash = await hashPassword(randomBytes(32).toString("hex"));
  const pool = await db(), transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const result = await new sql.Request(transaction).input("actor", sql.Int, actor.Id).input("code", sql.VarChar(20), code).input("legal", sql.NVarChar(150), legalName).input("trade", sql.NVarChar(150), tradeName || null).input("adminName", sql.NVarChar(100), adminName).input("email", sql.NVarChar(254), adminEmail).input("password", sql.VarChar(200), placeholderHash).input("token", sql.Char(64), digest(token)).query(`
      IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Id=@actor AND EsAdministradorSistema=1) THROW 50130,'Acceso denegado',1;
      IF EXISTS(SELECT 1 FROM importadora.Empresas WITH(UPDLOCK,HOLDLOCK) WHERE Codigo=@code) THROW 50130,'Código de empresa existente',1;
      IF EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email) THROW 50130,'Correo registrado',1;
      INSERT importadora.Empresas(Codigo,NombreLegal,NombreComercial) VALUES(@code,@legal,@trade);
      DECLARE @company int=CONVERT(int,SCOPE_IDENTITY());
      DECLARE @templateCompany int=(SELECT TOP 1 Id FROM importadora.Empresas WHERE Id<>@company ORDER BY Id);
      IF @templateCompany IS NULL THROW 50130,'No hay empresa modelo para copiar roles',1;
      INSERT importadora.Roles(EmpresaId,Nombre,EsAdministrador)
        SELECT @company,Nombre,EsAdministrador FROM importadora.Roles WHERE EmpresaId=@templateCompany;
      INSERT importadora.RolPermisos(RolId,PermisoCodigo)
        SELECT destino.Id,rp.PermisoCodigo FROM importadora.Roles origen JOIN importadora.RolPermisos rp ON rp.RolId=origen.Id JOIN importadora.Roles destino ON destino.EmpresaId=@company AND destino.Nombre=origen.Nombre WHERE origen.EmpresaId=@templateCompany;
      DECLARE @role int=(SELECT TOP 1 Id FROM importadora.Roles WHERE EmpresaId=@company AND EsAdministrador=1 ORDER BY Id);
      IF @role IS NULL THROW 50130,'No hay rol administrador configurado',1;
      INSERT importadora.Almacenes(EmpresaId,Codigo,Nombre) VALUES(@company,CONCAT(@code,'-PRINC'),'Principal');
      INSERT importadora.ConfiguracionMargenesVenta(Id,EmpresaId,MargenMayor,MargenDetal) VALUES(1,@company,35.00,55.00);
      INSERT importadora.Usuarios(Nombre,Email,PasswordHash,Estado,RolId) VALUES(@adminName,@email,@password,'pendiente',@role);
      DECLARE @user int=CONVERT(int,SCOPE_IDENTITY());
      INSERT importadora.UsuarioEmpresas(UsuarioId,EmpresaId,RolId) VALUES(@user,@company,@role);
      INSERT importadora.InvitacionesUsuario(UsuarioId,TokenHash,CreadoPorUsuarioId,ExpiraEn) VALUES(@user,@token,@actor,DATEADD(day,7,SYSUTCDATETIME()));
      INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) VALUES(@company,@actor,'empresa.creada',@company,CONCAT(@code,' · administrador: ',@email));
      SELECT @company EmpresaId;`);
    await transaction.commit();
    if (!result.recordset[0]) return { message: "No se pudo crear la empresa." };
  } catch {
    await transaction.rollback().catch(() => {});
    return { message: "No se pudo crear. Revisa que el código y correo no existan." };
  }
  revalidatePath("/panel", "layout");
  revalidatePath("/panel/empresas");
  const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { success: true, message: "Empresa creada y administrador invitado.", inviteUrl: `${baseUrl}/activar-cuenta/${token}` };
}

export async function updateCompanyDetails(_: FormState, data: FormData): Promise<FormState> {
  const actor=await currentUser(), id=Number(data.get("id")), legal=String(data.get("legalName")??"").trim(), trade=String(data.get("tradeName")??"").trim();
  if(!actor?.EsAdministradorSistema) return { message:"Solo el administrador global puede modificar empresas." };
  if(!Number.isInteger(id)||legal.length<2||legal.length>150||trade.length>150) return { message:"Revisa el nombre legal y comercial." };
  const result=await (await db()).request().input("id",sql.Int,id).input("legal",sql.NVarChar(150),legal).input("trade",sql.NVarChar(150),trade||null).input("actor",sql.Int,actor.Id).query("UPDATE importadora.Empresas SET NombreLegal=@legal,NombreComercial=@trade WHERE Id=@id; INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) SELECT @id,@actor,'empresa.actualizada',@id,N'Datos de empresa actualizados.' WHERE @@ROWCOUNT>0");
  if(!result.rowsAffected[0]) return { message:"Empresa no encontrada." };
  revalidatePath("/panel/empresas"); revalidatePath("/panel","layout");
  return { success:true,message:"Datos de empresa actualizados." };
}

export async function setCompanyStatus(_: FormState, data: FormData): Promise<FormState> {
  const actor=await currentUser(), id=Number(data.get("id")), active=String(data.get("active"))==="1";
  if(!actor?.EsAdministradorSistema) return { message:"Solo el administrador global puede cambiar el estado." };
  if(!Number.isInteger(id)) return { message:"Empresa inválida." };
  if(!active&&id===actor.EmpresaId) return { message:"Cambia a otra empresa antes de desactivar la empresa activa." };
  const result=await (await db()).request().input("id",sql.Int,id).input("active",sql.Bit,active?1:0).input("actor",sql.Int,actor.Id).query("UPDATE importadora.Empresas SET Activa=@active WHERE Id=@id; INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) SELECT @id,@actor,CASE WHEN @active=1 THEN 'empresa.activada' ELSE 'empresa.desactivada' END,@id,N'Estado actualizado por administrador global.' WHERE @@ROWCOUNT>0");
  if(!result.rowsAffected[0]) return { message:"Empresa no encontrada." };
  revalidatePath("/panel/empresas"); revalidatePath("/panel","layout");
  return { success:true,message:active?"Empresa activada.":"Empresa desactivada." };
}
