import Link from "next/link";
import { deleteCustomer } from "@/app/actions/ventas";
import CustomerForm from "@/components/customer-form";
import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { listingParams, PAGE_SIZE } from "@/lib/listing";
import ListControls from "@/components/list-controls";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const user=await requireUser("clientes.ver"), pool=await db(), {query,page}=listingParams(await searchParams);
  const count=await pool.request().input("q",sql.NVarChar(100),query).query("SELECT COUNT(*) Total FROM importadora.Clientes WHERE @q='' OR Codigo LIKE '%'+@q+'%' OR Nombre LIKE '%'+@q+'%' OR Documento LIKE '%'+@q+'%' OR Telefono LIKE '%'+@q+'%'");
  const total=count.recordset[0].Total,activePage=Math.min(page,Math.max(1,Math.ceil(total/PAGE_SIZE)));
  const customers=await pool.request().input("q",sql.NVarChar(100),query).input("offset",sql.Int,(activePage-1)*PAGE_SIZE).input("take",sql.Int,PAGE_SIZE).query("SELECT Id,Codigo,Tipo,Nombre,Documento,Telefono,Email,Activo FROM importadora.Clientes WHERE @q='' OR Codigo LIKE '%'+@q+'%' OR Nombre LIKE '%'+@q+'%' OR Documento LIKE '%'+@q+'%' OR Telefono LIKE '%'+@q+'%' ORDER BY Activo DESC,Nombre OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY");
  return <><h1>Clientes</h1><p>Organiza la información comercial antes de registrar pedidos y ventas.</p>{can(user,"clientes.administrar")&&<section className="settings-section"><div><div className="eyebrow">NUEVO CLIENTE</div><h2>Datos comerciales</h2></div><CustomerForm/></section>}<section className="empty-card inventory-section"><h2>Clientes registrados</h2><ListControls basePath="/panel/clientes" query={query} page={activePage} total={total} placeholder="Buscar cliente, código, documento o teléfono"/><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Documento</th><th>Contacto</th><th>Estado</th>{can(user,"clientes.administrar")&&<th>Acciones</th>}</tr></thead><tbody>{customers.recordset.map((customer)=><tr key={customer.Id}><td>{customer.Codigo}</td><td>{customer.Nombre}</td><td>{customer.Documento??"—"}</td><td>{customer.Telefono??customer.Email??"—"}</td><td><span className="badge">{customer.Activo?"Activo":"Inactivo"}</span></td>{can(user,"clientes.administrar")&&<td><Link className="copy-link" href={`/panel/clientes/${customer.Id}`}>Ver / editar</Link><form action={deleteCustomer}><input type="hidden" name="id" value={customer.Id}/><button className="catalog-action danger">Eliminar</button></form></td>}</tr>)}</tbody></table>{!customers.recordset.length&&<p className="empty-text">No hay clientes que coincidan con el filtro.</p>}</div></section></>;
}
