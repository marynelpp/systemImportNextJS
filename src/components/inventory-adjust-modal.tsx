"use client";

import { useActionState, useEffect, useState } from "react";
import { adjustInventory } from "@/app/actions/compras";
import type { FormState } from "@/app/actions/auth";

type Props = { lotId: number; product: string; available: string };
const initialState: FormState = { message: "" };

export default function InventoryAdjustModal({ lotId, product, available }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(adjustInventory, initialState);
  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);
  return <>
    <button className="catalog-action" type="button" onClick={() => setOpen(true)}>Ajustar</button>
    {open && <div className="feedback-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="inventory-adjust-modal" role="dialog" aria-modal="true" aria-labelledby={`adjust-title-${lotId}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
        <div className="eyebrow">AJUSTE DE INVENTARIO</div>
        <h2 id={`adjust-title-${lotId}`}>{product}</h2>
        <p>Disponible en este lote: <strong>{available}</strong></p>
        <form action={formAction} className="settings-form modal-form"><input type="hidden" name="lotId" value={lotId}/>
          <label className="field">Tipo de ajuste<select name="type" defaultValue="ajuste_salida"><option value="ajuste_entrada">Entrada por corrección</option><option value="ajuste_salida">Salida por corrección</option></select></label>
          <label className="field">Cantidad<input name="quantity" type="number" min="0.01" step="0.01" placeholder="Ej. 2" required/></label>
          <label className="field">Motivo<input name="reason" maxLength={80} placeholder="Ej. diferencia en conteo físico" required/></label>
          {state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button" disabled={pending}>{pending ? "Aplicando…" : "Aplicar ajuste"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
