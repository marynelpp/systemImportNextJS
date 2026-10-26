"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, sql } from "@/lib/db";
import { createSession, digest, rateLimit, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
export type FormState = { message: string; success?: boolean };
const unavailable = {
  message:
    "No pudimos completar la operación. Verifica la conexión y la instalación del módulo de seguridad.",
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function login(_: FormState, data: FormData): Promise<FormState> {
  const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password = String(data.get("password") ?? "");
  if (
    !emailPattern.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 128
  )
    return { message: "Revisa el correo y la contraseña." };
  try {
    if (
      !(await rateLimit(`login:${email}`, 8, 15)) ||
      !(await rateLimit("login:global", 300, 15))
    )
      return {
        message: "Demasiados intentos. Intenta nuevamente en 15 minutos.",
      };
    const pool = await db();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(254), email)
      .query(
        "SELECT Id,PasswordHash,Estado FROM importadora.Usuarios WHERE Email=@email",
      );
    const user = result.recordset[0];
    // Run the same expensive derivation for missing accounts to reduce timing disclosure.
    const valid = await verifyPassword(
      password,
      user?.PasswordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!user || !valid || user.Estado !== "activo")
      return {
        message: "Credenciales incorrectas o cuenta sin acceso autorizado.",
      };
    await createSession(user.Id);
  } catch {
    return unavailable;
  }
  redirect("/panel");
}
export async function activateInvitation(_: FormState, data: FormData): Promise<FormState> {
  const token = String(data.get("token") ?? "");
  const password = String(data.get("password") ?? "");
  const confirmation = String(data.get("confirmPassword") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12 || password.length > 128)
    return { message: "La contraseña debe tener entre 12 y 128 caracteres." };
  if (password !== confirmation) return { message: "Las contraseñas no coinciden." };
  try {
    if (!(await rateLimit(`invitation:${token}`, 8, 15)))
      return { message: "Demasiados intentos. Intenta nuevamente en 15 minutos." };
    const pool = await db();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const invitation = await new sql.Request(transaction)
        .input("token", sql.Char(64), digest(token))
        .query(`SELECT i.UsuarioId FROM importadora.InvitacionesUsuario i WITH(UPDLOCK,HOLDLOCK)
          JOIN importadora.Usuarios u WITH(UPDLOCK,HOLDLOCK) ON u.Id=i.UsuarioId
          WHERE i.TokenHash=@token AND i.UsadoEn IS NULL AND i.CanceladoEn IS NULL
            AND i.ExpiraEn>SYSUTCDATETIME() AND u.Estado='pendiente'`);
      if (!invitation.recordset[0]) {
        await transaction.rollback();
        return { message: "La invitación no es válida, venció o ya fue utilizada." };
      }
      const hash = await hashPassword(password);
      const userId = invitation.recordset[0].UsuarioId;
      await new sql.Request(transaction)
        .input("user", sql.Int, userId)
        .input("hash", sql.VarChar(200), hash)
        .input("token", sql.Char(64), digest(token))
        .query(`UPDATE importadora.Usuarios SET PasswordHash=@hash,Estado='activo',ActualizadoEn=SYSUTCDATETIME() WHERE Id=@user;
          UPDATE importadora.InvitacionesUsuario SET UsadoEn=SYSUTCDATETIME() WHERE TokenHash=@token;
          INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId) VALUES(@user,'usuario.activacion',@user);`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch {
    return unavailable;
  }
  redirect("/iniciar-sesion?activada=1");
}
export async function logout() {
  const jar = await cookies(),
    token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const pool = await db();
    await pool
      .request()
      .input("hash", sql.Char(64), digest(token))
      .query("DELETE importadora.Sesiones WHERE TokenHash=@hash");
  }
  jar.delete(SESSION_COOKIE);
  redirect("/iniciar-sesion");
}
