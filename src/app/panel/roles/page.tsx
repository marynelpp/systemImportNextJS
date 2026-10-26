import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RoleForm } from "@/components/admin-forms";
export default async function RolesPage() {
  const actor = await requireUser("roles.administrar"),
    pool = await db();
  const [roles, permissions, links] = await Promise.all([
    pool
      .request()
      .query(
        "SELECT Id,Nombre,EsAdministrador FROM importadora.Roles ORDER BY Id",
      ),
    pool
      .request()
      .query(
        "SELECT Codigo,Descripcion FROM importadora.Permisos ORDER BY Codigo",
      ),
    pool
      .request()
      .query("SELECT RolId,PermisoCodigo FROM importadora.RolPermisos"),
  ]);
  return (
    <>
      <h1>Roles y permisos.</h1>
      <p>
        Define qué puede hacer cada persona. Los permisos de nuevos módulos se
        incorporarán cuando estén disponibles.
      </p>
      {!actor.EsAdministrador && (
        <p className="form-message">
          Solo el administrador puede modificar la configuración de permisos.
        </p>
      )}
      {roles.recordset.map((r) => (
        <section className="empty-card" key={r.Id}>
          <h2>{r.Nombre}</h2>
          {r.EsAdministrador ? (
            <p>
              Acceso total. Este rol está protegido y no se puede modificar
              desde la aplicación.
            </p>
          ) : actor.EsAdministrador ? (
            <RoleForm
              role={r}
              permissions={permissions.recordset}
              selected={links.recordset
                .filter((l) => l.RolId === r.Id)
                .map((l) => l.PermisoCodigo)}
            />
          ) : (
            <p>
              {links.recordset
                .filter((l) => l.RolId === r.Id)
                .map((l) => l.PermisoCodigo)
                .join(", ") || "Sin permisos"}
            </p>
          )}
        </section>
      ))}
      {actor.EsAdministrador && (
        <section className="empty-card">
          <h2>Crear un rol</h2>
          <RoleForm permissions={permissions.recordset} />
        </section>
      )}
    </>
  );
}
