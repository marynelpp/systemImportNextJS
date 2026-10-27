"use client";
import { useActionState, useState } from "react";
import { createCustomer } from "@/app/actions/ventas";

export default function CustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomer, { message: "" });
  const [code, setCode] = useState("");
  return <form action={formAction} className="settings-form"><div className="form-grid">
    <label className="field">Código<div className="code-field"><input name="code" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CLI-001"/><button type="button" className="copy-link" onClick={() => setCode(`CLI-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`)}>Generar</button></div></label>
    <label className="field">Tipo<select name="type" defaultValue="natural"><option value="natural">Persona natural</option><option value="empresa">Empresa</option></select></label>
    <label className="field">Nombre o razón social<input name="name" required placeholder="Nombre completo o empresa"/></label>
    <label className="field">Cédula / RIF<input name="document" placeholder="Ej. V-12345678 o J-12345678-9"/></label>
    <label className="field">Teléfono<input name="phone" placeholder="Ej. 0412-1234567"/></label>
    <label className="field">Correo<input name="email" type="email" placeholder="cliente@correo.com"/></label>
    <label className="field wide">Dirección<input name="address" placeholder="Dirección de facturación o entrega"/></label>
    <label className="field wide">Notas<input name="notes" placeholder="Preferencias, condiciones de crédito u observaciones"/></label>
  </div><button className="button" disabled={pending}>{pending ? "Guardando…" : "Registrar cliente"}</button>{state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}</form>;
}
