import "server-only";
import sql from "mssql";

const globalDb = globalThis as unknown as {
  importPool?: Promise<sql.ConnectionPool>;
};
export async function db() {
  if (
    !process.env.DB_SERVER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME ||
    !process.env.DB_USER
  ) {
    throw new Error("Falta configurar la conexión de base de datos.");
  }
  if (!globalDb.importPool) {
    const pool = new sql.ConnectionPool({
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT ?? 1433),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
      connectionTimeout: 10000,
      requestTimeout: 15000,
    });
    pool.on("error", () => {
      globalDb.importPool = undefined;
    });
    globalDb.importPool = pool.connect().catch((error: unknown) => {
      globalDb.importPool = undefined;
      throw error;
    });
  }
  return globalDb.importPool;
}
export { sql };
