"use client";

import { useActionState } from "react";
import { createWarehouse, saveCompany, syncBcvRate } from "@/app/actions/configuracion";

type Company = {
  NombreLegal: string;
  NombreComercial: string | null;
  Rif: string | null;
  Telefono: string | null;
  Email: string | null;
  Direccion: string | null;
};

function Feedback({ state }: { state: { message: string; success?: boolean } }) {
  return state.message ? <p role="status" className={`form-message ${state.success ? "" : "error"}`}>{state.message}</p> : null;
}

export function CompanyForm({ company }: { company?: Company }) {
  const [state, action, pending] = useActionState(saveCompany, { message: "" });
  return <form action={action} className="settings-form"><div className="form-grid"><label className="field wide">Nombre legal<input name="legalName" required minLength={2} maxLength={150} defaultValue={company?.NombreLegal} placeholder="Razón social de la importadora" /></label><label className="field">Nombre comercial<input name="tradeName" maxLength={150} defaultValue={company?.NombreComercial ?? ""} placeholder="Nombre visible" /></label><label className="field">RIF<input name="rif" maxLength={20} defaultValue={company?.Rif ?? ""} placeholder="J-12345678-9" /></label><label className="field">Teléfono<input name="phone" maxLength={30} defaultValue={company?.Telefono ?? ""} placeholder="0412-0000000" /></label><label className="field">Correo de la empresa<input type="email" name="email" maxLength={254} defaultValue={company?.Email ?? ""} placeholder="correo@empresa.com" /></label><label className="field wide">Dirección<input name="address" maxLength={300} defaultValue={company?.Direccion ?? ""} placeholder="Dirección fiscal o sede principal" /></label></div><button className="button" disabled={pending}>{pending ? "Guardando…" : "Guardar empresa"}</button><Feedback state={state} /></form>;
}

export function WarehouseForm() {
  const [state, action, pending] = useActionState(createWarehouse, { message: "" });
  return <form action={action} className="settings-form"><div className="form-grid compact"><label className="field">Código<input name="code" required minLength={2} maxLength={20} placeholder="PRINCIPAL" /></label><label className="field">Nombre<input name="name" required minLength={2} maxLength={100} placeholder="Almacén principal" /></label><label className="field wide">Dirección<input name="address" maxLength={300} placeholder="Ubicación del almacén" /></label></div><button className="button" disabled={pending}>{pending ? "Creando…" : "Crear almacén"}</button><Feedback state={state} /></form>;
}

export function BcvRateForm() {
  const [state, action, pending] = useActionState(syncBcvRate, { message: "" });
  return <form action={action} className="settings-form"><div className="bcv-sync"><span className="bcv-mark">BCV</span><div><strong>Consulta oficial USD/VES</strong><p>La tasa y la fecha de vigencia se leen directamente desde bcv.org.ve y se guardan en el historial.</p></div></div><button className="button" disabled={pending}>{pending ? "Consultando BCV…" : "Actualizar tasa desde BCV ↗"}</button><Feedback state={state} /></form>;
}
