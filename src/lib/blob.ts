import "server-only";
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";
import { randomUUID } from "node:crypto";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const paymentAllowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
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

export async function uploadPaymentProof(paymentId: number, file: File) {
  if (!paymentAllowed.has(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Archivo inválido");
  const connection = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connection) throw new Error("Falta Azure Blob");
  const container = process.env.AZURE_PAYMENT_PROOFS_CONTAINER || process.env.AZURE_PRODUCT_IMAGES_CONTAINER || "archivos";
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const blobName = `cobros/${paymentId}/${randomUUID()}.${extension}`;
  const client = BlobServiceClient.fromConnectionString(connection).getContainerClient(container).getBlockBlobClient(blobName);
  await client.uploadData(Buffer.from(await file.arrayBuffer()), { blobHTTPHeaders: { blobContentType: file.type } });
  return { blobName, originalName: file.name.slice(0, 255), contentType: file.type, size: file.size };
}

export function signedProductImageUrl(blobName: string) {
  return signedBlobUrl(blobName, process.env.AZURE_PRODUCT_IMAGES_CONTAINER || "archivos");
}

export function signedPaymentProofUrl(blobName: string) {
  return signedBlobUrl(blobName, process.env.AZURE_PAYMENT_PROOFS_CONTAINER || process.env.AZURE_PRODUCT_IMAGES_CONTAINER || "archivos");
}

function signedBlobUrl(blobName: string, container: string) {
  const connection = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connection) throw new Error("Falta Azure Blob");
  const account = /AccountName=([^;]+)/.exec(connection)?.[1];
  const key = /AccountKey=([^;]+)/.exec(connection)?.[1];
  if (!account || !key) throw new Error("Configuración Azure inválida");
  const expiresOn = new Date(Date.now() + 5 * 60 * 1000);
  const sas = generateBlobSASQueryParameters({ containerName: container, blobName, permissions: BlobSASPermissions.parse("r"), expiresOn }, new StorageSharedKeyCredential(account, key)).toString();
  return `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName).replace(/%2F/g,"/")}?${sas}`;
}
