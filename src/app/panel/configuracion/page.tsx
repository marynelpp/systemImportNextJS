import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { BcvRateForm, CompanyForm, SalesMarginsForm, WarehouseForm } from "@/components/configuration-forms";
import { formatVenezuelanDate } from "@/lib/dates";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";

export default async function ConfigurationPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user = await requireUser("configuracion.administrar");
  const pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);
  const rateFilter = "WHERE t.EmpresaId=@company AND t.MonedaBase='USD' AND t.MonedaDestino='VES' AND (@query='' OR t.Fuente LIKE '%'+@query+'%' OR t.Observacion LIKE '%'+@query+'%' OR u.Nombre LIKE '%'+@query+'%')";
  const [company, warehouses, currencies, rates, rateCount, margins] = await Promise.all([
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT NombreLegal,NombreComercial,Rif,Telefono,Email,Direccion FROM importadora.Empresas WHERE Id=@company AND Activa=1"),
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT Id,Codigo,Nombre,Direccion,Activo FROM importadora.Almacenes WHERE EmpresaId=@company ORDER BY Activo DESC,Nombre"),
    pool.request().query("SELECT Codigo,Nombre,Simbolo,Decimales FROM importadora.Monedas WHERE Activa=1 ORDER BY Codigo"),
    pool.request().input("company", sql.Int, user.EmpresaId).input("query", sql.NVarChar(100), query).input("offset", sql.Int, offset).input("limit", sql.Int, limit).query(`SELECT t.FechaVigencia,t.Tasa,t.Fuente,t.Observacion,u.Nombre RegistradaPor FROM importadora.TasasCambio t JOIN importadora.Usuarios u ON u.Id=t.RegistradaPorUsuarioId ${rateFilter} ORDER BY t.FechaVigencia DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`),
    pool.request().input("company", sql.Int, user.EmpresaId).input("query", sql.NVarChar(100), query).query(`SELECT COUNT(*) AS Total FROM importadora.TasasCambio t JOIN importadora.Usuarios u ON u.Id=t.RegistradaPorUsuarioId ${rateFilter}`),
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT MargenMayor,MargenDetal FROM importadora.ConfiguracionMargenesVenta WHERE EmpresaId=@company AND Id=1"),
  ]);
  const totalRates = rateCount.recordset[0].Total as number;
  return <>
    <h1>Configuración de la empresa.</h1>
    <p>Define la estructura que usará toda la operación: empresa, almacenes y valores de referencia.</p>
    <section className="settings-section"><div><div className="eyebrow">IDENTIDAD DE LA EMPRESA</div><h2>Datos principales.</h2><p>Se usarán más adelante en documentos, reportes y ventas.</p></div><CompanyForm company={company.recordset[0]} /></section>
    <section className="settings-section"><div><div className="eyebrow">ALMACENES</div><h2>Dónde se guarda la mercancía.</h2><p>Podrás seleccionar el almacén de cada entrada, transferencia y despacho.</p></div><div><WarehouseForm /><div className="warehouse-list">{warehouses.recordset.length ? warehouses.recordset.map((warehouse) => <article key={warehouse.Id} className="warehouse-item"><span className="warehouse-code">{warehouse.Codigo}</span><div><strong>{warehouse.Nombre}</strong><p>{warehouse.Direccion || "Sin dirección registrada"}</p></div><span className="badge">{warehouse.Activo ? "Activo" : "Inactivo"}</span></article>) : <p className="empty-text">Aún no hay almacenes. Crea el principal antes de registrar inventario.</p>}</div></div></section>
    <section className="settings-section"><div><div className="eyebrow">POLÍTICA DE PRECIOS</div><h2>Márgenes sugeridos de venta.</h2><p>Se aplican sobre el costo aterrizado promedio disponible para proponer precios Mayor y Detal. No cambian precios publicados sin tu confirmación.</p></div><SalesMarginsForm margins={margins.recordset[0]}/></section>
    <section className="settings-section"><div><div className="eyebrow">MONEDAS Y TASA BCV</div><h2>USD como base. VES al día.</h2><p>La tasa indica cuántos bolívares equivale un dólar. Cada fecha queda guardada para que las futuras ventas conserven su tasa histórica.</p><div className="currency-list">{currencies.recordset.map((currency) => <span key={currency.Codigo}>{currency.Simbolo} <strong>{currency.Codigo}</strong> · {currency.Nombre}</span>)}</div></div><div><BcvRateForm /><ListControls basePath="/panel/configuracion" query={query} page={page} total={totalRates} limit={limit} includePagination={false} placeholder="Buscar fuente, observación o usuario"/><div className="table-wrap rate-table"><table><thead><tr><th>Vigencia</th><th>1 USD equivale</th><th>Fuente</th><th>Registró</th></tr></thead><tbody>{rates.recordset.map((rate) => <tr key={`${rate.FechaVigencia}-${rate.Tasa}`}><td>{formatVenezuelanDate(rate.FechaVigencia)}</td><td>Bs. {Number(rate.Tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td><span className="badge">{rate.Fuente}</span>{rate.Observacion && <small className="table-note">{rate.Observacion}</small>}</td><td>{rate.RegistradaPor}</td></tr>)}</tbody></table>{!rates.recordset.length && <p className="empty-text">No hay tasas que coincidan con el filtro.</p>}<ListPagination basePath="/panel/configuracion" query={query} page={page} total={totalRates} limit={limit}/></div></div></section>
  </>;
}
