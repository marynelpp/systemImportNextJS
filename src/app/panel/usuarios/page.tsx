import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";
import {
  CreateInvitationForm,
  ResendInvitationForm,
  UserAccessForm,
} from "@/components/admin-forms";
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const actor = await requireUser("usuarios.administrar"),
    pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);
  const [users, userCount, roles] = await Promise.all([
    pool
      .request()
      .input("company", sql.Int, actor.EmpresaId)
      .input("query", sql.NVarChar(100), query)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(
        "SELECT u.Id,u.Nombre,u.Email,CASE WHEN ue.Activo=0 THEN 'inactivo' ELSE u.Estado END Estado,ue.RolId,r.Nombre Rol,r.EsAdministrador,u.EsAdministradorSistema FROM importadora.UsuarioEmpresas ue JOIN importadora.Usuarios u ON u.Id=ue.UsuarioId JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.EmpresaId=@company AND (@query='' OR u.Nombre LIKE '%'+@query+'%' OR u.Email LIKE '%'+@query+'%' OR u.Estado LIKE '%'+@query+'%' OR r.Nombre LIKE '%'+@query+'%') ORDER BY CASE WHEN u.Estado='pendiente' THEN 0 ELSE 1 END,u.Id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY",
      ),
    pool
      .request()
      .input("company", sql.Int, actor.EmpresaId)
      .input("query", sql.NVarChar(100), query)
      .query(
        "SELECT COUNT(*) AS Total FROM importadora.UsuarioEmpresas ue JOIN importadora.Usuarios u ON u.Id=ue.UsuarioId JOIN importadora.Roles r ON r.Id=ue.RolId WHERE ue.EmpresaId=@company AND (@query='' OR u.Nombre LIKE '%'+@query+'%' OR u.Email LIKE '%'+@query+'%' OR u.Estado LIKE '%'+@query+'%' OR r.Nombre LIKE '%'+@query+'%')",
      ),
    pool
      .request()
      .input("company", sql.Int, actor.EmpresaId)
      .query("SELECT Id,Nombre,EsAdministrador FROM importadora.Roles WHERE EmpresaId=@company ORDER BY EsAdministrador DESC,Nombre"),
  ]);
  const total = userCount.recordset[0].Total as number;
  return (
    <>
      <h1>Tu equipo, conectado.</h1>
      <p>Crea invitaciones, asigna roles y administra el acceso a la empresa.</p>
      <section className="empty-card">
        <div className="eyebrow">NUEVA INVITACIÓN</div>
        <h2>Invita a una persona a tu equipo.</h2>
        <p>
          La cuenta se activa cuando la persona define su contraseña desde un
          enlace único que vence en 7 días.
        </p>
        <CreateInvitationForm
          roles={roles.recordset.filter(
            (role) => actor.EsAdministradorSistema || actor.EsAdministrador || !role.EsAdministrador,
          )}
        />
      </section>
      <section className="empty-card">
        <div className="eyebrow">USUARIOS · {total}</div>
        <ListControls basePath="/panel/usuarios" query={query} page={page} total={total} limit={limit} includePagination={false} placeholder="Buscar nombre, correo, estado o rol" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estado</th>
                <th>Acceso</th>
              </tr>
            </thead>
            <tbody>
              {users.recordset.map((u) => (
                <tr key={u.Id}>
                  <td>
                    <strong>{u.Nombre}</strong>
                    <br />
                    {u.Email}
                  </td>
                  <td>
                    <span className="badge">{u.Estado}</span>
                  </td>
                  <td>
                    {u.EsAdministradorSistema || u.Id === actor.Id ? (
                      <span>{u.Rol} · Cuenta protegida</span>
                    ) : (
                      <>
                        <UserAccessForm
                          id={u.Id}
                          status={u.Estado}
                          roleId={u.RolId}
                          roles={roles.recordset.filter(
                            (r) => actor.EsAdministradorSistema || actor.EsAdministrador || !r.EsAdministrador,
                          )}
                        />
                        {u.Estado === "pendiente" && (
                          <ResendInvitationForm userId={u.Id} />
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.recordset.length && <p className="empty-text">No hay usuarios que coincidan con el filtro.</p>}
          <ListPagination basePath="/panel/usuarios" query={query} page={page} total={total} limit={limit} />
        </div>
      </section>
    </>
  );
}
