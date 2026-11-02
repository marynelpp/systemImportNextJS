"use client";

export function PrintReceiptButton() {
  return <button className="button no-print" type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>;
}
