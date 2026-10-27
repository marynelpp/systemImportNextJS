import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatVenezuelanDateTime } from "@/lib/dates";
import InventoryAdjustModal from "@/components/inventory-adjust-modal";

const quantity = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function InventoryPage() {
  const user = await requireUser("inventario.ver");
  const pool = await db();
  const [stock, lots, movements] = await Promise.all([
    pool.request().query(`
      SELECT p.Codigo,p.Nombre,u.Nombre Unidad,a.Nombre Almacen,SUM(l.CantidadDisponible) Existencia,COUNT(*) Lotes
      FROM importadora.InventarioLotes l JOIN importadora.Productos p ON p.Id=l.ProductoId
      JOIN importadora.Almacenes a ON a.Id=l.AlmacenId LEFT JOIN importadora.UnidadesMedida u ON u.Id=p.UnidadMedidaId
      WHERE l.CantidadDisponible>0 GROUP BY p.Codigo,p.Nombre,u.Nombre,a.Nombre ORDER BY p.Nombre,a.Nombre`),
    pool.request().query(`
      SELECT TOP 30 l.Id,p.Codigo,p.Nombre Producto,a.Nombre Almacen,i.Codigo Importacion,l.CantidadInicial,l.CantidadDisponible,l.CostoUnitarioAterrizado,l.MonedaCodigo,l.CreadoEn
      FROM importadora.InventarioLotes l JOIN importadora.Productos p ON p.Id=l.ProductoId JOIN importadora.Almacenes a ON a.Id=l.AlmacenId JOIN importadora.Importaciones i ON i.Id=l.ImportacionId
      ORDER BY l.CreadoEn DESC`),
    pool.request().query(`
      SELECT TOP 20 m.Id,m.Tipo,m.Cantidad,m.Referencia,m.CreadoEn,p.Codigo,p.Nombre Producto,a.Nombre Almacen,u.Nombre Usuario
      FROM importadora.InventarioMovimientos m JOIN importadora.InventarioLotes l ON l.Id=m.LoteId JOIN importadora.Productos p ON p.Id=l.ProductoId
      JOIN importadora.Almacenes a ON a.Id=l.AlmacenId LEFT JOIN importadora.Usuarios u ON u.Id=m.UsuarioId ORDER BY m.CreadoEn DESC`),
  ]);
  const labels: Record<string, string> = { recepcion: "Recepción", ajuste_entrada: "Ajuste de entrada", ajuste_salida: "Ajuste de salida", venta: "Venta", transferencia: "Transferencia" };
  return <>
    <h1>Inventario</h1><p>Existencia disponible por almacén, lotes y movimientos trazables.</p>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">EXISTENCIA DISPONIBLE</div><h2>Stock por producto</h2></div><span className="badge">{stock.recordset.length} referencias</span></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Almacén</th><th>Disponible</th><th>Lotes</th></tr></thead><tbody>{stock.recordset.map((item) => <tr key={`${item.Codigo}-${item.Almacen}`}><td>{item.Codigo} · {item.Nombre}</td><td>{item.Almacen}</td><td>{quantity(Number(item.Existencia))} {item.Unidad ?? ""}</td><td>{item.Lotes}</td></tr>)}</tbody></table>{!stock.recordset.length && <p className="empty-text">Aún no hay mercancía recibida en inventario.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div><div className="eyebrow">TRAZABILIDAD Y AJUSTES</div><h2>Lotes recibidos</h2></div><p>Los ajustes se aplican al lote seleccionado y quedan registrados en el historial.</p></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Importación</th><th>Almacén</th><th>Inicial</th><th>Disponible</th><th>Costo aterrizado</th>{can(user, "inventario.administrar") && <th></th>}</tr></thead><tbody>{lots.recordset.map((lot) => <tr key={lot.Id}><td>{lot.Codigo} · {lot.Producto}</td><td>{lot.Importacion}</td><td>{lot.Almacen}</td><td>{quantity(Number(lot.CantidadInicial))}</td><td>{quantity(Number(lot.CantidadDisponible))}</td><td>{lot.MonedaCodigo} {Number(lot.CostoUnitarioAterrizado).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>{can(user, "inventario.administrar") && <td><InventoryAdjustModal lotId={lot.Id} product={`${lot.Codigo} · ${lot.Producto}`} available={quantity(Number(lot.CantidadDisponible))}/></td>}</tr>)}</tbody></table>{!lots.recordset.length && <p className="empty-text">Los lotes aparecerán aquí al confirmar una recepción.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">HISTORIAL</div><h2>Últimos movimientos</h2></div></div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Almacén</th><th>Cantidad</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>{movements.recordset.map((movement) => <tr key={movement.Id}><td>{formatVenezuelanDateTime(movement.CreadoEn)}</td><td>{labels[movement.Tipo] ?? movement.Tipo}</td><td>{movement.Codigo} · {movement.Producto}</td><td>{movement.Almacen}</td><td>{quantity(Number(movement.Cantidad))}</td><td>{movement.Referencia ?? "—"}</td><td>{movement.Usuario ?? "Sistema"}</td></tr>)}</tbody></table>{!movements.recordset.length && <p className="empty-text">Aquí se verá cada entrada, ajuste, venta o transferencia.</p>}</div></section>
  </>;
}
