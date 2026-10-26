import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CreateInvitationForm,
  ResendInvitationForm,
  UserAccessForm,
} from "@/components/admin-forms";
export default async function UsersPage() {
  const actor = await requireUser("usuarios.administrar"),
    pool = await db();
  const [users, roles] = await Promise.all([
    pool
      .request()
      .query(
        "SELECT u.Id,u.Nombre,u.Email,u.Estado,u.RolId,r.Nombre Rol,r.EsAdministrador FROM importadora.Usuarios u LEFT JOIN importadora.Roles r ON r.Id=u.RolId ORDER BY CASE WHEN u.Estado='pendiente' THEN 0 ELSE 1 END,u.Id DESC",
      ),
    pool
      .request()
      .query(
        "SELECT Id,Nombre,EsAdministrador FROM importadora.Roles ORDER BY Id",
      ),
  ]);
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
            (role) => actor.EsAdministrador || !role.EsAdministrador,
          )}
        />
      </section>
      <section className="empty-card">
        <div className="eyebrow">USUARIOS · {users.recordset.length}</div>
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
                    {u.EsAdministrador || u.Id === actor.Id ? (
                      <span>{u.Rol} · Cuenta protegida</span>
                    ) : (
                      <>
                        <UserAccessForm
                          id={u.Id}
                          status={u.Estado}
                          roleId={u.RolId}
                          roles={roles.recordset.filter(
                            (r) => actor.EsAdministrador || !r.EsAdministrador,
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
        </div>
      </section>
    </>
  );
}
