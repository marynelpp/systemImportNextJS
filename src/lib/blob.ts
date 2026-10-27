import "server-only";
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";
import { randomUUID } from "node:crypto";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function uploadProductImage(productId: number, file: File) {
  if (!allowed.has(file.type) || file.size > 4 * 1024 * 1024) throw new Error("Archivo inválido");
  const connection = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connection) throw new Error("Falta Azure Blob");
  const container = process.env.AZURE_PRODUCT_IMAGES_CONTAINER || "archivos";
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const blobName = `productos/${productId}/${randomUUID()}.${extension}`;
  const client = BlobServiceClient.fromConnectionString(connection).getContainerClient(container).getBlockBlobClient(blobName);
  await client.uploadData(Buffer.from(await file.arrayBuffer()), { blobHTTPHeaders: { blobContentType: file.type } });
  return { blobName, originalName: file.name.slice(0, 255), contentType: file.type };
}

export function signedProductImageUrl(blobName: string) {
  const connection = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connection) throw new Error("Falta Azure Blob");
  const account = /AccountName=([^;]+)/.exec(connection)?.[1];
  const key = /AccountKey=([^;]+)/.exec(connection)?.[1];
  if (!account || !key) throw new Error("Configuración Azure inválida");
  const container = process.env.AZURE_PRODUCT_IMAGES_CONTAINER || "archivos";
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000);
  const sas = generateBlobSASQueryParameters({ containerName: container, blobName, permissions: BlobSASPermissions.parse("r"), expiresOn }, new StorageSharedKeyCredential(account, key)).toString();
  return `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName).replace(/%2F/g,"/")}?${sas}`;
}
