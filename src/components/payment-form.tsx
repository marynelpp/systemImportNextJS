"use client";
import { useActionState } from "react";
import { registerPayment } from "@/app/actions/ventas";

export default function PaymentForm({ order, currencies }: { order: number; currencies: { Codigo: string }[] }) {
  const [state, action, pending] = useActionState(registerPayment, { message: "" });
  return <form action={action} className="payment-form">
    <input type="hidden" name="order" value={order}/>
    <div className="payment-form-heading"><div className="eyebrow">NUEVO COBRO</div><p>Registra el pago y, si lo tienes, guarda su comprobante.</p></div>
    <div className="payment-fields">
      <label className="field">Monto<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required/></label>
      <label className="field">Moneda<select name="currency">{currencies.map((currency) => <option key={currency.Codigo}>{currency.Codigo}</option>)}</select></label>
      <label className="field">Fecha<input name="date" type="date" required/></label>
      <label className="field">Método<select name="method"><option value="pago_movil">Pago móvil</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="zelle">Zelle</option><option value="punto_venta">Punto de venta</option><option value="otro">Otro</option></select></label>
      <label className="field">Referencia<input name="reference" placeholder="Nro. referencia"/></label>
      <label className="field payment-proof">Comprobante<input name="attachments" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple/><small>Imagen o PDF · máximo 8 MB por archivo.</small></label>
    </div>
    <div className="payment-form-footer"><button className="button" disabled={pending}>{pending ? "Guardando…" : "Registrar cobro"}</button>{state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}</div>
  </form>;
}
