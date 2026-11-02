"use client";

import { useActionState, useState } from "react";
import { registerPaymentWithBalance } from "@/app/actions/ventas";

const money = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentForm({ order, rate }: { order: number; rate: number }) {
  const [state, action, pending] = useActionState(registerPaymentWithBalance, { message: "" });
  const [currency, setCurrency] = useState<"USD" | "VES">("VES");
  const [amount, setAmount] = useState("");
  const equivalent = Number(amount) && currency === "VES" ? Number(amount) / rate : Number(amount);
  return <form action={action} className="payment-form">
    <input type="hidden" name="order" value={order} />
    <div className="payment-form-heading"><div className="eyebrow">NUEVO COBRO</div><p>La deuda se controla en USD. Si recibes Bs., se guardan el monto recibido, la tasa del pedido y su equivalente en USD.</p></div>
    <div className="payment-fields">
      <label className="field">Monto recibido ({currency === "VES" ? "Bs." : "USD"})<input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="0,00" required /></label>
      <label className="field">Recibido en<select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "VES")}><option value="VES">Bs. (VES)</option><option value="USD">USD</option></select></label>
      <label className="field">Equivalente USD<input value={Number.isFinite(equivalent) && equivalent > 0 ? `USD ${money(equivalent)}` : "USD 0,00"} readOnly /><small>{currency === "VES" ? `Tasa confirmada del pedido: Bs. ${money(rate)} por USD.` : "Pago recibido directamente en USD."}</small></label>
      <label className="field">Fecha<input name="date" type="date" required /></label>
      <label className="field">Método<select name="method"><option value="pago_movil">Pago móvil</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="zelle">Zelle</option><option value="punto_venta">Punto de venta</option><option value="otro">Otro</option></select></label>
      <label className="field">Referencia<input name="reference" placeholder="Nro. referencia" /></label>
      <label className="field payment-proof">Comprobante<input name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /><small>Imagen o PDF · máximo 8 MB por archivo.</small></label>
    </div>
    <div className="payment-form-footer"><button className="button" disabled={pending}>{pending ? "Guardando…" : "Registrar cobro"}</button>{state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}</div>
  </form>;
}
