import Link from "next/link";
import { addImportExpense, deleteImportExpense, updateImport } from "@/app/actions/compras";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate, venezuelanToday } from "@/lib/dates";

export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("compras.ver");
  const id = Number((await params).id), pool = await db();
  const [result, expenses, currencies] = await Promise.all([
    pool.request().input("id", sql.Int, id).query("SELECT i.*,o.Numero,pr.Nombre Proveedor FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE i.Id=@id"),
    pool.request().input("id", sql.Int, id).query("SELECT Id,Concepto,Monto,MonedaCodigo,Fecha,TasaBCV FROM importadora.ImportacionGastos WHERE ImportacionId=@id ORDER BY Fecha DESC,Id DESC"),
    pool.request().query("SELECT Codigo,Nombre FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
  ]);
  const item = result.recordset[0];
  if (!item) return <p>Importación no encontrada.</p>;
  const today = venezuelanToday();
  return <>
    <Link className="copy-link" href="/panel/importaciones">← Volver a importaciones</Link>
    <h1>{item.Codigo}</h1><p>{item.Proveedor} · Orden {item.Numero}</p>
    <section className="empty-card import-logistics">
      <div className="section-heading"><div><div className="eyebrow">SEGUIMIENTO DEL ENVÍO</div><h2>Logística de la importación</h2></div><span className="badge">{item.Estado}</span></div>
      <form action={updateImport} className="settings-form"><input type="hidden" name="id" value={id}/><div className="form-grid">
        <label className="field">Tipo de envío<select name="shipping" defaultValue={item.TipoEnvio}><option value="maritimo">Marítimo</option><option value="aereo">Aéreo</option><option value="terrestre">Terrestre</option></select></label>
        <label className="field">Estado<select name="state" defaultValue={item.Estado}><option value="preparacion">Preparación</option><option value="en_transito">En tránsito</option><option value="aduana">Aduana</option><option value="recibida">Recibida</option></select></label>
        <label className="field">Agente de carga<input name="agent" defaultValue={item.AgenteCarga ?? ""} placeholder="Ej. DHL, carguera o agente"/></label>
        <label className="field">Casillero<input name="box" defaultValue={item.Casillero ?? ""} placeholder="Ej. dirección o código de casillero"/></label>
        <label className="field">Guía / contenedor<input name="guide" defaultValue={item.GuiaContenedor ?? ""} placeholder="Ej. BL, AWB o contenedor"/></label>
        <label className="field">Fecha de salida<input name="out" type="date" defaultValue={item.FechaSalida ? String(item.FechaSalida).slice(0, 10) : ""}/></label>
        <label className="field">Llegada estimada<input name="eta" type="date" defaultValue={item.FechaEstimadaLlegada ? String(item.FechaEstimadaLlegada).slice(0, 10) : ""}/></label>
        <label className="field">Llegada real<input name="arrival" type="date" defaultValue={item.FechaLlegada ? String(item.FechaLlegada).slice(0, 10) : ""}/></label>
      </div><button className="button">Guardar logística</button></form>
    </section>
    <section className="empty-card import-expenses">
      <div className="section-heading"><div><div className="eyebrow">COSTOS DE IMPORTACIÓN</div><h2>Gastos asociados</h2><p>Registra flete, aranceles, seguro, almacenaje, casillero u otros costos de este envío.</p></div></div>
      <form action={addImportExpense} className="expense-form"><input type="hidden" name="importId" value={id}/>
        <label className="field field-wide">Concepto<input name="concept" required placeholder="Ej. Flete marítimo"/></label>
        <label className="field">Monto<input name="amount" type="number" min="0" step="0.0001" required placeholder="0,00"/></label>
        <label className="field">Moneda<select name="currency">{currencies.recordset.map((currency) => <option key={currency.Codigo} value={currency.Codigo}>{currency.Codigo} · {currency.Nombre}</option>)}</select></label>
        <label className="field">Fecha<input name="date" type="date" defaultValue={today} required/></label>
        <label className="field">Tasa BCV <small>solo si aplica</small><input name="rate" type="number" min="0" step="0.000001" placeholder="Ej. 887,302000"/></label>
        <button className="button expense-submit">Agregar gasto</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Concepto</th><th>Fecha</th><th>Monto</th><th>Tasa BCV</th><th></th></tr></thead><tbody>{expenses.recordset.map((expense) => <tr key={expense.Id}><td>{expense.Concepto}</td><td>{formatVenezuelanDate(expense.Fecha)}</td><td>{expense.MonedaCodigo} {Number(expense.Monto).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td><td>{expense.TasaBCV ? `Bs. ${Number(expense.TasaBCV).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "—"}</td><td><form action={deleteImportExpense}><input type="hidden" name="id" value={expense.Id}/><input type="hidden" name="importId" value={id}/><button className="catalog-action danger">Eliminar</button></form></td></tr>)}</tbody></table>{!expenses.recordset.length && <p className="empty-text">Aún no has registrado gastos para esta importación.</p>}</div>
    </section>
  </>;
}
