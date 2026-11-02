"use client";

import { useActionState, useState } from "react";
import { addSaleLineWithRate, createUsdSaleOrder } from "@/app/actions/ventas";

const Feedback = ({ state }: { state: { message: string; success?: boolean } }) => state.message ? <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p> : null;
const format = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SaleOrderForm({ clients, warehouses }: { clients: { Id: number; Nombre: string }[]; currencies: { Codigo: string }[]; warehouses: { Id: number; Nombre: string }[] }) {
  const [state, action, pending] = useActionState(createUsdSaleOrder, { message: "" });

  return <form action={action} className="settings-form">
    <div className="form-grid">
      <label className="field">Cliente<select name="client" required><option value="">Selecciona</option>{clients.map((client) => <option key={client.Id} value={client.Id}>{client.Nombre}</option>)}</select></label>
      <label className="field">Fecha<input name="date" type="date" required /></label>
      <label className="field">Tipo de venta<select name="priceType" defaultValue="detal"><option value="detal">Detal</option><option value="mayor">Mayor</option></select></label>
      <label className="field">Despachar desde<select name="warehouse" required><option value="">Selecciona almacén</option>{warehouses.map((warehouse) => <option key={warehouse.Id} value={warehouse.Id}>{warehouse.Nombre}</option>)}</select><small className="field-help">Solo mostrará el stock de este almacén.</small></label>
      <label className="field">Moneda<input value="USD" readOnly /><input type="hidden" name="currency" value="USD" /><small className="field-help">Toda la operación se controla en dólares.</small></label>
      <label className="field field-span">Observaciones<input name="notes" placeholder="Entrega, forma de pago u observaciones" /></label>
    </div>
    <button className="button" disabled={pending}>{pending ? "Creando…" : "Crear pedido"}</button><Feedback state={state} />
  </form>;
}

export function SaleLineForm({ order, products, priceType, canChangePriceType, currency = "USD", bcvRate }: { order: number; products: { Id: number; Codigo: string; Nombre: string; Existencia: number; PrecioDetalUSD: number | null; PrecioMayorUSD: number | null }[]; priceType: "detal" | "mayor"; canChangePriceType: boolean; currency?: string; bcvRate?: number }) {
  const [state, action, pending] = useActionState(addSaleLineWithRate, { message: "" });
  const [productId, setProductId] = useState("");
  const [selectedPriceType, setSelectedPriceType] = useState<"detal" | "mayor">(priceType);
  const selected = products.find((product) => String(product.Id) === productId);
  const basePrice = selected ? (selectedPriceType === "mayor" ? selected.PrecioMayorUSD : selected.PrecioDetalUSD) : null;
  const price = basePrice !== null && basePrice !== undefined && currency === "VES" && bcvRate ? Number(basePrice) * bcvRate : basePrice;
  const label = selectedPriceType === "mayor" ? "Mayor" : "Detal";
  const display = price === null || price === undefined ? (selected ? "Sin precio configurado" : "Selecciona un producto") : `${currency === "VES" ? "Bs." : "USD"} ${format(Number(price))}`;
  const explanation = currency === "VES" ? `Precio ${label.toLowerCase()} convertido con la tasa BCV congelada en este pedido.` : `Precio ${label.toLowerCase()} configurado en el producto.`;
  return <form action={action} className="settings-form sale-line-form"><input type="hidden" name="order" value={order} />{!canChangePriceType && <input type="hidden" name="priceType" value={selectedPriceType} />}<div className="form-grid">
    <label className="field wide">Producto<select name="product" required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecciona producto disponible</option>{products.map((product) => <option key={product.Id} value={product.Id}>{product.Codigo} · {product.Nombre} — stock {format(Number(product.Existencia))}</option>)}</select></label>
    <label className="field">Cantidad<input name="quantity" type="number" min="0.01" step="0.01" required /></label>
    <label className="field">Tipo de precio<select name="priceType" value={selectedPriceType} onChange={(event) => setSelectedPriceType(event.target.value as "detal" | "mayor")} disabled={!canChangePriceType}><option value="detal">Detal</option><option value="mayor">Mayor</option></select><small className="field-help">{canChangePriceType ? "Elige el precio para este pedido." : "No puede cambiarse después de agregar productos."}</small></label>
    <label className="field">Precio unitario<input value={display} readOnly aria-label={`Precio ${label.toLowerCase()} configurado`} /><small className="field-help">{explanation}</small></label>
  </div><button className="button small" disabled={pending}>{pending ? "Agregando…" : "Agregar producto"}</button><Feedback state={state} /></form>;
}
