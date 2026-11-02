import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";

const date = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const user=await requireUser("pedidos.ver");
  const url = new URL(request.url), start = date(url.searchParams.get("start")), end = date(url.searchParams.get("end"));
  const rows = await (await db()).request().input("company",sql.Int,user.EmpresaId).input("start",sql.Date,start).input("end",sql.Date,end).query(`
    SELECT p.Numero,CONVERT(varchar(10),p.Fecha,23) Fecha,c.Nombre Cliente,ISNULL(a.Nombre,N'Sin almacén asignado') Almacen,pr.Codigo,pr.Nombre Producto,d.Cantidad,
      CASE WHEN p.MonedaCodigo='VES' AND p.TasaBCV>0 THEN d.PrecioUnitario/p.TasaBCV ELSE d.PrecioUnitario END PrecioUSD,
      CASE WHEN p.MonedaCodigo='VES' AND p.TasaBCV>0 THEN d.Cantidad*d.PrecioUnitario/p.TasaBCV ELSE d.Cantidad*d.PrecioUnitario END VentaUSD,
      ISNULL(costos.Costo,0) CostoUSD
    FROM importadora.PedidosVenta p JOIN importadora.Clientes c ON c.Id=p.ClienteId JOIN importadora.PedidoVentaDetalles d ON d.PedidoVentaId=p.Id JOIN importadora.Productos pr ON pr.Id=d.ProductoId LEFT JOIN importadora.Almacenes a ON a.Id=p.AlmacenId
    LEFT JOIN (SELECT PedidoVentaDetalleId,SUM(Cantidad*CostoUnitario) Costo FROM importadora.VentaLoteAsignaciones GROUP BY PedidoVentaDetalleId) costos ON costos.PedidoVentaDetalleId=d.Id
    WHERE p.EmpresaId=@company AND p.Estado='confirmado' AND (@start IS NULL OR p.Fecha>=@start) AND (@end IS NULL OR p.Fecha<=@end) ORDER BY p.Fecha,p.Numero,d.Id`);
  const header=["Pedido","Fecha","Cliente","Almacén","Código","Producto","Cantidad","Precio USD","Venta USD","Costo USD","Utilidad USD"];
  const body=rows.recordset.map((r)=>[r.Numero,r.Fecha,r.Cliente,r.Almacen,r.Codigo,r.Producto,Number(r.Cantidad).toFixed(2),Number(r.PrecioUSD).toFixed(2),Number(r.VentaUSD).toFixed(2),Number(r.CostoUSD).toFixed(2),(Number(r.VentaUSD)-Number(r.CostoUSD)).toFixed(2)].map(cell).join(",")).join("\r\n");
  return new Response(`\uFEFF${header.map(cell).join(",")}\r\n${body}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="ventas-usd-${start ?? "todo"}-${end ?? "todo"}.csv"`}});
}
