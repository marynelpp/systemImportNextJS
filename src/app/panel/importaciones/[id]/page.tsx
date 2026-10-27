import Link from "next/link";
import { addImportExpense, deleteImportExpense, receiveImport, updateImport } from "@/app/actions/compras";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate, venezuelanToday } from "@/lib/dates";

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("compras.ver");
  const id = Number((await params).id);
  const pool = await db();
  const [result, expenses, currencies, lines, warehouses, receipt] = await Promise.all([
    pool.request().input("id", sql.Int, id).query("SELECT i.*,o.Numero,o.MonedaCodigo,pr.Nombre Proveedor FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE i.Id=@id"),
    pool.request().input("id", sql.Int, id).query("SELECT Id,Concepto,Monto,MonedaCodigo,Fecha,TasaBCV FROM importadora.ImportacionGastos WHERE ImportacionId=@id ORDER BY Fecha DESC,Id DESC"),
    pool.request().query("SELECT Codigo,Nombre FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().input("id", sql.Int, id).query("SELECT d.Id,d.Cantidad,d.CostoUnitario,p.Nombre Producto,p.Codigo FROM importadora.Importaciones i JOIN importadora.OrdenCompraDetalles d ON d.OrdenCompraId=i.OrdenCompraId JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE i.Id=@id ORDER BY d.Id"),
    pool.request().query("SELECT Id,Codigo,Nombre FROM importadora.Almacenes WHERE Activo=1 ORDER BY Nombre"),
    pool.request().input("id", sql.Int, id).query("SELECT r.Id,r.Fecha,a.Nombre Almacen FROM importadora.RecepcionesImportacion r JOIN importadora.Almacenes a ON a.Id=r.AlmacenId WHERE r.ImportacionId=@id"),
  ]);
  const item = result.recordset[0];
  if (!item) return <p>Importación no encontrada.</p>;

  const currentExpenses = expenses.recordset;
  const unsupportedExpenses = currentExpenses.filter((expense) => expense.MonedaCodigo !== item.MonedaCodigo && !(item.MonedaCodigo === "USD" && expense.MonedaCodigo === "VES" && expense.TasaBCV));
  const convertedExpenses = currentExpenses.reduce((total, expense) => {
    if (expense.MonedaCodigo === item.MonedaCodigo) return total + Number(expense.Monto);
    if (item.MonedaCodigo === "USD" && expense.MonedaCodigo === "VES" && expense.TasaBCV) return total + Number(expense.Monto) / Number(expense.TasaBCV);
    return total;
  }, 0);
  const totalGoods = lines.recordset.reduce((total, line) => total + Number(line.Cantidad) * Number(line.CostoUnitario), 0);
  const existingReceipt = receipt.recordset[0];
  const today = venezuelanToday();

  return <>
    <Link className="copy-link" href="/panel/importaciones">← Volver a importaciones</Link>
    <h1>{item.Codigo}</h1><p>{item.Proveedor} · Orden {item.Numero}</p>
    <section className="empty-card import-logistics">
      <div className="section-heading"><div><div className="eyebrow">SEGUIMIENTO DEL ENVÍO</div><h2>Logística de la importación</h2></div><span className="badge">{item.Estado}</span></div>
      <form action={updateImport} className="settings-form"><input type="hidden" name="id" value={id}/><div className="form-grid">
        <label className="field">Tipo de envío<select name="shipping" defaultValue={item.TipoEnvio}><option value="maritimo">Marítimo</option><option value="aereo">Aéreo</option><option value="terrestre">Terrestre</option></select></label>
        <label className="field">Estado{item.Estado === "recibida" ? <><input defaultValue="Recibida · recepción cerrada" readOnly/><input type="hidden" name="state" value="aduana"/></> : <select name="state" defaultValue={item.Estado}><option value="preparacion">Preparación</option><option value="en_transito">En tránsito</option><option value="aduana">Aduana</option></select>}</label>
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
        <label className="field field-wide">Concepto<input name="concept" required placeholder="Ej. Flete marítimo"/></label><label className="field">Monto<input name="amount" type="number" min="0" step="0.01" required placeholder="0,00"/></label><label className="field">Moneda<select name="currency">{currencies.recordset.map((currency) => <option key={currency.Codigo} value={currency.Codigo}>{currency.Codigo} · {currency.Nombre}</option>)}</select></label><label className="field">Fecha<input name="date" type="date" defaultValue={today} required/></label><label className="field">Tasa BCV <small>para gastos en Bs.</small><input name="rate" type="number" min="0" step="0.01" placeholder="Ej. 887,30"/></label><button className="button expense-submit">Agregar gasto</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Concepto</th><th>Fecha</th><th>Monto</th><th>Tasa BCV</th><th></th></tr></thead><tbody>{currentExpenses.map((expense) => <tr key={expense.Id}><td>{expense.Concepto}</td><td>{formatVenezuelanDate(expense.Fecha)}</td><td>{money(Number(expense.Monto), expense.MonedaCodigo)}</td><td>{expense.TasaBCV ? `Bs. ${Number(expense.TasaBCV).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</td><td><form action={deleteImportExpense}><input type="hidden" name="id" value={expense.Id}/><input type="hidden" name="importId" value={id}/><button className="catalog-action danger">Eliminar</button></form></td></tr>)}</tbody></table>{!currentExpenses.length && <p className="empty-text">Aún no has registrado gastos para esta importación.</p>}</div>
    </section>
    <section className="empty-card landed-cost">
      <div className="section-heading"><div><div className="eyebrow">COSTO ATERRIZADO</div><h2>Distribución previa a la recepción</h2><p>Los gastos se reparten proporcionalmente al valor de compra de cada producto y se congelan al recibir la mercancía.</p></div><strong>{money(convertedExpenses, item.MonedaCodigo)}</strong></div>
      {unsupportedExpenses.length > 0 && <p className="form-message error">Hay {unsupportedExpenses.length} gasto(s) sin conversión a {item.MonedaCodigo}. Para recibir, usa la moneda de la orden o gastos en Bs. con tasa BCV.</p>}
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Mercancía</th><th>Gastos asignados</th><th>Total aterrizado</th></tr></thead><tbody>{lines.recordset.map((line) => { const merchandise = Number(line.Cantidad) * Number(line.CostoUnitario); const allocated = totalGoods ? convertedExpenses * merchandise / totalGoods : 0; return <tr key={line.Id}><td>{line.Codigo} · {line.Producto}</td><td>{money(merchandise, item.MonedaCodigo)}</td><td>{money(allocated, item.MonedaCodigo)}</td><td>{money(merchandise + allocated, item.MonedaCodigo)}</td></tr>; })}</tbody></table></div>
    </section>
    <section className="empty-card import-reception">
      <div className="section-heading"><div><div className="eyebrow">ENTRADA A ALMACÉN</div><h2>Recepción e inventario</h2><p>Registra lo realmente recibido. El sistema crea un lote por producto y su movimiento de entrada.</p></div></div>
      {existingReceipt ? <p className="form-message success">Recepción registrada el {formatVenezuelanDate(existingReceipt.Fecha)} en {existingReceipt.Almacen}. Los costos e inventario de esta importación ya están cerrados.</p> : item.Estado !== "aduana" ? <p className="empty-text">Coloca la importación en estado <strong>Aduana</strong> cuando la mercancía esté lista para ser recibida.</p> : <form action={receiveImport} className="settings-form reception-form"><input type="hidden" name="importId" value={id}/><div className="form-grid"><label className="field">Almacén<select name="warehouseId" required>{warehouses.recordset.map((warehouse) => <option key={warehouse.Id} value={warehouse.Id}>{warehouse.Codigo} · {warehouse.Nombre}</option>)}</select></label><label className="field">Fecha de recepción<input name="date" type="date" defaultValue={today} required/></label><label className="field field-span">Observaciones<input name="notes" placeholder="Faltantes, daños, acta o comentario de recepción"/></label></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Pedido</th><th>Recibido</th><th>Faltante</th></tr></thead><tbody>{lines.recordset.map((line) => <tr key={line.Id}><td>{line.Codigo} · {line.Producto}</td><td>{Number(line.Cantidad).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td><input className="quantity-input" name={`received-${line.Id}`} type="number" min="0" max={String(line.Cantidad)} step="0.01" defaultValue={Number(line.Cantidad).toFixed(2)} required/></td><td>Se calcula al guardar</td></tr>)}</tbody></table></div><button className="button" disabled={unsupportedExpenses.length > 0}>Confirmar recepción e ingresar al inventario</button></form>}
    </section>
  </>;
}
