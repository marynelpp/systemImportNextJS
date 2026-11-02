"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { digest } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import type { FormState } from "./auth";

export type InvitationState = FormState & { inviteUrl?: string };

function invitationUrl(token: string) {
  const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/activar-cuenta/${token}`;
}

export async function createInvitation(_: InvitationState, data: FormData): Promise<InvitationState> {
  const actor = await requireUser("usuarios.administrar");
  const name = String(data.get("name") ?? "").trim();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const roleId = Number(data.get("role"));
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !Number.isInteger(roleId) || roleId <= 0)
    return { message: "Escribe el nombre, correo y rol de la persona." };
  const token = randomBytes(32).toString("hex");
  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));
  const pool = await db();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const result = await new sql.Request(transaction)
      .input("actor", sql.Int, actor.Id).input("name", sql.NVarChar(100), name)
      .input("email", sql.NVarChar(254), email).input("role", sql.Int, roleId).input("company", sql.Int, actor.EmpresaId)
      .input("password", sql.VarChar(200), placeholderHash).input("token", sql.Char(64), digest(token)).query(`
        DECLARE @actorSystem bit=ISNULL((SELECT EsAdministradorSistema FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Id=@actor AND Estado='activo'),0);
        DECLARE @actorRole int=(SELECT RolId FROM importadora.UsuarioEmpresas WHERE UsuarioId=@actor AND EmpresaId=@company AND Activo=1);
        DECLARE @actorAdmin bit=ISNULL((SELECT EsAdministrador FROM importadora.Roles WHERE Id=@actorRole),0);
        IF @actorSystem=0 AND (@actorRole IS NULL OR (@actorAdmin=0 AND NOT EXISTS(SELECT 1 FROM importadora.RolPermisos WHERE RolId=@actorRole AND PermisoCodigo='usuarios.administrar'))) THROW 50003,'Acceso denegado',1;
        IF NOT EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EmpresaId=@company) THROW 50003,'Rol inexistente',1;
        IF @actorSystem=0 AND @actorAdmin=0 AND EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EsAdministrador=1) THROW 50003,'Rol no permitido',1;
        IF @actorSystem=0 AND @actorAdmin=0 AND EXISTS(SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@role EXCEPT SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@actorRole) THROW 50003,'Rol no permitido',1;
        IF LOWER(@email)=N'perazaperozo@gmail.com' THROW 50003,'Correo reservado para el administrador global',1;
        IF EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email) THROW 50003,'Correo registrado',1;
        INSERT importadora.Usuarios(Nombre,Email,PasswordHash,Estado,RolId) VALUES(@name,@email,@password,'pendiente',@role);
        DECLARE @userId int=CONVERT(int,SCOPE_IDENTITY());
        INSERT importadora.UsuarioEmpresas(UsuarioId,EmpresaId,RolId) VALUES(@userId,@company,@role);
        INSERT importadora.InvitacionesUsuario(UsuarioId,TokenHash,CreadoPorUsuarioId,ExpiraEn) VALUES(@userId,@token,@actor,DATEADD(day,7,SYSUTCDATETIME()));
        INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) VALUES(@company,@actor,'usuario.invitacion',@userId,CONCAT('Rol: ',@role));
        SELECT @userId AS UsuarioId;`);
    await transaction.commit();
    if (!result.recordset[0]) return { message: "No se pudo crear la invitación." };
  } catch {
    await transaction.rollback().catch(() => {});
    return { message: "No se pudo crear la invitación. Verifica que el correo no esté registrado y que hayas ejecutado el script de invitaciones." };
  }
  revalidatePath("/panel/usuarios");
  return { success: true, message: "Invitación creada. Vence en 7 días y se puede usar una sola vez.", inviteUrl: invitationUrl(token) };
}

export async function resendInvitation(_: InvitationState, data: FormData): Promise<InvitationState> {
  const actor = await requireUser("usuarios.administrar");
  const userId = Number(data.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) return { message: "Usuario inválido." };
  const token = randomBytes(32).toString("hex");
  const pool = await db();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const result = await new sql.Request(transaction)
      .input("actor", sql.Int, actor.Id).input("user", sql.Int, userId).input("company", sql.Int, actor.EmpresaId).input("token", sql.Char(64), digest(token)).query(`
        DECLARE @actorSystem bit=ISNULL((SELECT EsAdministradorSistema FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Id=@actor AND Estado='activo'),0);
        DECLARE @actorRole int=(SELECT RolId FROM importadora.UsuarioEmpresas WHERE UsuarioId=@actor AND EmpresaId=@company AND Activo=1);
        DECLARE @actorAdmin bit=ISNULL((SELECT EsAdministrador FROM importadora.Roles WHERE Id=@actorRole),0);
        IF @actorSystem=0 AND (@actorRole IS NULL OR (@actorAdmin=0 AND NOT EXISTS(SELECT 1 FROM importadora.RolPermisos WHERE RolId=@actorRole AND PermisoCodigo='usuarios.administrar'))) THROW 50004,'Acceso denegado',1;
        IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) JOIN importadora.UsuarioEmpresas ue ON ue.UsuarioId=u.Id WHERE u.Id=@user AND u.Estado='pendiente' AND ue.EmpresaId=@company) THROW 50004,'Usuario no pendiente',1;
        IF @actorSystem=0 AND @actorAdmin=0 AND EXISTS(SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=(SELECT RolId FROM importadora.UsuarioEmpresas WHERE UsuarioId=@user AND EmpresaId=@company) EXCEPT SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@actorRole) THROW 50004,'Acceso superior',1;
        UPDATE importadora.InvitacionesUsuario SET CanceladoEn=SYSUTCDATETIME() WHERE UsuarioId=@user AND UsadoEn IS NULL AND CanceladoEn IS NULL;
        INSERT importadora.InvitacionesUsuario(UsuarioId,TokenHash,CreadoPorUsuarioId,ExpiraEn) VALUES(@user,@token,@actor,DATEADD(day,7,SYSUTCDATETIME()));
        INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId) VALUES(@company,@actor,'usuario.reinvitacion',@user);
        SELECT 1 AS Ok;`);
    await transaction.commit();
    if (!result.recordset[0]?.Ok) return { message: "No se pudo renovar la invitación." };
  } catch {
    await transaction.rollback().catch(() => {});
    return { message: "No se pudo renovar. La cuenta debe estar pendiente." };
  }
  revalidatePath("/panel/usuarios");
  return { success: true, message: "Invitación renovada. El enlace anterior dejó de funcionar.", inviteUrl: invitationUrl(token) };
}

export async function updateUser(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const actor = await requireUser("usuarios.administrar");
  const id = Number(data.get("id")),
    role = Number(data.get("role")),
    status = String(data.get("status"));
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(role) ||
    role <= 0 ||
    !["activo", "inactivo", "pendiente"].includes(status)
  )
    return { message: "Revisa el usuario, rol y estado." };
  if (id === actor.Id)
    return { message: "No puedes modificar tu propio acceso." };
  try {
    const pool = await db();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("role", sql.Int, role)
      .input("status", sql.VarChar(12), status)
      .input("actor", sql.Int, actor.Id).input("company", sql.Int, actor.EmpresaId).query(`
 SET XACT_ABORT ON; BEGIN TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Id=@actor AND EsAdministradorSistema=1) AND NOT EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.UsuarioId=@actor AND ue.EmpresaId=@company AND ue.Activo=1 AND (r.EsAdministrador=1 OR EXISTS(SELECT 1 FROM importadora.RolPermisos WHERE RolId=ue.RolId AND PermisoCodigo='usuarios.administrar'))) THROW 50002,'Acceso denegado',1;
 IF EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Id=@id AND EsAdministradorSistema=1) THROW 50002,'Cuenta global protegida',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EmpresaId=@company) THROW 50002,'Rol inexistente',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas WHERE UsuarioId=@id AND EmpresaId=@company) THROW 50002,'Usuario ajeno a esta empresa',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Id=@actor AND EsAdministradorSistema=1) AND NOT EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.UsuarioId=@actor AND ue.EmpresaId=@company AND ue.Activo=1 AND r.EsAdministrador=1) AND EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EsAdministrador=1) THROW 50002,'Rol no permitido',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Id=@actor AND EsAdministradorSistema=1) AND NOT EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.UsuarioId=@actor AND ue.EmpresaId=@company AND ue.Activo=1 AND r.EsAdministrador=1) AND EXISTS(SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@role EXCEPT SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.UsuarioEmpresas ue ON ue.RolId=p.RolId WHERE ue.UsuarioId=@actor AND ue.EmpresaId=@company AND ue.Activo=1) THROW 50002,'Rol no permitido',1;
 UPDATE importadora.UsuarioEmpresas SET RolId=@role,Activo=CASE WHEN @status='inactivo' THEN 0 ELSE 1 END WHERE UsuarioId=@id AND EmpresaId=@company;
 IF @status IN ('activo','pendiente') UPDATE importadora.Usuarios SET Estado=@status,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id;
 DELETE importadora.Sesiones WHERE UsuarioId=@id;
 INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) VALUES(@company,@actor,'usuario.acceso',@id,CONCAT('Empresa: ',@company,'; estado: ',@status,'; rol: ',@role));
 COMMIT; SELECT 1 Ok;`);
    if (!result.recordset?.[0]?.Ok) return { message: "No se pudo guardar." };
  } catch {
    return {
      message:
        "No se pudo actualizar. Comprueba tus permisos y la conexión. Las cuentas administradoras están protegidas.",
    };
  }
  revalidatePath("/panel");
  return {
    success: true,
    message: "Acceso actualizado. Las sesiones anteriores se cerraron.",
  };
}
export async function saveRole(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const actor = await requireUser("roles.administrar");
  // Only a full administrator may change the permission graph itself.
  if (!actor.EsAdministrador && !actor.EsAdministradorSistema)
    return {
      message: "La configuración de permisos requiere un administrador.",
    };
  const id = Number(data.get("id") || 0),
    name = String(data.get("name") ?? "").trim(),
    permissions = [...new Set(data.getAll("permissions").map(String))];
  if (
    !Number.isInteger(id) ||
    id < 0 ||
    name.length < 2 ||
    name.length > 60 ||
    permissions.length > 100
  )
    return { message: "Revisa el nombre del rol." };
  const pool = await db(),
    transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const check = await new sql.Request(transaction)
      .input("actor", sql.Int, actor.Id)
      .input("company", sql.Int, actor.EmpresaId)
      .query(
        "SELECT u.Id FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) WHERE u.Id=@actor AND u.Estado='activo' AND (u.EsAdministradorSistema=1 OR EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.UsuarioId=u.Id AND ue.EmpresaId=@company AND ue.Activo=1 AND r.EsAdministrador=1))",
      );
    if (!check.recordset.length) throw new Error("Forbidden");
    let roleId = id;
    if (id) {
      const r = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("company", sql.Int, actor.EmpresaId)
        .input("name", sql.NVarChar(60), name)
        .query(
          "UPDATE importadora.Roles SET Nombre=@name OUTPUT inserted.Id WHERE Id=@id AND EmpresaId=@company AND EsAdministrador=0",
        );
      if (!r.recordset.length) throw new Error("Protected role");
    } else {
      const r = await new sql.Request(transaction)
        .input("company", sql.Int, actor.EmpresaId)
        .input("name", sql.NVarChar(60), name)
        .query(
          "INSERT importadora.Roles(EmpresaId,Nombre,EsAdministrador) OUTPUT inserted.Id VALUES(@company,@name,0)",
        );
      roleId = r.recordset[0].Id;
    }
    await new sql.Request(transaction)
      .input("id", sql.Int, roleId)
      .query("DELETE importadora.RolPermisos WHERE RolId=@id");
    for (const permission of permissions) {
      if (permission.length > 80) throw new Error("Invalid permission");
      await new sql.Request(transaction)
        .input("id", sql.Int, roleId)
        .input("permission", sql.VarChar(80), permission)
        .query("INSERT importadora.RolPermisos VALUES(@id,@permission)");
    }
    await new sql.Request(transaction)
      .input("actor", sql.Int, actor.Id)
      .input("id", sql.Int, roleId)
      .input("company", sql.Int, actor.EmpresaId)
      .query(
        "DELETE s FROM importadora.Sesiones s JOIN importadora.UsuarioEmpresas ue ON ue.UsuarioId=s.UsuarioId WHERE ue.RolId=@id AND ue.EmpresaId=@company; INSERT importadora.Auditoria(EmpresaId,UsuarioId,Accion,EntidadId,Detalle) VALUES(@company,@actor,'rol.configuracion',@id,CONCAT('Empresa: ',@company))",
      );
    await transaction.commit();
  } catch {
    await transaction.rollback().catch(() => {});
    return {
      message:
        "No se pudo guardar. El nombre debe ser único y el rol administrador no se puede editar.",
    };
  }
  revalidatePath("/panel/roles");
  return { success: true, message: "Rol guardado." };
}
