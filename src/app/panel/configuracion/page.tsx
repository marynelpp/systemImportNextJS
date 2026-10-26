import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BcvRateForm, CompanyForm, WarehouseForm } from "@/components/configuration-forms";

const venezuelanDate = (value: Date) =>
  new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeZone: "UTC" }).format(value);

export default async function ConfigurationPage() {
  await requireUser("configuracion.administrar");
  const pool = await db();
  const [company, warehouses, currencies, rates] = await Promise.all([
    pool.request().query("SELECT NombreLegal,NombreComercial,Rif,Telefono,Email,Direccion FROM importadora.EmpresaConfiguracion WHERE Id=1"),
    pool.request().query("SELECT Id,Codigo,Nombre,Direccion,Activo FROM importadora.Almacenes ORDER BY Activo DESC,Nombre"),
    pool.request().query("SELECT Codigo,Nombre,Simbolo,Decimales FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().query("SELECT TOP(30) t.FechaVigencia,t.Tasa,t.Fuente,t.Observacion,u.Nombre RegistradaPor FROM importadora.TasasCambio t JOIN importadora.Usuarios u ON u.Id=t.RegistradaPorUsuarioId WHERE t.MonedaBase='USD' AND t.MonedaDestino='VES' ORDER BY t.FechaVigencia DESC"),
  ]);
  return <>
    <h1>Configuración de la empresa.</h1>
    <p>Define la estructura que usará toda la operación: empresa, almacenes y valores de referencia.</p>
    <section className="settings-section"><div><div className="eyebrow">IDENTIDAD DE LA EMPRESA</div><h2>Datos principales.</h2><p>Se usarán más adelante en documentos, reportes y ventas.</p></div><CompanyForm company={company.recordset[0]} /></section>
    <section className="settings-section"><div><div className="eyebrow">ALMACENES</div><h2>Dónde se guarda la mercancía.</h2><p>Podrás seleccionar el almacén de cada entrada, transferencia y despacho.</p></div><div><WarehouseForm /><div className="warehouse-list">{warehouses.recordset.length ? warehouses.recordset.map((warehouse) => <article key={warehouse.Id} className="warehouse-item"><span className="warehouse-code">{warehouse.Codigo}</span><div><strong>{warehouse.Nombre}</strong><p>{warehouse.Direccion || "Sin dirección registrada"}</p></div><span className="badge">{warehouse.Activo ? "Activo" : "Inactivo"}</span></article>) : <p className="empty-text">Aún no hay almacenes. Crea el principal antes de registrar inventario.</p>}</div></div></section>
    <section className="settings-section"><div><div className="eyebrow">MONEDAS Y TASA BCV</div><h2>USD como base. VES al día.</h2><p>La tasa indica cuántos bolívares equivale un dólar. Cada fecha queda guardada para que las futuras ventas conserven su tasa histórica.</p><div className="currency-list">{currencies.recordset.map((currency) => <span key={currency.Codigo}>{currency.Simbolo} <strong>{currency.Codigo}</strong> · {currency.Nombre}</span>)}</div></div><div><BcvRateForm /><div className="table-wrap rate-table"><table><thead><tr><th>Vigencia</th><th>1 USD equivale</th><th>Fuente</th><th>Registró</th></tr></thead><tbody>{rates.recordset.map((rate) => <tr key={`${rate.FechaVigencia}-${rate.Tasa}`}><td>{venezuelanDate(rate.FechaVigencia)}</td><td>Bs. {Number(rate.Tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td><td><span className="badge">{rate.Fuente}</span>{rate.Observacion && <small className="table-note">{rate.Observacion}</small>}</td><td>{rate.RegistradaPor}</td></tr>)}</tbody></table>{!rates.recordset.length && <p className="empty-text">Todavía no hay tasas registradas. Actualiza desde el BCV antes de empezar a vender en bolívares.</p>}</div></div></section>
  </>;
}
