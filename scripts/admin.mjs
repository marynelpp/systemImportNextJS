import sql from "mssql";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
process.loadEnvFile(".env.local");
const reset = process.argv.includes("--reset");
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: !!process.stdin.isTTY,
});
let pool;
try {
  console.log(
    reset
      ? "Restablecimiento local de contraseña"
      : "Crear el primer administrador (solo una vez)",
  );
  const name = reset ? "" : (await rl.question("Nombre completo: ")).trim();
  const email = (await rl.question("Correo: ")).trim().toLowerCase();
  if (
    (!reset && (name.length < 2 || name.length > 100)) ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254
  )
    throw new Error("Datos inválidos.");
  process.stdout.write(
    "Contraseña nueva (mínimo 12 caracteres, entrada oculta): ",
  );
  muted = true;
  const password = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  process.stdout.write("Repetir contraseña: ");
  muted = true;
  const confirmation = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== confirmation
  )
    throw new Error("Contraseñas inválidas o diferentes.");
  const salt = randomBytes(16).toString("hex"),
    key = await promisify(scrypt)(password, salt, 64),
    hash = `scrypt:${salt}:${key.toString("hex")}`;
  pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 10000,
  }).connect();
  const request = pool
    .request()
    .input("email", sql.NVarChar(254), email)
    .input("hash", sql.VarChar(200), hash)
    .input("name", sql.NVarChar(100), name);
  await request.query(
    reset
      ? `
 SET XACT_ABORT ON; BEGIN TRANSACTION;
 DECLARE @id int=(SELECT Id FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email);
 IF @id IS NULL THROW 50001,'No existe ese usuario',1;
 UPDATE importadora.Usuarios SET PasswordHash=@hash,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id;
 DELETE importadora.Sesiones WHERE UsuarioId=@id;
 INSERT importadora.Auditoria(Accion,EntidadId) VALUES('usuario.reset_local',@id);
 COMMIT;`
      : `
 SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRANSACTION;
 DECLARE @role int=(SELECT Id FROM importadora.Roles WITH(UPDLOCK,HOLDLOCK) WHERE EsAdministrador=1);
 IF @role IS NULL THROW 50001,'Instala primero el script de seguridad',1;
 IF EXISTS(SELECT 1 FROM importadora.Usuarios WITH(UPDLOCK,HOLDLOCK) WHERE RolId=@role) THROW 50001,'Ya existe un administrador; usa el panel para gestionar usuarios',1;
 IF EXISTS(SELECT 1 FROM importadora.Usuarios WHERE Email=@email) THROW 50001,'El correo ya tiene una cuenta; utiliza uno nuevo para el administrador inicial',1;
 INSERT importadora.Usuarios(Nombre,Email,PasswordHash,Estado,RolId) VALUES(@name,@email,@hash,'activo',@role);
 INSERT importadora.Auditoria(Accion,EntidadId) VALUES('usuario.admin_inicial',CONVERT(int,SCOPE_IDENTITY()));
 COMMIT;`,
  );
  console.log(
    reset
      ? "Contraseña actualizada y sesiones revocadas."
      : "Administrador creado. Ya puedes iniciar sesión.",
  );
} catch (error) {
  muted = false;
  // Do not print driver objects or connection configuration.
  console.error(
    error.number >= 50000
      ? error.message
      : error.code
        ? `No se pudo completar la operación (${error.code}). Comprueba la conexión y el script SQL.`
        : error.message,
  );
  process.exitCode = 1;
} finally {
  rl.close();
  await pool?.close();
}
