import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatVenezuelanDateTime } from "@/lib/dates";
export default async function AuditPage() {
  await requireUser("auditoria.ver");
  const pool = await db(),
    result = await pool
      .request()
      .query(
        "SELECT TOP(100) a.Id,a.Accion,a.EntidadId,a.Detalle,a.CreadoEn,u.Nombre FROM importadora.Auditoria a LEFT JOIN importadora.Usuarios u ON u.Id=a.UsuarioId ORDER BY a.Id DESC",
      );
  return (
    <>
      <h1>Historial de seguridad.</h1>
      <p>Últimos 100 eventos · Hora de Venezuela.</p>
      <section className="empty-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Acción</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {result.recordset.map((r) => (
                <tr key={r.Id}>
                  <td>
                    {formatVenezuelanDateTime(r.CreadoEn)}
                  </td>
                  <td>{r.Nombre ?? "Proceso de registro / local"}</td>
                  <td>{r.Accion}</td>
                  <td>
                    {r.EntidadId} {r.Detalle}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.recordset.length && <p>No hay eventos registrados.</p>}
        </div>
      </section>
    </>
  );
}
