import sql from "mssql";
process.loadEnvFile(".env.local");
let pool;
try {
  pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 10000,
  }).connect();
  const result = await pool
    .request()
    .query(
      "SELECT CASE WHEN OBJECT_ID(N'importadora.Usuarios',N'U') IS NULL THEN 0 ELSE 1 END AS Instalado",
    );
  console.log("Conexión SQL Server: correcta.");
  console.log(
    result.recordset[0].Instalado
      ? "Módulo de seguridad: instalado."
      : "Módulo de seguridad: pendiente de ejecutar database/001-seguridad.sql.",
  );
} catch (error) {
  console.error(
    `No se pudo conectar (${error.code ?? "error"}). Revisa credenciales, red y reglas de firewall de Azure SQL.`,
  );
  process.exitCode = 1;
} finally {
  await pool?.close();
}
