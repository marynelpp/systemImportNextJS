"use client";
import { useActionState } from "react";
import {
  createInvitation,
  resendInvitation,
  saveRole,
  updateUser,
} from "@/app/actions/admin";
type Role = { Id: number; Nombre: string; EsAdministrador: boolean };

function InvitationResult({
  state,
}: {
  state: { message: string; success?: boolean; inviteUrl?: string };
}) {
  if (!state.message) return null;
  return (
    <div className={`form-message ${state.success ? "" : "error"}`} role="status">
      <span>{state.message}</span>
      {state.inviteUrl && (
        <>
          <label className="field">
            Enlace de activación
            <input className="invite-link" value={state.inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button type="button" className="copy-link" onClick={() => navigator.clipboard.writeText(state.inviteUrl ?? "")}>Copiar enlace</button>
        </>
      )}
    </div>
  );
}

export function CreateInvitationForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(createInvitation, { message: "" });
  return (
    <form action={action} className="invite-form">
      <label className="field">Nombre completo<input name="name" required minLength={2} maxLength={100} placeholder="Nombre y apellido" /></label>
      <label className="field">Correo electrónico<input type="email" name="email" required maxLength={254} placeholder="persona@empresa.com" /></label>
      <label className="field">Rol asignado<select name="role" required defaultValue=""><option value="" disabled>Selecciona un rol</option>{roles.map((role) => <option key={role.Id} value={role.Id}>{role.Nombre}</option>)}</select></label>
      <button className="button" disabled={pending}>{pending ? "Creando…" : "Crear invitación ↗"}</button>
      <InvitationResult state={state} />
    </form>
  );
}

export function ResendInvitationForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(resendInvitation, { message: "" });
  return (
    <form action={action} className="resend-form">
      <input type="hidden" name="userId" value={userId} />
      <button className="copy-link" disabled={pending}>{pending ? "Generando…" : "Generar nuevo enlace"}</button>
      <InvitationResult state={state} />
    </form>
  );
}
export function UserAccessForm({
  id,
  status,
  roleId,
  roles,
}: {
  id: number;
  status: string;
  roleId: number | null;
  roles: Role[];
}) {
  const [state, action, pending] = useActionState(updateUser, { message: "" });
  return (
    <form action={action}>
      <div className="inline-form">
        <input type="hidden" name="id" value={id} />
        <select
          name="role"
          aria-label="Rol"
          defaultValue={roleId ?? ""}
          required
        >
          <option value="" disabled>
            Asignar rol
          </option>
          {roles.map((r) => (
            <option key={r.Id} value={r.Id}>
              {r.Nombre}
            </option>
          ))}
        </select>
        <select name="status" aria-label="Estado" defaultValue={status}>
          <option value="pendiente">Pendiente</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <button className="button" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {state.message && (
        <p
          role="status"
          className={`form-message ${state.success ? "" : "error"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
export function RoleForm({
  role,
  permissions,
  selected = [],
}: {
  role?: Role;
  permissions: { Codigo: string; Descripcion: string }[];
  selected?: string[];
}) {
  const [state, action, pending] = useActionState(saveRole, { message: "" });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={role?.Id ?? 0} />
      <label className="field">
        Nombre del rol
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={role?.Nombre}
        />
      </label>
      <div className="permission-grid">
        {permissions.map((p) => (
          <label key={p.Codigo}>
            <input
              type="checkbox"
              name="permissions"
              value={p.Codigo}
              defaultChecked={selected.includes(p.Codigo)}
            />
            {p.Descripcion}
          </label>
        ))}
      </div>
      <button className="button small" disabled={pending}>
        {pending ? "Guardando…" : role ? "Guardar permisos" : "Crear rol"}
      </button>
      {state.message && (
        <p
          role="status"
          className={`form-message ${state.success ? "" : "error"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
