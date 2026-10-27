import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { listingParams, PAGE_SIZE } from "@/lib/listing";
import ListControls from "@/components/list-controls";

export default async function Imports({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  await requireUser("compras.ver");const pool=await db(),{query,page}=listingParams(await searchParams);
  const count=await pool.request().input("q",sql.NVarChar(100),query).query("SELECT COUNT(*) Total FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE @q='' OR i.Codigo LIKE '%'+@q+'%' OR o.Numero LIKE '%'+@q+'%' OR pr.Nombre LIKE '%'+@q+'%' OR i.Estado LIKE '%'+@q+'%'");
  const total=count.recordset[0].Total,activePage=Math.min(page,Math.max(1,Math.ceil(total/PAGE_SIZE)));
  const imports=await pool.request().input("q",sql.NVarChar(100),query).input("offset",sql.Int,(activePage-1)*PAGE_SIZE).input("take",sql.Int,PAGE_SIZE).query("SELECT i.Id,i.Codigo,i.TipoEnvio,i.Estado,i.FechaEstimadaLlegada,o.Numero,pr.Nombre Proveedor FROM importadora.Importaciones i JOIN importadora.OrdenesCompra o ON o.Id=i.OrdenCompraId JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE @q='' OR i.Codigo LIKE '%'+@q+'%' OR o.Numero LIKE '%'+@q+'%' OR pr.Nombre LIKE '%'+@q+'%' OR i.Estado LIKE '%'+@q+'%' ORDER BY i.Id DESC OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY");
  return <><h1>Importaciones.</h1><p>Seguimiento de la mercancía desde origen hasta Venezuela.</p><section className="empty-card"><h2>En tránsito</h2><ListControls basePath="/panel/importaciones" query={query} page={activePage} total={total} placeholder="Buscar importación, orden, proveedor o estado"/><div className="table-wrap"><table><thead><tr><th>Importación</th><th>Orden</th><th>Proveedor</th><th>Envío</th><th>Estado</th><th>Llegada estimada</th><th>Acciones</th></tr></thead><tbody>{imports.recordset.map((item)=><tr key={item.Codigo}><td>{item.Codigo}</td><td>{item.Numero}</td><td>{item.Proveedor}</td><td>{item.TipoEnvio}</td><td><span className="badge">{item.Estado}</span></td><td>{formatVenezuelanDate(item.FechaEstimadaLlegada)}</td><td><Link className="copy-link" href={`/panel/importaciones/${item.Id}`}>Ver / gestionar</Link></td></tr>)}</tbody></table>{!imports.recordset.length&&<p className="empty-text">No hay importaciones que coincidan con el filtro.</p>}</div></section></>;
}
