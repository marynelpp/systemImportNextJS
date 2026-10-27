"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { uploadProductImage } from "@/lib/blob";
import type { FormState } from "./auth";

const text = (data: FormData, name: string, length: number) => String(data.get(name) ?? "").trim().slice(0, length);

export async function createCategory(_: FormState, data: FormData): Promise<FormState> {
  await requireUser("productos.administrar");
  const name = text(data, "name", 100);
  if (name.length < 2) return { message: "Indica el nombre de la categoría." };
  try {
    await (await db()).request().input("name", sql.NVarChar(100), name).query("INSERT importadora.CategoriasProducto(Nombre) VALUES(@name)");
  } catch { return { message: "No se pudo crear. La categoría ya puede existir." }; }
  revalidatePath("/panel/productos");
  return { success: true, message: "Categoría creada." };
}

export async function createProduct(_: FormState, data: FormData): Promise<FormState> {
  const actor = await requireUser("productos.administrar");
  const code = text(data, "code", 40).toUpperCase(), name = text(data, "name", 180);
  const category = Number(data.get("category")) || null;
  const unit = Number(data.get("unit"));
  const wholesale = Number(data.get("wholesale")), retail = Number(data.get("retail"));
  const file = data.get("image");
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || name.length < 2 || !Number.isInteger(unit) || unit <= 0 || (wholesale && wholesale < 0) || (retail && retail < 0)) return { message: "Indica unidad y revisa código, nombre y precios." };
  if (file instanceof File && file.size > 0 && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024)) return { message: "La foto debe ser JPG, PNG o WebP y pesar máximo 4 MB." };
  if (file instanceof File && file.size > 0 && !process.env.AZURE_STORAGE_CONNECTION_STRING) return { message: "Falta configurar Azure Blob en .env.local. Agrega la cadena y reinicia el servidor." };
  let createdProductId: number | undefined;
  try {
    const pool = await db();
    const inserted = await pool.request().input("code", sql.VarChar(40), code).input("name", sql.NVarChar(180), name).input("description", sql.NVarChar(500), text(data,"description",500) || null).input("category", sql.Int, category).input("unit", sql.SmallInt, unit).input("wholesale", sql.Decimal(19,2), wholesale || null).input("retail", sql.Decimal(19,2), retail || null).query("INSERT importadora.Productos(Codigo,Nombre,Descripcion,CategoriaId,UnidadMedidaId,PrecioMayorUSD,PrecioDetalUSD) OUTPUT inserted.Id VALUES(@code,@name,@description,@category,@unit,@wholesale,@retail)");
    createdProductId = inserted.recordset[0].Id;
    if (file instanceof File && file.size > 0) {
      const image = await uploadProductImage(inserted.recordset[0].Id, file);
      await pool.request().input("product",sql.Int,inserted.recordset[0].Id).input("blob",sql.NVarChar(300),image.blobName).input("original",sql.NVarChar(255),image.originalName).input("type",sql.VarChar(100),image.contentType).input("actor",sql.Int,actor.Id).query("INSERT importadora.ProductoImagenes(ProductoId,NombreBlob,NombreOriginal,TipoContenido,CreadoPorUsuarioId) VALUES(@product,@blob,@original,@type,@actor)");
    }
  } catch (error) {
    if (createdProductId) await (await db()).request().input("id", sql.Int, createdProductId).query("DELETE FROM importadora.Productos WHERE Id=@id").catch(() => {});
    const detail = error instanceof Error ? error.message : "";
    if (detail.includes("ProductoImagenes")) return { message: "Falta ejecutar 008-imagenes-productos.sql en SQL Server." };
    if (detail.includes("Blob") || detail.includes("Authorization") || detail.includes("Container")) return { message: "No pudimos guardar la foto en Azure Blob. Revisa la cadena, el contenedor archivos y reinicia el servidor." };
    return { message: "No se pudo guardar. El código debe ser único y la categoría válida." };
  }
  revalidatePath("/panel/productos");
  return { success: true, message: "Producto registrado." };
}

export async function createSupplier(_: FormState, data: FormData): Promise<FormState> {
  await requireUser("proveedores.administrar");
  const code = text(data,"code",20).toUpperCase(), name = text(data,"name",150), email = text(data,"email",254).toLowerCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code) || name.length < 2 || (email && !/^\S+@\S+\.\S+$/.test(email))) return { message: "Revisa código, nombre y correo." };
  const country = text(data,"country",2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return { message: "Selecciona un país." };
  try {
    await (await db()).request().input("code",sql.VarChar(20),code).input("name",sql.NVarChar(150),name).input("country",sql.Char(2),country).input("contact",sql.NVarChar(100),text(data,"contact",100)||null).input("email",sql.NVarChar(254),email||null).input("wechat",sql.NVarChar(100),text(data,"wechat",100)||null).input("platform",sql.NVarChar(80),text(data,"platform",80)||null).input("url",sql.NVarChar(500),text(data,"storeUrl",500)||null).input("agent",sql.NVarChar(150),text(data,"agent",150)||null).input("payment",sql.NVarChar(120),text(data,"payment",120)||null).query("INSERT importadora.Proveedores(Codigo,Nombre,PaisCodigo,Contacto,Email,WeChat,PlataformaCompra,UrlTienda,AgenteCompra,TerminoPago) VALUES(@code,@name,@country,@contact,@email,@wechat,@platform,@url,@agent,@payment)");
  } catch { return { message: "No se pudo guardar. El código debe ser único." }; }
  revalidatePath("/panel/proveedores");
  return { success: true, message: "Proveedor registrado." };
}

export async function setCatalogStatus(_: FormState, data: FormData): Promise<FormState> {
  const entity = String(data.get("entity")), id = Number(data.get("id"));
  if (!Number.isInteger(id) || id <= 0 || !["producto", "proveedor"].includes(entity)) return { message: "Registro inválido." };
  await requireUser(entity === "producto" ? "productos.administrar" : "proveedores.administrar");
  const table = entity === "producto" ? "Productos" : "Proveedores";
  try { await (await db()).request().input("id",sql.Int,id).query(`UPDATE importadora.${table} SET Activo=0,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id`); }
  catch { return { message: "No se pudo desactivar el registro." }; }
  revalidatePath(entity === "producto" ? "/panel/productos" : "/panel/proveedores");
  return { success:true, message: "Registro desactivado. Su historial se conserva." };
}

export async function updateProductDirect(data: FormData) {
  await requireUser("productos.administrar");
  const id=Number(data.get("id")), code=text(data,"code",40).toUpperCase(), name=text(data,"name",180), category=Number(data.get("category"))||null, unit=Number(data.get("unit")), wholesale=Number(data.get("wholesale"))||null, retail=Number(data.get("retail"))||null;
  if(!Number.isInteger(id)||!Number.isInteger(unit)||!code||name.length<2) redirect("/panel/productos");
  await (await db()).request().input("id",sql.Int,id).input("code",sql.VarChar(40),code).input("name",sql.NVarChar(180),name).input("description",sql.NVarChar(500),text(data,"description",500)||null).input("category",sql.Int,category).input("unit",sql.SmallInt,unit).input("wholesale",sql.Decimal(19,2),wholesale).input("retail",sql.Decimal(19,2),retail).query("UPDATE importadora.Productos SET Codigo=@code,Nombre=@name,Descripcion=@description,CategoriaId=@category,UnidadMedidaId=@unit,PrecioMayorUSD=@wholesale,PrecioDetalUSD=@retail,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id");
  revalidatePath("/panel/productos"); redirect(`/panel/productos/${id}?guardado=1`);
}

export async function updateSupplierDirect(data: FormData) {
  await requireUser("proveedores.administrar");
  const id=Number(data.get("id")), code=text(data,"code",20).toUpperCase(), name=text(data,"name",150), country=text(data,"country",2).toUpperCase();
  if(!Number.isInteger(id)||!code||name.length<2||!country) redirect("/panel/proveedores");
  await (await db()).request().input("id",sql.Int,id).input("code",sql.VarChar(20),code).input("name",sql.NVarChar(150),name).input("country",sql.Char(2),country).input("contact",sql.NVarChar(100),text(data,"contact",100)||null).input("email",sql.NVarChar(254),text(data,"email",254)||null).input("wechat",sql.NVarChar(100),text(data,"wechat",100)||null).input("platform",sql.NVarChar(80),text(data,"platform",80)||null).input("url",sql.NVarChar(500),text(data,"storeUrl",500)||null).input("agent",sql.NVarChar(150),text(data,"agent",150)||null).input("payment",sql.NVarChar(120),text(data,"payment",120)||null).query("UPDATE importadora.Proveedores SET Codigo=@code,Nombre=@name,PaisCodigo=@country,Contacto=@contact,Email=@email,WeChat=@wechat,PlataformaCompra=@platform,UrlTienda=@url,AgenteCompra=@agent,TerminoPago=@payment,ActualizadoEn=SYSUTCDATETIME() WHERE Id=@id");
  revalidatePath("/panel/proveedores"); redirect(`/panel/proveedores/${id}?guardado=1`);
}

export async function addProductImages(data: FormData) {
  const actor=await requireUser("productos.administrar"), product=Number(data.get("productId")), files=data.getAll("images").filter((x):x is File=>x instanceof File&&x.size>0);
  if(!Number.isInteger(product)||!files.length) redirect(`/panel/productos/${product}`);
  const pool=await db(); const check=await pool.request().input("id",sql.Int,product).query("SELECT COUNT(*) Total FROM importadora.ProductoImagenes WHERE ProductoId=@id AND EsPrincipal=1"); let principal=check.recordset[0].Total===0;
  for(const file of files){const image=await uploadProductImage(product,file);await pool.request().input("product",sql.Int,product).input("blob",sql.NVarChar(300),image.blobName).input("original",sql.NVarChar(255),image.originalName).input("type",sql.VarChar(100),image.contentType).input("principal",sql.Bit,principal?1:0).input("actor",sql.Int,actor.Id).query("INSERT importadora.ProductoImagenes(ProductoId,NombreBlob,NombreOriginal,TipoContenido,EsPrincipal,CreadoPorUsuarioId) VALUES(@product,@blob,@original,@type,@principal,@actor)");principal=false;}
  revalidatePath(`/panel/productos/${product}`); redirect(`/panel/productos/${product}`);
}
