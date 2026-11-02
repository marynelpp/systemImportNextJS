"use client";

import { useActionState, useEffect, useState } from "react";
import { transferInventoryLot } from "@/app/actions/compras";
import type { FormState } from "@/app/actions/auth";

type Warehouse = { Id: number; Nombre: string };
type Props = { lotId: number; product: string; sourceWarehouseId: number; sourceWarehouse: string; available: string; warehouses: Warehouse[] };
const initialState: FormState = { message: "" };

export default function InventoryTransferModal({ lotId, product, sourceWarehouseId, sourceWarehouse, available, warehouses }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(transferInventoryLot, initialState);
  const destinations = warehouses.filter((warehouse) => warehouse.Id !== sourceWarehouseId);
  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (!destinations.length) return <span className="table-note">Crea otro almacén para transferir.</span>;
  return <>
    <button className="catalog-action" type="button" onClick={() => setOpen(true)}>Transferir</button>
    {open && <div className="feedback-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="inventory-transfer-modal" role="dialog" aria-modal="true" aria-labelledby={`transfer-title-${lotId}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
        <div className="eyebrow">TRANSFERENCIA DE INVENTARIO</div>
        <h2 id={`transfer-title-${lotId}`}>{product}</h2>
        <p>Desde <strong>{sourceWarehouse}</strong> · Disponible: <strong>{available}</strong></p>
        <p className="field-help">La mercancía conserva el mismo costo aterrizado y queda registrada en ambos almacenes.</p>
        <form action={formAction} className="settings-form modal-form">
          <input type="hidden" name="lotId" value={lotId} />
          <label className="field">Almacén de destino
            <select name="destinationWarehouseId" required defaultValue="">
              <option value="" disabled>Selecciona el almacén</option>
              {destinations.map((warehouse) => <option key={warehouse.Id} value={warehouse.Id}>{warehouse.Nombre}</option>)}
            </select>
          </label>
          <label className="field">Cantidad a transferir<input name="quantity" type="number" min="0.01" step="0.01" placeholder="Ej. 5" required /></label>
          <label className="field">Observación <span className="optional">(opcional)</span><input name="notes" maxLength={300} placeholder="Ej. reposición de sucursal" /></label>
          {state.message && <p className={`form-message ${state.success ? "success" : "error"}`}>{state.message}</p>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button" disabled={pending}>{pending ? "Transfiriendo…" : "Confirmar transferencia"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
