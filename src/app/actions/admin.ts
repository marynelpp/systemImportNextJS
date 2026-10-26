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
      .input("email", sql.NVarChar(254), email).input("role", sql.Int, roleId)
      .input("password", sql.VarChar(200), placeholderHash).input("token", sql.Char(64), digest(token)).query(`
        DECLARE @actorAdmin bit=(SELECT r.EsAdministrador FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo');
        IF @actorAdmin IS NULL OR (@actorAdmin=0 AND NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.RolPermisos p ON p.RolId=u.RolId WHERE u.Id=@actor AND p.PermisoCodigo='usuarios.administrar')) THROW 50003,'Acceso denegado',1;
        IF NOT EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role) THROW 50003,'Rol inexistente',1;
        IF @actorAdmin=0 AND EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EsAdministrador=1) THROW 50003,'Rol no permitido',1;
        IF @actorAdmin=0 AND EXISTS(SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@role EXCEPT SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@actor) THROW 50003,'Rol no permitido',1;
        IF EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email) THROW 50003,'Correo registrado',1;
        INSERT importadora.Usuarios(Nombre,Email,PasswordHash,Estado,RolId) VALUES(@name,@email,@password,'pendiente',@role);
        DECLARE @userId int=CONVERT(int,SCOPE_IDENTITY());
        INSERT importadora.InvitacionesUsuario(UsuarioId,TokenHash,CreadoPorUsuarioId,ExpiraEn) VALUES(@userId,@token,@actor,DATEADD(day,7,SYSUTCDATETIME()));
        INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle) VALUES(@actor,'usuario.invitacion',@userId,CONCAT('Rol: ',@role));
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
      .input("actor", sql.Int, actor.Id).input("user", sql.Int, userId).input("token", sql.Char(64), digest(token)).query(`
        DECLARE @actorAdmin bit=(SELECT r.EsAdministrador FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo');
        IF @actorAdmin IS NULL OR (@actorAdmin=0 AND NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.RolPermisos p ON p.RolId=u.RolId WHERE u.Id=@actor AND p.PermisoCodigo='usuarios.administrar')) THROW 50004,'Acceso denegado',1;
        IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Id=@user AND Estado='pendiente') THROW 50004,'Usuario no pendiente',1;
        IF @actorAdmin=0 AND EXISTS(SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@user EXCEPT SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@actor) THROW 50004,'Acceso superior',1;
        UPDATE importadora.InvitacionesUsuario SET CanceladoEn=SYSUTCDATETIME() WHERE UsuarioId=@user AND UsadoEn IS NULL AND CanceladoEn IS NULL;
        INSERT importadora.InvitacionesUsuario(UsuarioId,TokenHash,CreadoPorUsuarioId,ExpiraEn) VALUES(@user,@token,@actor,DATEADD(day,7,SYSUTCDATETIME()));
        INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId) VALUES(@actor,'usuario.reinvitacion',@user);
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
      .input("actor", sql.Int, actor.Id).query(`
 SET XACT_ABORT ON; BEGIN TRANSACTION;
 DECLARE @admin bit=(SELECT r.EsAdministrador FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo');
 IF @admin IS NULL OR (@admin=0 AND NOT EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.RolPermisos p ON p.RolId=u.RolId WHERE u.Id=@actor AND p.PermisoCodigo='usuarios.administrar')) THROW 50002,'Acceso denegado',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id) THROW 50002,'Usuario inexistente',1;
 IF EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.Roles r ON u.RolId=r.Id WHERE u.Id=@id AND r.EsAdministrador=1) THROW 50002,'Cuenta administradora protegida',1;
 IF NOT EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role) THROW 50002,'Rol inexistente',1;
 IF @admin=0 AND (EXISTS(SELECT 1 FROM importadora.Roles WHERE Id=@role AND EsAdministrador=1)
  OR EXISTS(SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@role EXCEPT SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@actor)
  OR EXISTS(SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@id EXCEPT SELECT p.PermisoCodigo FROM importadora.RolPermisos p JOIN importadora.Usuarios u ON u.RolId=p.RolId WHERE u.Id=@actor)) THROW 50002,'No puedes administrar un acceso superior al tuyo',1;
 UPDATE importadora.Usuarios SET RolId=@role,Estado=@status,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id;
 DELETE importadora.Sesiones WHERE UsuarioId=@id;
 INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle) VALUES(@actor,'usuario.acceso',@id,CONCAT('Estado: ',@status,'; rol: ',@role));
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
  if (!actor.EsAdministrador)
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
      .query(
        "SELECT u.Id FROM importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) JOIN importadora.Roles r ON r.Id=u.RolId WHERE u.Id=@actor AND u.Estado='activo' AND r.EsAdministrador=1",
      );
    if (!check.recordset.length) throw new Error("Forbidden");
    let roleId = id;
    if (id) {
      const r = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("name", sql.NVarChar(60), name)
        .query(
          "UPDATE importadora.Roles SET Nombre=@name OUTPUT inserted.Id WHERE Id=@id AND EsAdministrador=0",
        );
      if (!r.recordset.length) throw new Error("Protected role");
    } else {
      const r = await new sql.Request(transaction)
        .input("name", sql.NVarChar(60), name)
        .query(
          "INSERT importadora.Roles(Nombre) OUTPUT inserted.Id VALUES(@name)",
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
      .query(
        "DELETE s FROM importadora.Sesiones s JOIN importadora.Usuarios u ON u.Id=s.UsuarioId WHERE u.RolId=@id; INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId) VALUES(@actor,'rol.configuracion',@id)",
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
