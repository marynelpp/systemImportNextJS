const MONTHS: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

const asText = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

export function parseBcvNumber(value: string) {
  const raw = value.replace(/\s/g, "");
  if (!/^[\d.,]+$/.test(raw)) throw new Error("Valor BCV no válido.");
  const decimal = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
  const normalized = decimal === "," ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 10000000) throw new Error("Valor BCV fuera de rango.");
  return parsed;
}

export function parseBcvUsdRate(html: string) {
  const text = asText(html);
  const usd = text.match(/USD\s+([\d.,]{3,30})/i);
  const date = text.match(/Fecha\s+Valor\s*:\s*(?:[A-Za-záéíóúñ]+,\s*)?(\d{1,2})\s+(?:de\s+)?([A-Za-záéíóúñ]+)\s+(\d{4})/i);
  if (!usd || !date) throw new Error("El BCV no publicó la tasa USD o su fecha de vigencia.");
  const month = MONTHS[date[2].toLocaleLowerCase("es-VE")];
  if (!month) throw new Error("No se pudo interpretar la fecha publicada por el BCV.");
  return { rate: parseBcvNumber(usd[1]), date: `${date[3]}-${month}-${date[1].padStart(2, "0")}` };
}
