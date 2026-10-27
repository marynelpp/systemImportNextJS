import { requireUser, can } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { CategoryForm, ProductForm } from "@/components/catalog-forms";
import { DeactivateCatalogItem } from "@/components/catalog-actions";

export default async function ProductsPage() {
  const user = await requireUser("productos.ver"), pool = await db();
  const [categories, units, products] = await Promise.all([
    pool.request().query("SELECT Id,Nombre FROM importadora.CategoriasProducto WHERE Activa=1 ORDER BY Nombre"),
    pool.request().query("SELECT Id,Nombre FROM importadora.UnidadesMedida WHERE Activa=1 ORDER BY Nombre"),
    pool.request().query("SELECT p.Id,p.Codigo,p.Nombre,u.Nombre UnidadMedida,p.PrecioMayorUSD,p.PrecioDetalUSD,p.Activo,c.Nombre Categoria FROM importadora.Productos p JOIN importadora.UnidadesMedida u ON u.Id=p.UnidadMedidaId LEFT JOIN importadora.CategoriasProducto c ON c.Id=p.CategoriaId ORDER BY p.Activo DESC,p.Nombre"),
  ]);
  return <><h1>Productos.</h1><p>Catálogo base y precios de venta en USD.</p>{can(user,"productos.administrar")&&<section className="settings-section"><div><div className="eyebrow">CATÁLOGO</div><h2>Registrar producto.</h2><p>El proveedor, costo real y la utilidad se registrarán al recibir la mercancía en inventario.</p><div className="currency-list"><CategoryForm /></div></div><ProductForm categories={categories.recordset} units={units.recordset}/></section>}<section className="empty-card"><h2>Catálogo registrado</h2><div className="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Mayor USD</th><th>Detal USD</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{products.recordset.map(p=><tr key={p.Codigo}><td>{p.Codigo}</td><td>{p.Nombre}<small className="table-note">{p.UnidadMedida}</small></td><td>{p.Categoria||"—"}</td><td>{p.PrecioMayorUSD===null?"—":`US$ ${Number(p.PrecioMayorUSD).toFixed(2)}`}</td><td>{p.PrecioDetalUSD===null?"—":`US$ ${Number(p.PrecioDetalUSD).toFixed(2)}`}</td><td><span className="badge">{p.Activo?"Activo":"Inactivo"}</span></td><td><Link className="copy-link" href={`/panel/productos/${p.Id}`}>Ver / editar</Link>{p.Activo&&can(user,"productos.administrar")&&<DeactivateCatalogItem id={p.Id} entity="producto"/>}</td></tr>)}</tbody></table>{!products.recordset.length&&<p className="empty-text">Aún no hay productos registrados.</p>}</div></section></>;
}
