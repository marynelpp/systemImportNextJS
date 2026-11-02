"use client";

import { useActionState } from "react";
import { createCompanyWithAdmin } from "@/app/actions/empresas";

export default function CompanyAdminForm() {
  const [state, action, pending] = useActionState(createCompanyWithAdmin, { message: "" });
  return <form action={action} className="settings-form"><div className="form-grid">
    <label className="field">Código de empresa<input name="code" required maxLength={12} placeholder="IMPORT-02" /></label>
    <label className="field">Nombre legal<input name="legalName" required maxLength={150} placeholder="Importadora Ejemplo, C.A." /></label>
    <label className="field wide">Nombre comercial<input name="tradeName" maxLength={150} placeholder="Nombre que se mostrará en el sistema" /></label>
    <label className="field">Administrador de la empresa<input name="adminName" required maxLength={100} placeholder="Nombre y apellido" /></label>
    <label className="field">Correo del administrador<input name="adminEmail" type="email" required maxLength={254} placeholder="admin@empresa.com" /></label>
  </div><button className="button" disabled={pending}>{pending ? "Creando…" : "Crear empresa e invitar administrador"}</button>
  {state.message && <div className={`form-message ${state.success ? "" : "error"}`} role="status">{state.message}{state.inviteUrl && <label className="field">Enlace de activación<input className="invite-link" value={state.inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}</div>}</form>;
}
