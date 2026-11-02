import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDateTime } from "@/lib/dates";
import { listingParams } from "@/lib/listing";
import ListControls from "@/components/list-controls";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user=await requireUser("auditoria.ver");
  const pool=await db(),{query,page,limit}=listingParams(await searchParams), scope=user.EsAdministradorSistema ? "1=1" : "a.EmpresaId=@company";
  const count=await pool.request().input("company",sql.Int,user.EmpresaId).input("q",sql.NVarChar(100),query).query(`SELECT COUNT(*) Total FROM importadora.Auditoria a LEFT JOIN importadora.Usuarios u ON u.Id=a.UsuarioId WHERE ${scope} AND (@q='' OR a.Accion LIKE '%'+@q+'%' OR a.Detalle LIKE '%'+@q+'%' OR u.Nombre LIKE '%'+@q+'%')`);
  const total=count.recordset[0].Total,activePage=Math.min(page,Math.max(1,Math.ceil(total/limit)));
  const result=await pool.request().input("company",sql.Int,user.EmpresaId).input("q",sql.NVarChar(100),query).input("offset",sql.Int,(activePage-1)*limit).input("take",sql.Int,limit).query(`SELECT a.Id,a.Accion,a.EntidadId,a.Detalle,a.CreadoEn,u.Nombre,COALESCE(e.NombreComercial,e.NombreLegal) Empresa FROM importadora.Auditoria a LEFT JOIN importadora.Usuarios u ON u.Id=a.UsuarioId LEFT JOIN importadora.Empresas e ON e.Id=a.EmpresaId WHERE ${scope} AND (@q='' OR a.Accion LIKE '%'+@q+'%' OR a.Detalle LIKE '%'+@q+'%' OR u.Nombre LIKE '%'+@q+'%') ORDER BY a.Id DESC OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY`);
  return <><h1>Historial de seguridad.</h1><p>{user.EsAdministradorSistema ? "Auditoría de todas las empresas." : "Auditoría de la empresa activa."} · Hora de Venezuela.</p><section className="empty-card"><h2>Eventos registrados</h2><ListControls basePath="/panel/auditoria" query={query} page={activePage} total={total} limit={limit} placeholder="Buscar acción, usuario o detalle"/><div className="table-wrap"><table><thead><tr><th>Fecha</th>{user.EsAdministradorSistema&&<th>Empresa</th>}<th>Responsable</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>{result.recordset.map(item=><tr key={item.Id}><td>{formatVenezuelanDateTime(item.CreadoEn)}</td>{user.EsAdministradorSistema&&<td>{item.Empresa??"—"}</td>}<td>{item.Nombre??"Proceso de registro / local"}</td><td>{item.Accion}</td><td>{item.EntidadId} {item.Detalle}</td></tr>)}</tbody></table>{!result.recordset.length&&<p className="empty-text">No hay eventos que coincidan con el filtro.</p>}</div></section></>;
}
