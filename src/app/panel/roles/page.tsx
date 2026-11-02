import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";
import { RoleForm } from "@/components/admin-forms";
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const actor = await requireUser("roles.administrar"),
    pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);
  const [roles, count, permissions, links] = await Promise.all([
    pool
      .request()
      .input("company",sql.Int,actor.EmpresaId)
      .input("query", sql.NVarChar(100), query)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(
        "SELECT Id,Nombre,EsAdministrador FROM importadora.Roles WHERE EmpresaId=@company AND (@query='' OR Nombre LIKE '%'+@query+'%') ORDER BY EsAdministrador DESC,Nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY",
      ),
    pool.request().input("company",sql.Int,actor.EmpresaId).input("query", sql.NVarChar(100), query).query("SELECT COUNT(*) AS Total FROM importadora.Roles WHERE EmpresaId=@company AND (@query='' OR Nombre LIKE '%'+@query+'%')"),
    pool
      .request()
      .query(
        "SELECT Codigo,Descripcion FROM importadora.Permisos ORDER BY Codigo",
      ),
    pool
      .request()
      .input("company",sql.Int,actor.EmpresaId)
      .query("SELECT rp.RolId,rp.PermisoCodigo FROM importadora.RolPermisos rp JOIN importadora.Roles r ON r.Id=rp.RolId WHERE r.EmpresaId=@company"),
  ]);
  const total = count.recordset[0].Total as number;
  return (
    <>
      <h1>Roles y permisos.</h1>
      <p>
        Define qué puede hacer cada persona. Los permisos de nuevos módulos se
        incorporarán cuando estén disponibles.
      </p>
      {!actor.EsAdministrador && !actor.EsAdministradorSistema && (
        <p className="form-message">
          Solo el administrador puede modificar la configuración de permisos.
        </p>
      )}
      <section className="empty-card">
        <h2>Roles registrados</h2>
        <ListControls basePath="/panel/roles" query={query} page={page} total={total} limit={limit} includePagination={false} placeholder="Buscar rol" />
      </section>
      {roles.recordset.map((r) => (
        <section className="empty-card" key={r.Id}>
          <h2>{r.Nombre}</h2>
          {r.EsAdministrador ? (
            <p>
              Acceso total. Este rol está protegido y no se puede modificar
              desde la aplicación.
            </p>
          ) : actor.EsAdministrador || actor.EsAdministradorSistema ? (
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
      <ListPagination basePath="/panel/roles" query={query} page={page} total={total} limit={limit} />
      {(actor.EsAdministrador || actor.EsAdministradorSistema) && (
        <section className="empty-card">
          <h2>Crear un rol</h2>
          <RoleForm permissions={permissions.recordset} />
        </section>
      )}
    </>
  );
}
