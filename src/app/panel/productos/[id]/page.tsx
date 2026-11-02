import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { updateProductDirect, addProductImages, applySuggestedProductPrices } from "@/app/actions/catalogo";
import ProductGallery from "@/components/product-gallery";

const money = (value: number) => `USD ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string; sugerencia?: string }> }) {
  const user = await requireUser("productos.ver");
  const id = Number((await params).id), pool = await db();
  const [productResult, categories, units, images, cost, margins, viewParams] = await Promise.all([
    pool.request().input("id", sql.Int, id).input("company", sql.Int, user.EmpresaId).query("SELECT * FROM importadora.Productos WHERE Id=@id AND EmpresaId=@company"),
    pool.request().query("SELECT Id,Nombre FROM importadora.CategoriasProducto WHERE Activa=1 ORDER BY Nombre"),
    pool.request().query("SELECT Id,Nombre FROM importadora.UnidadesMedida WHERE Activa=1 ORDER BY Nombre"),
    pool.request().input("id", sql.Int, id).query("SELECT Id,NombreOriginal,EsPrincipal FROM importadora.ProductoImagenes WHERE ProductoId=@id ORDER BY EsPrincipal DESC,Id"),
    pool.request().input("id", sql.Int, id).query("SELECT SUM(CantidadDisponible*CostoUnitarioAterrizado)/NULLIF(SUM(CantidadDisponible),0) CostoPromedio FROM importadora.InventarioLotes WHERE ProductoId=@id AND CantidadDisponible>0"),
    pool.request().input("company", sql.Int, user.EmpresaId).query("SELECT MargenMayor,MargenDetal FROM importadora.ConfiguracionMargenesVenta WHERE EmpresaId=@company AND Id=1"),
    searchParams,
  ]);
  const product = productResult.recordset[0];
  if (!product) return <p>Producto no encontrado.</p>;
  const averageCost = Number(cost.recordset[0]?.CostoPromedio);
  const policy = margins.recordset[0];
  const suggestedWholesale = averageCost && policy ? averageCost / (1 - Number(policy.MargenMayor) / 100) : null;
  const suggestedRetail = averageCost && policy ? averageCost / (1 - Number(policy.MargenDetal) / 100) : null;

  return <>
    <Link className="copy-link" href="/panel/productos">← Volver a productos</Link>
    <h1>{product.Nombre}</h1>
    {images.recordset.length ? <ProductGallery productId={id} images={images.recordset} /> : <section className="image-empty">Sin fotografías registradas</section>}
    <form action={addProductImages} className="image-uploader"><input type="hidden" name="productId" value={id}/><label className="choose-images">＋ Elegir fotos desde mi dispositivo<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required/></label><button className="button small">Subir imágenes</button></form>
    {viewParams.guardado && <p className="form-message">Cambios guardados.</p>}
    {viewParams.sugerencia === "aplicada" && <p className="form-message success">Precios sugeridos aplicados.</p>}

    <section className="empty-card">
      <div className="eyebrow">PRECIO SUGERIDO</div>
      <h2>Basado en el costo aterrizado promedio</h2>
      {suggestedWholesale && suggestedRetail ? <>
        <p>Costo promedio disponible: <strong>{money(averageCost)}</strong> · Margen mayor: {Number(policy.MargenMayor).toFixed(2)}% · Margen detal: {Number(policy.MargenDetal).toFixed(2)}%</p>
        <div className="module-grid"><article className="module-card"><span className="eyebrow">MAYOR SUGERIDO</span><h3>{money(suggestedWholesale)}</h3></article><article className="module-card"><span className="eyebrow">DETAL SUGERIDO</span><h3>{money(suggestedRetail)}</h3></article></div>
        <form action={applySuggestedProductPrices}><input type="hidden" name="id" value={id}/><button className="button">Aplicar precios sugeridos</button></form>
      </> : <p className="empty-text">Recibe inventario de este producto para calcular su costo aterrizado y sugerir precios.</p>}
    </section>

    <form action={updateProductDirect} className="settings-form"><input type="hidden" name="id" value={product.Id}/><div className="form-grid"><label className="field">Código<input name="code" defaultValue={product.Codigo}/></label><label className="field">Nombre<input name="name" defaultValue={product.Nombre}/></label><label className="field">Categoría<select name="category" defaultValue={product.CategoriaId ?? ""}><option value="">Sin categoría</option>{categories.recordset.map((item) => <option key={item.Id} value={item.Id}>{item.Nombre}</option>)}</select></label><label className="field">Unidad<select name="unit" defaultValue={product.UnidadMedidaId}>{units.recordset.map((item) => <option key={item.Id} value={item.Id}>{item.Nombre}</option>)}</select></label><label className="field">Mayor USD<input name="wholesale" type="number" step="0.01" defaultValue={product.PrecioMayorUSD ?? ""}/></label><label className="field">Detal USD<input name="retail" type="number" step="0.01" defaultValue={product.PrecioDetalUSD ?? ""}/></label><label className="field wide">Descripción<input name="description" defaultValue={product.Descripcion ?? ""}/></label></div><button className="button">Guardar cambios</button></form>
  </>;
}
