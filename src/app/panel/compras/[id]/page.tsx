import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { deletePurchaseLine, confirmPurchase } from "@/app/actions/compras";
import PurchaseLineForm from "@/components/purchase-line-form";

const number = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ producto?: string }> }) {
  await requireUser("compras.ver");
  const [{ id: rawId }, { producto }] = await Promise.all([params, searchParams]);
  const id = Number(rawId), pool = await db(), suggestedProduct = Number(producto);
  const [header, lines, products, importation] = await Promise.all([
    pool.request().input("id", sql.Int, id).query("SELECT o.*,pr.Nombre Proveedor FROM importadora.OrdenesCompra o JOIN importadora.Proveedores pr ON pr.Id=o.ProveedorId WHERE o.Id=@id"),
    pool.request().input("id", sql.Int, id).query("SELECT d.*,x.Nombre Producto,x.Codigo FROM importadora.OrdenCompraDetalles d JOIN importadora.Productos x ON x.Id=d.ProductoId WHERE d.OrdenCompraId=@id ORDER BY d.Id"),
    pool.request().query("SELECT Id,Codigo,Nombre FROM importadora.Productos WHERE Activo=1 ORDER BY Nombre"),
    pool.request().input("id", sql.Int, id).query("SELECT Id,Codigo,Estado FROM importadora.Importaciones WHERE OrdenCompraId=@id")
  ]);
  const order = header.recordset[0];
  if (!order) return <p>Orden no encontrada.</p>;
  const isDraft = order.Estado === "borrador", shipment = importation.recordset[0];
  const defaultProduct = Number.isInteger(suggestedProduct) && products.recordset.some((item) => item.Id === suggestedProduct) ? suggestedProduct : undefined;
  const total = lines.recordset.reduce((sum, line) => sum + Number(line.Cantidad) * Number(line.CostoUnitario), 0);

  return <>
    <Link className="copy-link" href="/panel/compras">← Volver a compras</Link>
    <h1>{order.Numero}</h1>
    <p>{order.Proveedor} · <span className="badge">{order.Estado}</span> · {order.MonedaCodigo}</p>
    {order.Observaciones && <p>{order.Observaciones}</p>}
    {isDraft && <form action={confirmPurchase}><input type="hidden" name="id" value={id}/><button className="button small" disabled={!lines.recordset.length}>Confirmar compra e iniciar importación</button></form>}
    {!isDraft && <p className="form-message">La compra está confirmada y sus productos quedaron bloqueados para conservar la trazabilidad.</p>}
    {shipment && <Link className="button small" href={`/panel/importaciones/${shipment.Id}`}>Gestionar {shipment.Codigo} · {shipment.Estado}</Link>}
    <section className="empty-card">
      <div className="section-heading"><div><div className="eyebrow">DETALLE DE COMPRA</div><h2>Productos de la orden</h2></div><strong>{order.MonedaCodigo} {number(total)}</strong></div>
      {isDraft && defaultProduct && <p className="form-message">Producto sugerido por la alerta: revisa cantidad y costo antes de agregarlo.</p>}
      {isDraft && <PurchaseLineForm order={id} products={products.recordset} defaultProduct={defaultProduct}/>}
      <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th>{isDraft && <th>Acciones</th>}</tr></thead><tbody>{lines.recordset.map((line) => <tr key={line.Id}><td>{line.Codigo} · {line.Producto}</td><td>{number(Number(line.Cantidad))}</td><td>{order.MonedaCodigo} {number(Number(line.CostoUnitario))}</td><td>{order.MonedaCodigo} {number(Number(line.Cantidad) * Number(line.CostoUnitario))}</td>{isDraft && <td><form action={deletePurchaseLine}><input type="hidden" name="id" value={line.Id}/><input type="hidden" name="order" value={id}/><button className="catalog-action danger">Eliminar</button></form></td>}</tr>)}</tbody></table>{!lines.recordset.length && <p className="empty-text">Agrega al menos un producto antes de confirmar la compra.</p>}</div>
    </section>
  </>;
}
