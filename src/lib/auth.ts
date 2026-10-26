import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, sql } from "./db";

export const SESSION_COOKIE = "nexo_session";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type SessionUser = {
  Id: number;
  Nombre: string;
  Email: string;
  RolId: number;
  Rol: string;
  EsAdministrador: boolean;
  permissions: string[];
};
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const pool = await db();
  const result = await pool.request().input("hash", sql.Char(64), digest(token))
    .query(`
    SELECT u.Id,u.Nombre,u.Email,u.RolId,r.Nombre Rol,r.EsAdministrador
    FROM importadora.Sesiones s JOIN importadora.Usuarios u ON u.Id=s.UsuarioId
    JOIN importadora.Roles r ON r.Id=u.RolId
    WHERE s.TokenHash=@hash AND s.ExpiraEn>SYSUTCDATETIME() AND u.Estado='activo'`);
  const user = result.recordset[0];
  if (!user) return null;
  const permissions = await pool
    .request()
    .input("role", sql.Int, user.RolId)
    .query(
      "SELECT PermisoCodigo FROM importadora.RolPermisos WHERE RolId=@role",
    );
  return {
    ...user,
    permissions: permissions.recordset.map((p) => p.PermisoCodigo),
  };
}
export function can(user: SessionUser, permission: string) {
  return user.EsAdministrador || user.permissions.includes(permission);
}
export async function requireUser(permission?: string) {
  const user = await currentUser();
  if (!user) redirect("/iniciar-sesion");
  if (permission && !can(user, permission)) redirect("/panel?acceso=denegado");
  return user;
}
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pool = await db();
  await pool
    .request()
    .input("hash", sql.Char(64), digest(token))
    .input("user", sql.Int, userId)
    .input("expires", sql.DateTime2, expires)
    .query(
      "INSERT importadora.Sesiones(TokenHash,UsuarioId,ExpiraEn) VALUES(@hash,@user,@expires)",
    );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
// Atomic, persistent limits shared by all application instances. Never trust a client-supplied IP.
export async function rateLimit(scope: string, limit: number, minutes: number) {
  const pool = await db();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(transaction)
      .input("key", sql.Char(64), digest(scope))
      .input("minutes", sql.Int, minutes).query(`
      DECLARE @now datetime2=SYSUTCDATETIME();
      IF EXISTS(SELECT 1 FROM importadora.LimitesAcceso WITH(UPDLOCK,HOLDLOCK) WHERE Clave=@key)
        UPDATE importadora.LimitesAcceso SET Intentos=CASE WHEN ReiniciaEn<=@now THEN 1 ELSE Intentos+1 END,
          ReiniciaEn=CASE WHEN ReiniciaEn<=@now THEN DATEADD(minute,@minutes,@now) ELSE ReiniciaEn END WHERE Clave=@key;
      ELSE INSERT importadora.LimitesAcceso VALUES(@key,1,DATEADD(minute,@minutes,@now));
      SELECT Intentos FROM importadora.LimitesAcceso WHERE Clave=@key;`);
    await transaction.commit();
    return result.recordset[0].Intentos <= limit;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
