import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { DeactivateCatalogItem } from "@/components/catalog-actions";
import { db, sql } from "@/lib/db";
import { listingParams, PAGE_SIZE } from "@/lib/listing";
import ListControls from "@/components/list-controls";
import { SupplierForm } from "@/components/catalog-forms";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const user = await requireUser("proveedores.ver"), pool = await db(), { query, page } = listingParams(await searchParams);
  const [countries, count] = await Promise.all([
    pool.request().query("SELECT Codigo,Nombre FROM importadora.Paises WHERE Activo=1 ORDER BY Nombre"),
    pool.request().input("q", sql.NVarChar(100), query).query("SELECT COUNT(*) Total FROM importadora.Proveedores p WHERE @q='' OR p.Codigo LIKE '%'+@q+'%' OR p.Nombre LIKE '%'+@q+'%' OR p.Contacto LIKE '%'+@q+'%'")
  ]);
  const total=count.recordset[0].Total, activePage=Math.min(page,Math.max(1,Math.ceil(total/PAGE_SIZE)));
  const suppliers=await pool.request().input("q",sql.NVarChar(100),query).input("offset",sql.Int,(activePage-1)*PAGE_SIZE).input("take",sql.Int,PAGE_SIZE).query("SELECT p.Id,p.Codigo,p.Nombre,c.Nombre Pais,p.Contacto,p.Email,p.WeChat,p.Activo FROM importadora.Proveedores p JOIN importadora.Paises c ON c.Codigo=p.PaisCodigo WHERE @q='' OR p.Codigo LIKE '%'+@q+'%' OR p.Nombre LIKE '%'+@q+'%' OR p.Contacto LIKE '%'+@q+'%' ORDER BY p.Activo DESC,p.Nombre OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY");
  return <><h1>Proveedores.</h1><p>Empresas y contactos de las que compras mercancía para importar.</p>{can(user,"proveedores.administrar")&&<section className="settings-section"><div><div className="eyebrow">COMPRAS EN ORIGEN</div><h2>Registrar proveedor.</h2><p>Luego podrás vincularlo a productos, costos y órdenes de compra.</p></div><SupplierForm countries={countries.recordset}/></section>}<section className="empty-card"><h2>Proveedores registrados</h2><ListControls basePath="/panel/proveedores" query={query} page={activePage} total={total} placeholder="Buscar proveedor, código o contacto"/><div className="table-wrap"><table><thead><tr><th>Código</th><th>Proveedor</th><th>País</th><th>Contacto</th><th>Canal</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{suppliers.recordset.map((supplier)=><tr key={supplier.Codigo}><td>{supplier.Codigo}</td><td>{supplier.Nombre}</td><td>{supplier.Pais}</td><td>{supplier.Contacto||"—"}</td><td>{supplier.WeChat||supplier.Email||"—"}</td><td><span className="badge">{supplier.Activo?"Activo":"Inactivo"}</span></td><td><Link className="copy-link" href={`/panel/proveedores/${supplier.Id}`}>Ver / editar</Link>{supplier.Activo&&can(user,"proveedores.administrar")&&<DeactivateCatalogItem id={supplier.Id} entity="proveedor"/>}</td></tr>)}</tbody></table>{!suppliers.recordset.length&&<p className="empty-text">No hay proveedores que coincidan con el filtro.</p>}</div></section></>;
}
