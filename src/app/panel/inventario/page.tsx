import { can, requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDateTime } from "@/lib/dates";
import { listingParams } from "@/lib/listing";
import InventoryAdjustModal from "@/components/inventory-adjust-modal";
import InventoryTransferModal from "@/components/inventory-transfer-modal";
import ListControls, { ListPagination } from "@/components/list-controls";
import { setWarehouseMinimum, startInventoryCount } from "@/app/actions/compras";

const quantity = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; limit?: string | string[] }> }) {
  const user = await requireUser("inventario.ver");
  const pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);
  const [stock, lots, warehouses, products, movementCount, movements] = await Promise.all([
    pool.request().input("company",sql.Int,user.EmpresaId).query(`
      SELECT p.Codigo,p.Nombre,u.Nombre Unidad,a.Nombre Almacen,SUM(l.CantidadDisponible) Existencia,COUNT(*) Lotes
      FROM importadora.InventarioLotes l JOIN importadora.Productos p ON p.Id=l.ProductoId
      JOIN importadora.Almacenes a ON a.Id=l.AlmacenId LEFT JOIN importadora.UnidadesMedida u ON u.Id=p.UnidadMedidaId
      WHERE p.EmpresaId=@company AND l.CantidadDisponible>0 GROUP BY p.Codigo,p.Nombre,u.Nombre,a.Nombre ORDER BY p.Nombre,a.Nombre`),
    pool.request().input("company",sql.Int,user.EmpresaId).query(`
      SELECT TOP 30 l.Id,l.AlmacenId,p.Codigo,p.Nombre Producto,a.Nombre Almacen,i.Codigo Importacion,l.CantidadInicial,l.CantidadDisponible,l.CostoUnitarioAterrizado,l.MonedaCodigo,l.CreadoEn
      FROM importadora.InventarioLotes l JOIN importadora.Productos p ON p.Id=l.ProductoId JOIN importadora.Almacenes a ON a.Id=l.AlmacenId JOIN importadora.Importaciones i ON i.Id=l.ImportacionId
      WHERE p.EmpresaId=@company ORDER BY l.CreadoEn DESC`),
    pool.request().input("company",sql.Int,user.EmpresaId).query(`SELECT Id,Nombre FROM importadora.Almacenes WHERE EmpresaId=@company AND Activo=1 ORDER BY Nombre`),
    pool.request().input("company",sql.Int,user.EmpresaId).query(`SELECT Id,Codigo,Nombre FROM importadora.Productos WHERE EmpresaId=@company AND Activo=1 ORDER BY Nombre`),
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).query(`
      SELECT COUNT(*) AS Total
      FROM importadora.InventarioMovimientos m JOIN importadora.InventarioLotes l ON l.Id=m.LoteId JOIN importadora.Productos p ON p.Id=l.ProductoId
      JOIN importadora.Almacenes a ON a.Id=l.AlmacenId LEFT JOIN importadora.Usuarios u ON u.Id=m.UsuarioId
      WHERE p.EmpresaId=@company AND (@query='' OR p.Codigo LIKE '%'+@query+'%' OR p.Nombre LIKE '%'+@query+'%' OR a.Nombre LIKE '%'+@query+'%' OR m.Referencia LIKE '%'+@query+'%' OR m.Tipo LIKE '%'+@query+'%')
    `),
    pool.request().input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query).input("offset", sql.Int, offset).input("limit", sql.Int, limit).query(`
      SELECT m.Id,m.Tipo,m.Cantidad,m.Referencia,m.CreadoEn,p.Codigo,p.Nombre Producto,a.Nombre Almacen,u.Nombre Usuario
      FROM importadora.InventarioMovimientos m JOIN importadora.InventarioLotes l ON l.Id=m.LoteId JOIN importadora.Productos p ON p.Id=l.ProductoId
      JOIN importadora.Almacenes a ON a.Id=l.AlmacenId LEFT JOIN importadora.Usuarios u ON u.Id=m.UsuarioId
      WHERE p.EmpresaId=@company AND (@query='' OR p.Codigo LIKE '%'+@query+'%' OR p.Nombre LIKE '%'+@query+'%' OR a.Nombre LIKE '%'+@query+'%' OR m.Referencia LIKE '%'+@query+'%' OR m.Tipo LIKE '%'+@query+'%')
      ORDER BY m.CreadoEn DESC,m.Id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`),
  ]);
  const totalMovements = movementCount.recordset[0].Total as number;
  const labels: Record<string, string> = { recepcion: "Recepción", ajuste_entrada: "Ajuste de entrada", ajuste_salida: "Ajuste de salida", venta: "Venta", transferencia: "Transferencia" };
  return <>
    <h1>Inventario</h1><p>Existencia disponible por almacén, lotes y movimientos trazables.</p>
    {can(user, "inventario.administrar") && <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">CONTEO FÍSICO</div><h2>Verificar existencia real</h2><p>Crea una fotografía de los lotes disponibles y aplica diferencias auditadas al finalizar.</p></div></div><form action={startInventoryCount} className="purchase-line-form"><label>Almacén<select name="warehouseId" required><option value="">Selecciona</option>{warehouses.recordset.map((warehouse) => <option key={warehouse.Id} value={warehouse.Id}>{warehouse.Nombre}</option>)}</select></label><label>Fecha<input name="date" type="date" required/></label><label>Observación<input name="notes" maxLength={300} placeholder="Opcional"/></label><button className="button">Iniciar conteo</button></form></section>}
    {can(user, "inventario.administrar") && <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">REPOSICIÓN</div><h2>Mínimo por almacén</h2><p>Define el punto de alerta para cada producto en cada almacén.</p></div></div><form action={setWarehouseMinimum} className="purchase-line-form"><label>Producto<select name="productId" required><option value="">Selecciona</option>{products.recordset.map((product) => <option key={product.Id} value={product.Id}>{product.Codigo} · {product.Nombre}</option>)}</select></label><label>Almacén<select name="warehouseId" required><option value="">Selecciona</option>{warehouses.recordset.map((warehouse) => <option key={warehouse.Id} value={warehouse.Id}>{warehouse.Nombre}</option>)}</select></label><label>Mínimo<input name="minimum" type="number" min="0" step="0.01" required placeholder="Ej. 5"/></label><button className="button">Guardar mínimo</button></form></section>}
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">EXISTENCIA DISPONIBLE</div><h2>Stock por producto</h2></div><span className="badge">{stock.recordset.length} referencias</span></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Almacén</th><th>Disponible</th><th>Lotes</th></tr></thead><tbody>{stock.recordset.map((item) => <tr key={`${item.Codigo}-${item.Almacen}`}><td>{item.Codigo} · {item.Nombre}</td><td>{item.Almacen}</td><td>{quantity(Number(item.Existencia))} {item.Unidad ?? ""}</td><td>{item.Lotes}</td></tr>)}</tbody></table>{!stock.recordset.length && <p className="empty-text">Aún no hay mercancía recibida en inventario.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div><div className="eyebrow">TRAZABILIDAD Y AJUSTES</div><h2>Lotes recibidos</h2></div><p>Los ajustes y transferencias se aplican al lote seleccionado y quedan registrados en el historial.</p></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Importación</th><th>Almacén</th><th>Inicial</th><th>Disponible</th><th>Costo aterrizado</th>{can(user, "inventario.administrar") && <th>Acciones</th>}</tr></thead><tbody>{lots.recordset.map((lot) => <tr key={lot.Id}><td>{lot.Codigo} · {lot.Producto}</td><td>{lot.Importacion}</td><td>{lot.Almacen}</td><td>{quantity(Number(lot.CantidadInicial))}</td><td>{quantity(Number(lot.CantidadDisponible))}</td><td>{lot.MonedaCodigo} {Number(lot.CostoUnitarioAterrizado).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>{can(user, "inventario.administrar") && <td><div className="inventory-lot-actions"><InventoryAdjustModal lotId={lot.Id} product={`${lot.Codigo} · ${lot.Producto}`} available={quantity(Number(lot.CantidadDisponible))}/><InventoryTransferModal lotId={lot.Id} product={`${lot.Codigo} · ${lot.Producto}`} sourceWarehouseId={lot.AlmacenId} sourceWarehouse={lot.Almacen} available={quantity(Number(lot.CantidadDisponible))} warehouses={warehouses.recordset}/></div></td>}</tr>)}</tbody></table>{!lots.recordset.length && <p className="empty-text">Los lotes aparecerán aquí al confirmar una recepción.</p>}</div></section>
    <section className="empty-card inventory-section"><div className="section-heading"><div><div className="eyebrow">HISTORIAL</div><h2>Movimientos de inventario</h2></div></div><ListControls basePath="/panel/inventario" query={query} page={page} total={totalMovements} limit={limit} includePagination={false} placeholder="Buscar producto, almacén, tipo o referencia"/><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Almacén</th><th>Cantidad</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>{movements.recordset.map((movement) => <tr key={movement.Id}><td>{formatVenezuelanDateTime(movement.CreadoEn)}</td><td>{labels[movement.Tipo] ?? movement.Tipo}</td><td>{movement.Codigo} · {movement.Producto}</td><td>{movement.Almacen}</td><td>{quantity(Number(movement.Cantidad))}</td><td>{movement.Referencia ?? "—"}</td><td>{movement.Usuario ?? "Sistema"}</td></tr>)}</tbody></table>{!movements.recordset.length && <p className="empty-text">No hay movimientos que coincidan con el filtro.</p>}<ListPagination basePath="/panel/inventario" query={query} page={page} total={totalMovements} limit={limit}/></div></section>
  </>;
}
