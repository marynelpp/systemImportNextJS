"use client";

import { useActionState } from "react";
import { refreshUsdDraftBcvRate, type BcvRateFormState } from "@/app/actions/ventas";

export function DraftBcvRate({ order, rate }: { order: number; rate?: number }) {
  const [state, action, pending] = useActionState(refreshUsdDraftBcvRate, { message: "" } as BcvRateFormState);
  return <form action={action} className="draft-bcv-rate"><input type="hidden" name="order" value={order} /><span>Tasa BCV de referencia: <strong>{rate ? `Bs. ${rate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Sin consultar"}</strong></span><button className="button secondary small" disabled={pending}>{pending ? "Actualizando…" : "Actualizar con BCV ahora"}</button><small>El pedido y la ganancia siguen en USD. La tasa se usará al confirmar para cobrar en Bs.</small>{state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}</form>;
}
